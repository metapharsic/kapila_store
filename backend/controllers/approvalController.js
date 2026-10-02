const db = require("../db");
const { sendNotification } = require("./notificationController");
const { getConversionMultiplier } = require("../utils/units");

async function calculateIndentAmount(indentId) {
  const indItems = await db("indent_items").where("indent_id", indentId);
  if (!indItems || !indItems.length) return 0;

  const itemNames = indItems.map((i) => (i.name || "").toLowerCase());
  const itemCodes = indItems.map((i) => (i.item_code || "").trim().toUpperCase()).filter(Boolean);

  const stockRows = await db("stock")
    .where((qb) => {
      if (itemCodes.length) qb.whereIn(db.raw("UPPER(item_code)"), itemCodes);
      if (itemNames.length) qb.orWhereIn(db.raw("LOWER(name)"), itemNames);
    })
    .select("name", "item_code", "price", "unit");

  const stockMap = new Map();
  for (const s of stockRows) {
    if (s.item_code) stockMap.set(s.item_code.trim().toUpperCase(), s);
    if (s.name) stockMap.set(s.name.trim().toLowerCase(), s);
  }

  return indItems.reduce((sum, it) => {
    const codeKey = (it.item_code || "").trim().toUpperCase();
    const nameKey = (it.name || "").trim().toLowerCase();
    const stock = (codeKey && stockMap.get(codeKey)) || stockMap.get(nameKey);
    if (!stock) return sum;
    const price = parseFloat(stock.price) || 0;
    const qty = parseFloat(it.qty) || 0;
    const mult = getConversionMultiplier(it.unit, stock.unit, it.name) ?? 1;
    return sum + (qty * mult * price);
  }, 0);
}

// Helper to determine if a user can approve a specific request
// Admin always wins — required so approvals never get stuck when the
// designated approver (e.g. store manager) is unreachable.
async function canApprove(userId, request) {
  const adminRole = await db("roles").where({ key: "admin" }).first();
  if (adminRole) {
    const isAdmin = await db("user_roles").where({ user_id: userId, role_id: adminRole.id }).first();
    if (isAdmin) return true;
  }

  // Get user's roles
  const userRoles = await db("user_roles").where("user_id", userId).select("role_id");
  const roleIds = userRoles.map(r => r.role_id);

  // Get matching rule for this request's module, sequence and resource value
  // We first fetch details from the actual resource to find the amount/department
  let amount = 0;
  let departmentId = null;

  if (request.module === "purchase_orders") {
    const po = await db("purchase_orders").where("id", request.resource_id).first();
    if (po) amount = parseFloat(po.total_amount || 0);
  } else if (request.module === "indents") {
    amount = await calculateIndentAmount(request.resource_id);
  } else if (request.module === "reconciliations") {
    // For stock adjustment / reconciliation, sum up the total absolute discrepancy cost
    const items = await db("stock_adjustments").where("id", request.resource_id).first(); // assuming single adjustment or parent
    // fallback if cost not found
    amount = parseFloat(items?.adjusted_value || 0);
  }

  // Find matching rule
  const rule = await db("approval_rules")
    .where("module", request.module)
    .where("sequence", request.current_sequence)
    .andWhere("min_amount", "<=", amount)
    .andWhere((qb) => {
      qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
    })
    .first();

  if (!rule) return true; // If no rule is defined, anyone or auto-approved
  const smRole = await db("roles").where({ key: "store_manager" }).first();
  const isStoreManager = smRole && roleIds.includes(smRole.id);
  if (request.module === "indents" && isStoreManager) return true;
  if (request.delegated_to && request.delegated_to === userId) return true;
  return roleIds.includes(rule.role_id);
}

