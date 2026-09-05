const db = require("../db");
const { sendNotification } = require("./notificationController");

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
  return roleIds.includes(rule.role_id);
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

    // Filter based on whether user's roles match the expected role for the current step
    const filtered = [];
    for (const reqObj of pending) {
      // Find matching rule for this sequence
      let amount = 0;
      if (reqObj.module === "purchase_orders") {
        const po = await db("purchase_orders").where("id", reqObj.resource_id).first();
        if (po) amount = parseFloat(po.total_amount || 0);
      }
      
      const rule = await db("approval_rules")
        .where("module", reqObj.module)
        .where("sequence", reqObj.current_sequence)
        .andWhere("min_amount", "<=", amount)
        .andWhere((qb) => {
          qb.whereNull("max_amount").orWhere("max_amount", ">=", amount);
        })
        .first();

      // If no rule matches, admin, or user has the role
      if (!rule || isAdmin || roleIds.includes(rule.role_id)) {
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
          resourceDetails = ind;
        }

        filtered.push({
          ...reqObj,
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
        await trx("approval_requests")
          .where({ id })
          .update({
            current_sequence: request.current_sequence + 1,
            notes: notes || request.notes,
            updated_at: trx.fn.now()
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
        await trx("approval_requests")
          .where({ id })
          .update({
            status: "approved",
            approved_by: userId,
            notes: notes || request.notes,
            updated_at: trx.fn.now()
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

    await db.transaction(async (trx) => {
      await trx("approval_requests")
        .where({ id })
        .update({
          status: "rejected",
          rejected_by: userId,
          notes: notes || null,
          updated_at: trx.fn.now()
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
    const multiplier = getConversionMultiplier(it.unit || stockUnit, stockUnit) ?? 1;
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
  createApprovalRequest,
  whatsappWebhook
};
