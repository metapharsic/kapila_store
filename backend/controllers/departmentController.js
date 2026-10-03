const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

const DEPT_METADATA = {
  'TIFFINS': { icon: '🥞', color: '#e8a838', bg: 'rgba(232, 168, 56, 0.14)', desc: 'Breakfast, Idli, Dosa & Batter' },
  'STAFF': { icon: '👥', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)', desc: 'Staff Kitchen Meals & Rations' },
  'SI-MEALS': { icon: '🍛', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', desc: 'South Indian Thali, Sambar & Dal' },
  'NORTH INDIAN': { icon: '🥘', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', desc: 'Gravies, Paneer, Roti & Biryani' },
  'CHAT & SOFTY': { icon: '🍦', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)', desc: 'Chaat, Softies & JP Disposables' },
  'CHINESE & DOSA': { icon: '🍜', color: '#f97316', bg: 'rgba(249, 115, 22, 0.14)', desc: 'Noodles, Fried Rice & Special Dosas' },
  'MOCKTAILS & CONTINENTAL': { icon: '🍹', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)', desc: 'Mocktails, Shakes, Pizzas & Pastas' },
  'RESTAURANT': { icon: '🍽️', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.14)', desc: 'Main Dining Service & Dairy' },
  'ROOM SERVICE': { icon: '🛎️', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)', desc: 'In-Room Dining Orders & Supplies' },
};

// GET /api/departments
async function list(req, res, next) {
  try {
    let deptQuery = db("departments").select("*").orderBy("id", "asc");
    if (!req.user.isAdmin && !req.user.isManager) {
      const deptNames = await getDepartmentNames(req.user);
      deptQuery.whereIn("name", deptNames);
    }

    // Parallel multi-thread queries: departments and live item counts from subcategories
    const [rows, itemCounts] = await Promise.all([
      deptQuery,
      db("indent_subcategories as s")
        .join("indent_subcategory_items as i", "s.id", "i.subcategory_id")
        .groupBy("s.department_name")
        .select("s.department_name")
        .count("i.id as count")
    ]);

    const countMap = {};
    itemCounts.forEach(c => {
      countMap[(c.department_name || "").toUpperCase()] = parseInt(c.count, 10);
    });

    const enriched = rows.map((r) => {
      const upperName = (r.name || "").toUpperCase();
      const meta = DEPT_METADATA[upperName] || {
        icon: '🍽️',
        color: '#e8a838',
        bg: 'rgba(232, 168, 56, 0.14)',
        desc: `${r.name} Kitchen Station`
      };
      const itemsCount = countMap[upperName] || 0;
      return {
        ...r,
        itemsCount,
        items_count: itemsCount,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg,
        desc: meta.desc,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

// GET /api/departments/chef-config
async function getChefConfig(req, res, next) {
  try {
    // Run multi-threaded queries for all dynamic configurations from DB
    const [depts, stockUnits, indentUnits, subcatUnits, itemCounts] = await Promise.all([
      db("departments").select("*").orderBy("id", "asc"),
      db("stock").distinct("unit").whereNotNull("unit"),
      db("indent_items").distinct("unit").whereNotNull("unit"),
      db("indent_subcategory_items").distinct("unit").whereNotNull("unit"),
      db("indent_subcategories as s")
        .join("indent_subcategory_items as i", "s.id", "i.subcategory_id")
        .groupBy("s.department_name")
        .select("s.department_name")
        .count("i.id as count")
    ]);

    const countMap = {};
    itemCounts.forEach(c => {
      countMap[(c.department_name || "").toUpperCase()] = parseInt(c.count, 10);
    });

    const enrichedDepts = depts.map((r) => {
      const upperName = (r.name || "").toUpperCase();
      const meta = DEPT_METADATA[upperName] || {
        icon: '🍽️',
        color: '#e8a838',
        bg: 'rgba(232, 168, 56, 0.14)',
        desc: `${r.name} Kitchen Station`
      };
      const itemsCount = countMap[upperName] || 0;
      return {
        ...r,
        itemsCount,
        items_count: itemsCount,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg,
        desc: meta.desc,
      };
    });

    // Extract unique normalized units from DB
    const unitSet = new Set(["KG", "GM", "LTR", "ML", "PCS", "PACK", "BOTTLE", "BOX", "TIN", "BUNDLE", "CAN"]);
    [...stockUnits, ...indentUnits, ...subcatUnits].forEach(u => {
      if (u.unit) unitSet.add(u.unit.trim().toUpperCase());
    });
    const units = Array.from(unitSet).sort();

    const tabs = [
      { id: 'catalog', label: '📋 Predefined Indent', icon: 'ClipboardList', key: 'catalog_items' },
      { id: 'required', label: '🚨 Critical Radar', icon: 'AlertTriangle', key: 'critical_items' },
      { id: 'disposables', label: '📦 Packaging & Disposables', icon: 'Package', key: 'disposables' },
      { id: 'recipes', label: '🍲 Recipe Demand', icon: 'Utensils', key: 'station_recipes' }
    ];

    const priorities = [
      { value: 'NORMAL', label: 'Routine (Standard)', color: '#10b981' },
      { value: 'URGENT', label: 'Urgent (Morning Prep)', color: '#f59e0b' },
      { value: 'EMERGENCY', label: 'Emergency Shortage', color: '#ef4444' }
    ];

    const shifts = [
      { value: 'NIGHT_INDENT', label: 'Night Replenishment' },
      { value: 'MORNING', label: 'Morning 6 AM Prep' },
      { value: 'EVENING', label: 'Evening 4 PM Service' }
    ];

    const quickIncrements = [1, 5, 10, 25, 50, 100];

    const dockConfig = {
      mode: 'right',
      width: 500,
      floatPos: { x: 40, y: 80 },
      isMinimized: false,
      sheetHeight: 'half'
    };

    res.json({
      success: true,
      departments: enrichedDepts,
      tabs,
      units,
      priorities,
      shifts,
      quickIncrements,
      dockConfig
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/departments
async function create(req, res, next) {
  try {
    const { name, code, chef_name } = req.body;
    
    // Check duplicates
    const duplicate = await db("departments")
      .whereRaw("LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)", [name.trim(), code.trim()])
      .first();
      
    if (duplicate) {
      return res.status(400).json({ success: false, error: "Department name or code already exists." });
    }

    const [row] = await db("departments")
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        chef_name: chef_name ? chef_name.trim() : null
      })
      .returning("*");

    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/departments/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, chef_name } = req.body;

    const existing = await db("departments").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found." });
    }

    if (name || code) {
      const checkName = name ? name.trim() : existing.name;
      const checkCode = code ? code.trim().toUpperCase() : existing.code;

      const duplicate = await db("departments")
        .where((qb) => {
          qb.whereRaw("LOWER(name) = LOWER(?)", [checkName])
            .orWhereRaw("LOWER(code) = LOWER(?)", [checkCode]);
        })
        .whereNot("id", id)
        .first();

      if (duplicate) {
        return res.status(400).json({ success: false, error: "Another department with this name or code already exists." });
      }
    }

    const [updatedRow] = await db("departments")
      .where("id", id)
      .update({
        name: name ? name.trim() : existing.name,
        code: code ? code.trim().toUpperCase() : existing.code,
        chef_name: chef_name !== undefined ? (chef_name ? chef_name.trim() : null) : existing.chef_name
      })
      .returning("*");

    res.json({ success: true, data: updatedRow });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/departments/:id
// Blocks deletion whenever any dependent data references this department,
// either by FK (user_departments) or by stored name string (indents,
// issuances, production, leftovers, stock_ledger, indent_subcategories,
// indent_templates) - a hard-delete is only allowed when all of these are
// empty, so we never silently orphan references or rely on an ON DELETE
// CASCADE to quietly wipe out unrelated rows (e.g. user_departments).
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await db("departments").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found." });
    }

    const byName = (table, col = "dept") =>
      db(table).whereRaw(`LOWER(${col}) = LOWER(?)`, [existing.name]).first();

    const [
      hasIndents,
      hasIssuances,
      hasProduction,
      hasLeftovers,
      hasLedgerMovements,
      hasSubcategories,
      hasTemplateItems,
      hasAssignedUsers,
    ] = await Promise.all([
      byName("indents"),
      byName("issuances"),
      byName("production"),
      byName("leftovers"),
      byName("stock_ledger", "department"),
      byName("indent_subcategories", "department_name"),
      byName("indent_templates", "template_name"),
      db("user_departments").where("department_id", id).first(),
    ]);

    const blockers = [];
    if (hasIndents) blockers.push("Indents");
    if (hasIssuances) blockers.push("Issuances");
    if (hasProduction) blockers.push("Production records");
    if (hasLeftovers) blockers.push("Leftover records");
    if (hasLedgerMovements) blockers.push("Stock Ledger movements");
    if (hasSubcategories) blockers.push("Indent Subcategories/Items");
    if (hasTemplateItems) blockers.push("Department Item Templates");
    if (hasAssignedUsers) blockers.push("Assigned Users");

    if (blockers.length) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete department. It is linked to existing ${blockers.join(", ")}.`,
        blockers,
      });
    }

    await db("departments").where("id", id).del();
    res.json({ success: true, message: "Department deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// GET /api/departments/item-counts
// Single GROUP BY query returning a live item count per department, keyed by
// department name (uppercased) to match frontend DEPARTMENT_TILES.name.
async function getDepartmentItemCounts(req, res, next) {
  try {
    const itemCounts = await db("indent_subcategories as s")
      .join("indent_subcategory_items as i", "s.id", "i.subcategory_id")
      .groupBy("s.department_name")
      .select("s.department_name")
      .count("i.id as count");

    const data = itemCounts.map((c) => {
      const name = (c.department_name || "").trim().toUpperCase();
      return { name, item_count: parseInt(c.count, 10) };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/departments/summary
// Single lightweight endpoint for the frontend's header stat cards, so it
// doesn't need to fan out into N+1 calls. Computed entirely from real rows:
//   - total_departments: count of rows in `departments`
//   - total_items: count of indent_subcategory_items across all departments
//     (same join used by list()/getDepartmentItemCounts())
//   - total_consumption_value_30d: sum of stock_ledger.total_value for
//     OUTWARD_ISSUE movements in the trailing 30 days (same technique as
//     eodReportService's granular "department" mode: stock_ledger already
//     carries `department` as a plain column, so it's a straight GROUP BY).
async function getSummary(req, res, next) {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().slice(0, 19).replace("T", " ");

    const [deptCountRow, itemCountRow, consumptionRows] = await Promise.all([
      db("departments").count("id as count").first(),
      db("indent_subcategories as s")
        .join("indent_subcategory_items as i", "s.id", "i.subcategory_id")
        .count("i.id as count")
        .first(),
      db("stock_ledger")
        .where("transaction_type", "OUTWARD_ISSUE")
        .where("created_at", ">=", sinceStr)
        .groupBy("department")
        .select("department")
        .sum("total_value as value"),
    ]);

    const perDepartment = consumptionRows.map((r) => ({
      department: (r.department || "Unassigned").trim() || "Unassigned",
      consumption_value_30d: parseFloat(r.value) || 0,
    }));

    const totalConsumption = perDepartment.reduce((sum, r) => sum + r.consumption_value_30d, 0);

    res.json({
      success: true,
      data: {
        total_departments: parseInt(deptCountRow.count, 10) || 0,
        total_items: parseInt(itemCountRow.count, 10) || 0,
        total_consumption_value_30d: Math.round(totalConsumption * 100) / 100,
        by_department: perDepartment,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/departments/items
async function getDepartmentItems(req, res, next) {
  try {
    const templateRows = await db("indent_templates")
      .select("template_name", "item_name", "item_code", "default_unit")
      .orderBy("row_no", "asc");

    const mapping = {};
    templateRows.forEach((r) => {
      let dept = (r.template_name || "").trim().toUpperCase();
      if (dept === "SI- MEALS" || dept === "SI MEALS") dept = "SI-MEALS";
      if (dept === "CHAT, JP DISPOSAL, SOFTY." || dept === "CHAT") dept = "CHAT & SOFTY";
      if (!mapping[dept]) mapping[dept] = [];
      mapping[dept].push({
        name: r.item_name,
        unit: r.default_unit,
        item_code: r.item_code,
      });
    });

    res.json({ success: true, data: mapping });
  } catch (err) {
    next(err);
  }
}

// POST /api/departments/template-item
async function addItemToDepartmentTemplate(req, res, next) {
  try {
    const { department, item_name, item_code, default_unit = "kg", row_no } = req.body;
    if (!department || !item_name) {
      return res.status(400).json({ success: false, error: "Department and item_name are required." });
    }

    const deptRecord = await db("departments")
      .whereRaw("LOWER(name) = LOWER(?)", [department.trim()])
      .first();

    const canonicalDept = deptRecord ? deptRecord.name.toUpperCase() : department.trim().toUpperCase();

    // Verify or find item_code from stock if not supplied
    let finalCode = item_code ? item_code.trim().toUpperCase() : null;
    let finalUnit = default_unit ? default_unit.trim() : "kg";

    if (!finalCode) {
      const stockMatch = await db("stock")
        .whereRaw("LOWER(name) = LOWER(?)", [item_name.trim()])
        .first();
      if (stockMatch) {
        finalCode = stockMatch.item_code;
        if (!default_unit && stockMatch.unit) finalUnit = stockMatch.unit;
      } else {
        finalCode = "KPL-" + Math.floor(1000 + Math.random() * 9000);
      }
    }

    // Check duplicate in template
    const existing = await db("indent_templates")
      .whereRaw("LOWER(template_name) = LOWER(?) AND LOWER(item_name) = LOWER(?)", [canonicalDept, item_name.trim()])
      .first();

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: `Item '${item_name}' already exists in template for department '${canonicalDept}'.` 
      });
    }

    // Determine row_no if not provided
    let finalRowNo = row_no;
    if (!finalRowNo) {
      const lastRow = await db("indent_templates")
        .whereRaw("LOWER(template_name) = LOWER(?)", [canonicalDept])
        .max("row_no as max_row")
        .first();
      finalRowNo = (lastRow?.max_row || 0) + 1;
    }

    const [inserted] = await db("indent_templates")
      .insert({
        template_name: canonicalDept,
        row_no: finalRowNo,
        item_name: item_name.trim(),
        item_code: finalCode,
        default_unit: finalUnit
      })
      .returning("*");

    res.status(201).json({ 
      success: true, 
      data: inserted, 
      message: "Item added to department template successfully." 
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getChefConfig, create, update, remove, getDepartmentItems, getDepartmentItemCounts, getSummary, addItemToDepartmentTemplate };