// Returns the approval_rules row (if any) applicable to a request at its
// current sequence/amount — used by canApprove, listPending and delegation
// eligibility checks so they all agree on "who is the approver right now".
async function getApplicableRule(request) {
  let amount = 0;
  if (request.module === "purchase_orders") {
    const po = await db("purchase_orders").where("id", request.resource_id).first();
    if (po) amount = parseFloat(po.total_amount || 0);
  } else if (request.module === "indents") {
    amount = await calculateIndentAmount(request.resource_id);
  } else if (request.module === "reconciliations") {
    const items = await db("stock_adjustments").where("id", request.resource_id).first();
    amount = parseFloat(items?.adjusted_value || 0);
  }

  const rule = await db("approval_rules")
    .where("module", request.module)
    .where("sequence", request.current_sequence)
    .andWhere("min_amount", "<=", amount)
    .andWhere((qb) => {
      qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
    })
    .first();

  return { rule, amount };
}

// GET /api/approvals/pending
async function listPending(req, res, next) {
  try {
    const userId = req.user.id;
    const isAdmin = !!req.user.isAdmin;
    const userRoles = await db("user_roles").where("user_id", userId).select("role_id");
    const roleIds = userRoles.map(r => r.role_id);

    // Fetch all pending requests
    const pending = await db("approval_requests")
      .where("status", "pending")
      .orderBy("created_at", "desc");

    const smRole = await db("roles").where({ key: "store_manager" }).first();
    const isStoreManager = smRole && roleIds.includes(smRole.id);

    // Filter based on whether user's roles match the expected role for the current step
    const filtered = [];
    for (const reqObj of pending) {
      // Find matching rule for this sequence
      let amount = 0;
      if (reqObj.module === "purchase_orders") {
        const po = await db("purchase_orders").where("id", reqObj.resource_id).first();
        if (po) amount = parseFloat(po.total_amount || 0);
      } else if (reqObj.module === "indents") {
        amount = await calculateIndentAmount(reqObj.resource_id);
      }
      
      const rule = await db("approval_rules")
        .where("module", reqObj.module)
        .where("sequence", reqObj.current_sequence)
        .andWhere("min_amount", "<=", amount)
        .andWhere((qb) => {
          qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
        })
        .first();

      const isDelegatedToMe = reqObj.delegated_to && reqObj.delegated_to === userId;

      // If no rule matches, admin, store manager for indents, user has the role, or it was delegated to them
      if (!rule || isAdmin || roleIds.includes(rule.role_id) || (reqObj.module === "indents" && isStoreManager) || isDelegatedToMe) {
        // Enriched request with resource details
        let resourceDetails = {};
        if (reqObj.module === "purchase_orders") {
          const po = await db("purchase_orders")
            .join("suppliers", "purchase_orders.supplier_id", "suppliers.id")
            .where("purchase_orders.id", reqObj.resource_id)
            .select("purchase_orders.*", "suppliers.name as supplier_name")
            .first();
          resourceDetails = po;
        } else if (reqObj.module === "indents") {
          const ind = await db("indents").where("id", reqObj.resource_id).first();
          if (ind) {
            const items = await db("indent_items").where("indent_id", ind.id);
            resourceDetails = { ...ind, items, estimated_amount: parseFloat(amount.toFixed(2)) };
          } else {
            resourceDetails = ind;
          }
        }

        const ageHours = (Date.now() - new Date(reqObj.created_at).getTime()) / 3600000;

        filtered.push({
          ...reqObj,
          age_hours: parseFloat(ageHours.toFixed(2)),
          details: resourceDetails
        });
      }
    }

    res.json({ success: true, data: filtered });
  } catch (err) {
    next(err);
  }
}

