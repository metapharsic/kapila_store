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
    const path = require("path");
    const fs = require("fs");
    const jsonPath = path.join(__dirname, "../db/department_items.json");
    if (!fs.existsSync(jsonPath)) {
      return res.json({ success: true, data: {} });
    }
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const mapping = JSON.parse(raw);
    res.json({ success: true, data: mapping });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, getDepartmentItems };
