const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

// GET /api/departments
async function list(req, res, next) {
  try {
    let query = db("departments").select("*").orderBy("name", "asc");
    if (!req.user.isAdmin && !req.user.isManager) {
      const deptNames = await getDepartmentNames(req.user);
      query.whereIn("name", deptNames);
    }
    const rows = await query;
    res.json({ success: true, data: rows });
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
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await db("departments").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found." });
    }

    // Check if linked to indents
    const hasIndents = await db("indents").whereRaw("LOWER(dept) = LOWER(?)", [existing.name]).first();
    if (hasIndents) {
      return res.status(400).json({ success: false, error: "Cannot delete department. It is linked to existing Indents." });
    }

    // Check if linked to issuances
    const hasIssuances = await db("issuances").whereRaw("LOWER(dept) = LOWER(?)", [existing.name]).first();
    if (hasIssuances) {
      return res.status(400).json({ success: false, error: "Cannot delete department. It is linked to existing Issuances." });
    }

    await db("departments").where("id", id).del();
    res.json({ success: true, message: "Department deleted successfully." });
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
      const dept = (r.template_name || "").trim().toUpperCase();
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

module.exports = { list, create, update, remove, getDepartmentItems, addItemToDepartmentTemplate };