// GET /api/approvals/rules
async function listRules(req, res, next) {
  try {
    const rules = await db("approval_rules")
      .leftJoin("roles", "approval_rules.role_id", "roles.id")
      .leftJoin("departments", "approval_rules.department_id", "departments.id")
      .select("approval_rules.*", "roles.name as role_name", "departments.name as department_name")
      .orderBy("approval_rules.module")
      .orderBy("approval_rules.sequence");
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
}

// POST /api/approvals/rules
async function createRule(req, res, next) {
  try {
    const { module: targetModule, min_amount, max_amount, department_id, role_id, sequence } = req.body;
    const [rule] = await db("approval_rules")
      .insert({
        module: targetModule,
        min_amount: min_amount || 0.00,
        max_amount: max_amount || null,
        department_id: department_id || null,
        role_id,
        sequence: sequence || 1
      })
      .returning("*");
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/approvals/rules/:id
async function updateRule(req, res, next) {
  try {
    const { id } = req.params;
    const updates = {};
    ["min_amount", "max_amount", "department_id", "role_id", "sequence", "module"].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    updates.updated_at = db.fn.now();

    const [rule] = await db("approval_rules").where({ id }).update(updates).returning("*");
    if (!rule) return res.status(404).json({ success: false, error: "Rule not found." });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/approvals/rules/:id
async function removeRule(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await db("approval_rules").where({ id }).del();
    if (!deleted) return res.status(404).json({ success: false, error: "Rule not found." });
    res.json({ success: true, message: "Rule deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// POST /api/approvals/:id/approve
async function approveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    const request = await db("approval_requests").where({ id }).first();
    if (!request) return res.status(404).json({ success: false, error: "Approval request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Request is already processed." });

    const allowed = await canApprove(userId, request);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "You are not authorized to approve this request at this stage." });
    }

    // Check if there's a next sequence rule
    let amount = 0;
    if (request.module === "purchase_orders") {
      const po = await db("purchase_orders").where("id", request.resource_id).first();
      if (po) amount = parseFloat(po.total_amount || 0);
    } else if (request.module === "indents") {
      amount = await calculateIndentAmount(request.resource_id);
    }

    const nextRule = await db("approval_rules")
      .where("module", request.module)
      .where("sequence", request.current_sequence + 1)
      .andWhere("min_amount", "<=", amount)
      .andWhere((qb) => {
        qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
      })
      .first();

    await db.transaction(async (trx) => {
      if (nextRule) {
        // Multi-stage approval moves to next sequence
        const updatedRows = await trx("approval_requests")
          .where({ id, status: "pending" })
          .update({
            current_sequence: request.current_sequence + 1,
            notes: notes || request.notes,
            updated_at: trx.fn.now()
          });
        if (!updatedRows) {
          throw Object.assign(new Error("Request is already processed."), { statusCode: 409 });
        }

        await trx("audit_logs").insert({
          actor_user_id: userId,
          actor_name: req.user.name || req.user.username || null,
          action: "approval.advance",
          resource: request.module,
          resource_id: String(request.resource_id),
          before: JSON.stringify({ status: "pending", current_sequence: request.current_sequence }),
          after: JSON.stringify({ status: "pending", current_sequence: request.current_sequence + 1 }),
          metadata: JSON.stringify({ request_id: id }),
          created_at: trx.fn.now()
        });

        // Notify next approver role
        await sendNotification({
          recipient_role_id: nextRule.role_id,
          title: "Approval Needed (Stage " + (request.current_sequence + 1) + ")",
          message: `Approval request for ${request.module} (ID: ${request.resource_id}) has passed initial stage and requires your approval.`,
          type: "approval_pending",
          severity: "info",
          metadata: { module: request.module, resource_id: request.resource_id, request_id: id }
        });
      } else {
        // Fully approved
        const updatedRows = await trx("approval_requests")
          .where({ id, status: "pending" })
          .update({
            status: "approved",
            approved_by: userId,
            notes: notes || request.notes,
            updated_at: trx.fn.now()
          });
        if (!updatedRows) {
          throw Object.assign(new Error("Request is already processed."), { statusCode: 409 });
        }

        await trx("audit_logs").insert({
          actor_user_id: userId,
          actor_name: req.user.name || req.user.username || null,
          action: "approval.approve",
          resource: request.module,
          resource_id: String(request.resource_id),
          before: JSON.stringify({ status: "pending" }),
          after: JSON.stringify({ status: "approved" }),
          metadata: JSON.stringify({ request_id: id }),
          created_at: trx.fn.now()
        });

        // Update target resource status
        if (request.module === "purchase_orders") {
          await trx("purchase_orders").where("id", request.resource_id).update({ status: "Approved" });
        } else if (request.module === "indents") {
          await trx("indents").where("id", request.resource_id).update({ status: "approved" });
        } else if (request.module === "transfers") {
          await trx("stock_transfers").where("id", request.resource_id).update({ status: "Approved" });
        } else if (request.module === "reconciliations") {
          await trx("stock_adjustments").where("id", request.resource_id).update({ status: "approved" }).catch(() => {});
        }

        // Notify creator
        await sendNotification({
          recipient_user_id: request.created_by,
          title: "Request Approved",
          message: `Your ${request.module} request (ID: ${request.resource_id}) has been fully approved.`,
          type: "approval_action",
          severity: "success",
          metadata: { module: request.module, resource_id: request.resource_id }
        });

        // Auto-issue approved indents immediately (non-blocking, soft — partial on shortfall)
        if (request.module === "indents") {
          setImmediate(() => autoIssueFromIndent(request.resource_id).catch(() => {}));
        }
      }
    });

    res.json({ success: true, message: "Request approved successfully." });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// POST /api/approvals/:id/reject
async function rejectRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    const request = await db("approval_requests").where({ id }).first();
    if (!request) return res.status(404).json({ success: false, error: "Approval request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Request is already processed." });

    const allowed = await canApprove(userId, request);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "You are not authorized to reject this request." });
    }

    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ success: false, error: "A reason is required to reject a request." });
    }

    await db.transaction(async (trx) => {
      const updatedRows = await trx("approval_requests")
        .where({ id, status: "pending" })
        .update({
          status: "rejected",
          rejected_by: userId,
          notes: notes || null,
          updated_at: trx.fn.now()
        });
      if (!updatedRows) {
        throw Object.assign(new Error("Request is already processed."), { statusCode: 409 });
      }

      await trx("audit_logs").insert({
        actor_user_id: userId,
        actor_name: req.user.name || req.user.username || null,
        action: "approval.reject",
        resource: request.module,
        resource_id: String(request.resource_id),
        before: JSON.stringify({ status: "pending" }),
        after: JSON.stringify({ status: "rejected" }),
        metadata: JSON.stringify({ request_id: id, reason: notes }),
        created_at: trx.fn.now()
      });

      // Update target resource status
      if (request.module === "purchase_orders") {
        await trx("purchase_orders").where("id", request.resource_id).update({ status: "Rejected" });
      } else if (request.module === "indents") {
        await trx("indents").where("id", request.resource_id).update({ status: "cancelled" });
      } else if (request.module === "transfers") {
        await trx("stock_transfers").where("id", request.resource_id).update({ status: "Rejected" });
      }

      // Notify creator
      await sendNotification({
        recipient_user_id: request.created_by,
        title: "Request Rejected",
        message: `Your ${request.module} request (ID: ${request.resource_id}) has been rejected. Reason: ${notes || "No reason given."}`,
        type: "approval_action",
        severity: "critical",
        metadata: { module: request.module, resource_id: request.resource_id }
      });
    });

    res.json({ success: true, message: "Request rejected successfully." });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// POST /api/approvals/:id/delegate
