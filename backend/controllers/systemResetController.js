const db = require("../db");
const { auditLog } = require("../services/auditService");
const catalogSeedService = require("../services/catalogSeedService");

// Each group lists real tables (verified against backend/db/migrations).
// Tables are ordered child-first so any manual FK cleanup reads naturally,
// though TRUNCATE ... CASCADE handles ordering regardless.
// NOTE: users, roles, permissions, role_permissions, user_roles, user_departments,
// refresh_tokens, store_sessions, password_reset_tokens are intentionally
// NEVER included in any group — admin must never be able to nuke login access.
const RESETTABLE_GROUPS = {
  purchase_procurement: {
    label: "Purchase & Procurement",
    description: "Purchase orders, goods receipts, suppliers and supplier rate quotes.",
    tables: [
      "purchase_order_items",
      "purchase_orders",
      "goods_receipt_items",
      "goods_receipt_notes",
      "supplier_rate_quotes",
      "suppliers",
    ],
  },
  indents_issuances: {
    label: "Indents & Issuances",
    description: "Indents, issuances and indent templates.",
    tables: [
      "indent_items",
      "indents",
      "issuance_items",
      "issuances",
      "indent_templates",
    ],
  },
  stock_adjustments: {
    label: "Stock & Adjustments",
    description: "Stock levels, stock adjustments, stock aliases and the chef-facing indent catalog (subcategories/items) shown on department tiles and indent screens.",
    tables: [
      "stock_adjustments",
      "stock_aliases",
      "stock",
      "indent_subcategory_items",
      "indent_subcategories",
    ],
  },
  production_leftovers: {
    label: "Production & Leftovers",
    description: "Production runs, production plans and leftovers.",
    tables: [
      "production_plan_items",
      "production_plans",
      "production",
      "leftovers",
    ],
  },
  recipes_menu: {
    label: "Recipes & Menu",
    description: "Recipes, recipe cost snapshots and menu plans.",
    tables: [
      "recipe_items",
      "recipe_cost_snapshots",
      "recipes",
      "menu_plans",
    ],
  },
  audit: {
    label: "Audit",
    description: "Stock audit sessions, counted items and anomaly alerts.",
    tables: [
      "audit_items",
      "audit_sessions",
      "anomaly_alerts",
    ],
  },
  notifications_approvals: {
    label: "Notifications & Approvals",
    description: "Notifications, approval requests and approval rules.",
    tables: [
      "notifications",
      "approval_requests",
      "approval_rules",
    ],
  },
  transfers_reorder: {
    label: "Transfers & Reorder Points",
    description: "Stock transfers and reorder points.",
    tables: [
      "stock_transfer_items",
      "stock_transfers",
      "reorder_points",
    ],
  },
};

async function tableExists(tableName) {
  return db.schema.hasTable(tableName);
}

async function getRowCount(tableName) {
  try {
    const row = await db(tableName).count({ count: "*" }).first();
    return Number(row && row.count) || 0;
  } catch (err) {
    return null;
  }
}

// GET /api/system-reset/groups
async function listResettableGroups(req, res, next) {
  try {
    const groups = [];
    for (const [key, group] of Object.entries(RESETTABLE_GROUPS)) {
      const tables = [];
      for (const table of group.tables) {
        const exists = await tableExists(table);
        const rowCount = exists ? await getRowCount(table) : null;
        tables.push({ table, exists, rowCount });
      }
      groups.push({
        key,
        label: group.label,
        description: group.description,
        tables,
        totalRows: tables.reduce((sum, t) => sum + (t.rowCount || 0), 0),
      });
    }
    return res.json({ success: true, data: groups });
  } catch (err) {
    return next(err);
  }
}

// POST /api/system-reset
// body: { groups: ["purchase_procurement", ...], confirmText: "RESET" }
async function resetGroups(req, res, next) {
  try {
    const { groups, confirmText } = req.body || {};

    if (confirmText !== "RESET") {
      return res.status(400).json({
        success: false,
        error: "Confirmation failed. Send confirmText: \"RESET\" to proceed.",
      });
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ success: false, error: "No groups selected." });
    }

    const invalidGroups = groups.filter((g) => !RESETTABLE_GROUPS[g]);
    if (invalidGroups.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unknown group(s): ${invalidGroups.join(", ")}`,
      });
    }

    const selectedTables = [];
    for (const groupKey of groups) {
      for (const table of RESETTABLE_GROUPS[groupKey].tables) {
        if (!selectedTables.includes(table)) selectedTables.push(table);
      }
    }

    const actor = req.user || {};
    const result = await db.transaction(async (trx) => {
      const truncated = [];
      for (const table of selectedTables) {
        const exists = await trx.schema.hasTable(table);
        if (!exists) continue;
        await trx.raw(`TRUNCATE TABLE ?? RESTART IDENTITY CASCADE`, [table]);
        truncated.push(table);
      }

      await trx("audit_logs").insert({
        actor_user_id: actor.id || null,
        actor_name: actor.name || actor.username || null,
        action: "system.reset",
        resource: "system",
        resource_id: null,
        metadata: JSON.stringify({
          groups,
          tables: truncated,
          confirmedAt: new Date().toISOString(),
        }),
        created_at: new Date(),
      });

      return truncated;
    });

    return res.json({
      success: true,
      data: {
        groups,
        truncatedTables: result,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// POST /api/system-reset/restore-catalog
// Re-seeds indent_subcategories / indent_subcategory_items (migration 065)
// and indent_templates (migration 054) from their original migration seed
// data. Idempotent: safe to call repeatedly, never duplicates existing rows.
async function restoreCatalog(req, res, next) {
  try {
    const result = await catalogSeedService.restoreFullCatalog();

    await auditLog(req, {
      action: "system.restore_catalog",
      resource: "system",
      metadata: {
        restored: result,
        confirmedAt: new Date().toISOString(),
      },
    });

    return res.json({
      success: true,
      data: {
        subcategoriesInserted: result.subcategoriesInserted,
        itemsInserted: result.itemsInserted,
        templatesInserted: result.templatesInserted,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  RESETTABLE_GROUPS,
  listResettableGroups,
  resetGroups,
  restoreCatalog,
};