// Lets the current eligible approver hand their pending decision to another
// user — who must themselves be eligible to approve this request's module
// at its current sequence (same rule canApprove uses), so delegation can't
// be used to route around the approval matrix.
async function delegateRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { toUserId } = req.body;
    const userId = req.user.id;

    if (!toUserId) {
      return res.status(400).json({ success: false, error: "toUserId is required." });
    }

    const request = await db("approval_requests").where({ id }).first();
    if (!request) return res.status(404).json({ success: false, error: "Approval request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Request is already processed." });

    const allowed = await canApprove(userId, request);
    if (!allowed) {
      return res.status(403).json({ success: false, error: "You are not authorized to delegate this request." });
    }

    const targetUser = await db("users").where({ id: toUserId }).first();
    if (!targetUser) return res.status(404).json({ success: false, error: "Target user not found." });

    const targetRoles = await db("user_roles").where("user_id", toUserId).select("role_id");
    const targetRoleIds = targetRoles.map((r) => r.role_id);

    const adminRole = await db("roles").where({ key: "admin" }).first();
    const isTargetAdmin = adminRole && targetRoleIds.includes(adminRole.id);

    const smRole = await db("roles").where({ key: "store_manager" }).first();
    const isTargetStoreManager = smRole && targetRoleIds.includes(smRole.id);

    const { rule } = await getApplicableRule(request);
    const isTargetEligible = isTargetAdmin
      || (!rule)
      || (rule && targetRoleIds.includes(rule.role_id))
      || (request.module === "indents" && isTargetStoreManager);

    if (!isTargetEligible) {
      return res.status(400).json({ success: false, error: "Target user does not hold an approval-eligible role for this request." });
    }

    await db.transaction(async (trx) => {
      const updatedRows = await trx("approval_requests")
        .where({ id, status: "pending" })
        .update({
          delegated_to: toUserId,
          delegated_by: userId,
          delegated_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });
      if (!updatedRows) {
        throw Object.assign(new Error("Request is already processed."), { statusCode: 409 });
      }

      await trx("audit_logs").insert({
        actor_user_id: userId,
        actor_name: req.user.name || req.user.username || null,
        action: "approval.delegate",
        resource: request.module,
        resource_id: String(request.resource_id),
        before: JSON.stringify({ delegated_to: request.delegated_to || null }),
        after: JSON.stringify({ delegated_to: toUserId }),
        metadata: JSON.stringify({ request_id: id, delegated_by: userId }),
        created_at: trx.fn.now()
      });

      await sendNotification({
        recipient_user_id: toUserId,
        title: "Approval Delegated To You",
        message: `${request.module} request (ID: ${request.resource_id}) was delegated to you for approval.`,
        type: "approval_pending",
        severity: "info",
        metadata: { module: request.module, resource_id: request.resource_id, request_id: id }
      });
    });

    res.json({ success: true, message: "Request delegated successfully." });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// POST /api/approvals/bulk-action
// body: { ids: [...], action: "approve"|"reject", reason? }
// Applies the single-item approve/reject effect to each id in one
// transaction, auditing every item, and never partially commits.
async function bulkAction(req, res, next) {
  try {
    const { ids, action, reason } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, error: "ids must be a non-empty array." });
    }
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be 'approve' or 'reject'." });
    }
    if (action === "reject" && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, error: "A reason is required to reject requests." });
    }

    const results = { succeeded: [], failed: [] };

    await db.transaction(async (trx) => {
      for (const id of ids) {
        const request = await trx("approval_requests").where({ id }).first();
        if (!request) {
          results.failed.push({ id, error: "Not found." });
          continue;
        }
        if (request.status !== "pending") {
          results.failed.push({ id, error: "Already processed." });
          continue;
        }

        const allowed = await canApprove(userId, request);
        if (!allowed) {
          results.failed.push({ id, error: "Not authorized." });
          continue;
        }

        if (action === "approve") {
          const { rule: nextRule } = await getApplicableRule({ ...request, current_sequence: request.current_sequence + 1 });

          if (nextRule) {
            await trx("approval_requests")
              .where({ id, status: "pending" })
              .update({
                current_sequence: request.current_sequence + 1,
                notes: reason || request.notes,
                updated_at: trx.fn.now()
              });

            await sendNotification({
              recipient_role_id: nextRule.role_id,
              title: "Approval Needed (Stage " + (request.current_sequence + 1) + ")",
              message: `Approval request for ${request.module} (ID: ${request.resource_id}) has passed initial stage and requires your approval.`,
              type: "approval_pending",
              severity: "info",
              metadata: { module: request.module, resource_id: request.resource_id, request_id: id }
            });

            await trx("audit_logs").insert({
              actor_user_id: userId,
              actor_name: req.user.name || req.user.username || null,
              action: "approval.bulk_advance",
              resource: request.module,
              resource_id: String(request.resource_id),
              before: JSON.stringify({ status: "pending", current_sequence: request.current_sequence }),
              after: JSON.stringify({ status: "pending", current_sequence: request.current_sequence + 1 }),
              metadata: JSON.stringify({ request_id: id, bulk_ids: ids }),
              created_at: trx.fn.now()
            });
          } else {
            await trx("approval_requests")
              .where({ id, status: "pending" })
              .update({
                status: "approved",
                approved_by: userId,
                notes: reason || request.notes,
                updated_at: trx.fn.now()
              });

            if (request.module === "purchase_orders") {
              await trx("purchase_orders").where("id", request.resource_id).update({ status: "Approved" });
            } else if (request.module === "indents") {
              await trx("indents").where("id", request.resource_id).update({ status: "approved" });
            } else if (request.module === "transfers") {
              await trx("stock_transfers").where("id", request.resource_id).update({ status: "Approved" });
            } else if (request.module === "reconciliations") {
              await trx("stock_adjustments").where("id", request.resource_id).update({ status: "approved" }).catch(() => {});
            }

            await sendNotification({
              recipient_user_id: request.created_by,
              title: "Request Approved",
              message: `Your ${request.module} request (ID: ${request.resource_id}) has been fully approved.`,
              type: "approval_action",
              severity: "success",
              metadata: { module: request.module, resource_id: request.resource_id }
            });

            await trx("audit_logs").insert({
              actor_user_id: userId,
              actor_name: req.user.name || req.user.username || null,
              action: "approval.bulk_approve",
              resource: request.module,
              resource_id: String(request.resource_id),
              before: JSON.stringify({ status: "pending" }),
              after: JSON.stringify({ status: "approved" }),
              metadata: JSON.stringify({ request_id: id, bulk_ids: ids }),
              created_at: trx.fn.now()
            });

            if (request.module === "indents") {
              setImmediate(() => autoIssueFromIndent(request.resource_id).catch(() => {}));
            }
          }
        } else {
          await trx("approval_requests")
            .where({ id, status: "pending" })
            .update({
              status: "rejected",
              rejected_by: userId,
              notes: reason,
              updated_at: trx.fn.now()
            });

          if (request.module === "purchase_orders") {
            await trx("purchase_orders").where("id", request.resource_id).update({ status: "Rejected" });
          } else if (request.module === "indents") {
            await trx("indents").where("id", request.resource_id).update({ status: "cancelled" });
          } else if (request.module === "transfers") {
            await trx("stock_transfers").where("id", request.resource_id).update({ status: "Rejected" });
          }

          await sendNotification({
            recipient_user_id: request.created_by,
            title: "Request Rejected",
            message: `Your ${request.module} request (ID: ${request.resource_id}) has been rejected. Reason: ${reason}`,
            type: "approval_action",
            severity: "critical",
            metadata: { module: request.module, resource_id: request.resource_id }
          });

          await trx("audit_logs").insert({
            actor_user_id: userId,
            actor_name: req.user.name || req.user.username || null,
            action: "approval.bulk_reject",
            resource: request.module,
            resource_id: String(request.resource_id),
            before: JSON.stringify({ status: "pending" }),
            after: JSON.stringify({ status: "rejected" }),
            metadata: JSON.stringify({ request_id: id, reason, bulk_ids: ids }),
            created_at: trx.fn.now()
          });
        }

        results.succeeded.push(id);
      }
    });

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

// Internal Helper called during creation of PO/Indent
async function createApprovalRequest(trx, moduleName, resourceId, amount, creatorUserId) {
  // Check if rules exist for this module
  const rule = await trx("approval_rules")
    .where("module", moduleName)
    .where("sequence", 1)
    .andWhere("min_amount", "<=", amount)
    .andWhere((qb) => {
      qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
    })
    .first();

  if (!rule) {
    // No approval rule exists, auto-approve immediately!
    if (moduleName === "purchase_orders") {
      await trx("purchase_orders").where("id", resourceId).update({ status: "Approved" });
    } else if (moduleName === "indents") {
      await trx("indents").where("id", resourceId).update({ status: "approved" });
    }
    return null;
  }

  // Create pending approval request
  const [request] = await trx("approval_requests")
    .insert({
      module: moduleName,
      resource_id: resourceId,
      status: "pending",
      current_sequence: 1,
      created_by: creatorUserId
    })
    .returning("*");

  // Send pending notification to the role required for step 1
  await sendNotification({
    recipient_role_id: rule.role_id,
    title: "New Approval Required",
    message: `A new ${moduleName} request (ID: ${resourceId}) awaits your approval.`,
    type: "approval_pending",
    severity: "info",
    metadata: { module: moduleName, resource_id: resourceId, request_id: request.id }
  });

  return request;
}

// Triggered after an indent is fully approved. Delegates the actual stock
// matching/deduction/issued_qty bookkeeping to the SAME engine issuanceController
// uses (item_code match + unit conversion + FIFO), so there is exactly one
// source of truth for how stock gets deducted — not a second parallel one that
// disagreed on matching rules, units, and indent_items.issued_qty tracking.
async function autoIssueFromIndent(indentId) {
  const db = require("../db");
  const indent = await db("indents").where("id", indentId).first();
  if (!indent || !["approved", "partial"].includes(indent.status)) return;

  const indentItems = await db("indent_items").where("indent_id", indentId);
  const pendingItems = indentItems.filter((it) => parseFloat(it.issued_qty || 0) < parseFloat(it.qty));
  if (!pendingItems.length) return;

  const systemUser = await db("users").where("email", "system@kapila.local").first();
  const adminRole = await db("roles").where({ key: "admin" }).first();
  const fallbackUserId = systemUser?.id
    || (adminRole ? (await db("user_roles").where({ role_id: adminRole.id }).first())?.user_id : null);
  if (!fallbackUserId) return; // no user context to attribute the issuance to — skip safely

  const { getConversionMultiplier } = require("../utils/units");
  const issuanceController = require("./issuanceController");

  // Pre-check availability per item so a single shortfall doesn't block every
  // other item in the indent (issuanceController.create is all-or-nothing).
  const shortfalls = [];
  const coveredItems = [];
  for (const it of pendingItems) {
    const remainingQty = parseFloat(it.qty) - parseFloat(it.issued_qty || 0);
    const batches = await db("stock")
      .where((qb) => {
        if (it.item_code) qb.where("item_code", it.item_code);
        else qb.whereRaw("LOWER(name) = LOWER(?)", [it.name]);
      })
      .andWhere("remaining", ">", 0);
    const stockUnit = batches[0]?.unit || it.unit;
    const multiplier = getConversionMultiplier(it.unit || stockUnit, stockUnit, it.name) ?? 1;
    const available = batches.reduce((s, b) => s + parseFloat(b.remaining), 0);
    if (available >= remainingQty * multiplier) {
      const unitPrice = parseFloat(batches[0]?.price || 0);
      coveredItems.push({ name: it.name, qty: remainingQty, issued: remainingQty, unit: it.unit, item_code: it.item_code, unit_price: unitPrice });
    } else {
      shortfalls.push({ name: it.name, requested: remainingQty, available: parseFloat((available / multiplier).toFixed(3)), unit: it.unit });
    }
  }

  if (!coveredItems.length) {
    await sendNotification({
      title: "Auto-Issue Failed — No Stock",
      message: `Indent #${indentId} (${indent.dept}) approved but no items could be issued: ${shortfalls.map((s) => s.name).join(", ")} are short.`,
      type: "issuance_shortfall",
      severity: "critical",
      metadata: { indent_id: indentId, shortfalls },
    });
    return;
  }

  const fakeReq = {
    user: { id: fallbackUserId, isAdmin: true, isManager: false, permissions: new Set(["issuances.create"]) },
    body: { indent_id: indentId, dept: indent.dept, date: new Date().toISOString().slice(0, 10), scanned: false, items: coveredItems },
  };
  let result = null;
  const fakeRes = {
    status() { return this; },
    json(payload) { result = payload; return this; },
  };

  try {
    await issuanceController.create(fakeReq, fakeRes, (err) => { throw err; });
  } catch (err) {
    // Insufficient stock or unit mismatch on at least one item — notify and stop.
    // The indent stays approved/partial so a human can top up and re-trigger manually.
    await sendNotification({
      title: "Auto-Issue Failed",
      message: `Indent #${indentId} (${indent.dept}) approved but auto-issue failed: ${err.message}`,
      type: "issuance_shortfall",
      severity: "critical",
      metadata: { indent_id: indentId, error: err.message },
    });
    return;
  }

  if (result && result.success) {
    if (shortfalls.length) {
      const lines = shortfalls.map((s) => `${s.name}: requested ${s.requested}${s.unit}, available ${s.available}${s.unit}`).join("; ");
      await sendNotification({
        title: "Auto-Issue Partial — Stock Shortfall",
        message: `Indent #${indentId} (${indent.dept}) was partially issued. Shortfall: ${lines}. Manual top-up required.`,
        type: "issuance_shortfall",
        severity: "warning",
        metadata: { indent_id: indentId, issuance_id: result.data?.id, shortfalls },
      });
    } else {
      await sendNotification({
        recipient_user_id: indent.created_by || null,
        title: "Indent Auto-Issued",
        message: `Indent #${indentId} (${indent.dept}) was auto-issued after approval.`,
        type: "approval_action",
        severity: "success",
        metadata: { indent_id: indentId, issuance_id: result.data?.id },
      });
    }
  }
}

async function whatsappWebhook(req, res, next) {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) {
      return res.status(400).json({ success: false, error: "From and Body are required." });
    }

    const match = Body.trim().match(/^(approve|reject)\s+(?:indent\s+|po\s+)?(\d+)/i);
    if (!match) {
      return res.status(400).json({ success: false, error: "Invalid command format. Expected: 'Approve [ID]' or 'Reject [ID]'" });
    }

    const action = match[1].toLowerCase();
    const id = parseInt(match[2], 10);

    // Phone number must belong to a known, active user — no fallback to "any
    // store manager" or "first user in DB". Unauthenticated approval by phone
    // number alone must not be able to impersonate an arbitrary approver.
    const normalizedFrom = String(From).replace(/^whatsapp:/i, "").trim();
    const user = await db("users").where("phone", normalizedFrom).andWhere("is_active", true).first();

    if (!user) {
      return res.status(403).json({ success: false, error: "Unrecognized or inactive sender." });
    }

    let request = await db("approval_requests")
      .where("status", "pending")
      .andWhere(qb => qb.where("id", id).orWhere("resource_id", id))
      .first();

    if (!request) {
      return res.status(404).json({ success: false, error: `No pending approval request found for ID/Resource ID ${id}.` });
    }

    req.user = user;
    req.params = { id: request.id };
    req.body = { notes: "Approved via WhatsApp" };

    if (action === "approve") {
      return approveRequest(req, res, next);
    } else {
      return rejectRequest(req, res, next);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPending,
  listRules,
  createRule,
  updateRule,
  removeRule,
  approveRequest,
  rejectRequest,
  delegateRequest,
  bulkAction,
  createApprovalRequest,
  whatsappWebhook
};
