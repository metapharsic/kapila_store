const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

// GET /api/search?q=rice&modules=stock,indents,issuances,production,leftovers
// Full-text search across all modules in one shot
async function globalSearch(req, res, next) {
  try {
    const { q, modules } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Query must be at least 2 characters" });
    }

    const allowedModules = [];
    if (req.user.isAdmin || req.user.permissions.has("stock.view")) allowedModules.push("stock");
    if (req.user.isAdmin || req.user.permissions.has("indents.view")) allowedModules.push("indents");
    if (req.user.isAdmin || req.user.permissions.has("issuances.view")) allowedModules.push("issuances");
    if (req.user.isAdmin || req.user.permissions.has("production.view")) allowedModules.push("production");
    if (req.user.isAdmin || req.user.permissions.has("leftovers.view")) allowedModules.push("leftovers");

    const requested = (modules ? modules.split(",") : ["stock", "indents", "issuances", "production", "leftovers"])
      .filter((m) => allowedModules.includes(m));

    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;
    const searches = [];

    if (requested.includes("stock")) {
      searches.push(
        db("stock")
          .whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q])
          .select(
            db.raw("'stock' AS module"),
            "id", "name AS label",
            db.raw("NULL AS dept"),
            "date",
            db.raw("ts_rank(search_vec, plainto_tsquery('english', ?)) AS rank", [q])
          )
      );
    }

    if (requested.includes("indents")) {
      const qb = db("indent_items AS ii")
        .join("indents AS ind", "ind.id", "ii.indent_id")
        .whereRaw("ii.search_vec @@ plainto_tsquery('english', ?)", [q]);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("ind.dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searches.push(
        qb.select(
          db.raw("'indents' AS module"),
          "ind.id",
          "ii.name AS label",
          "ind.dept",
          "ind.date",
          db.raw("ts_rank(ii.search_vec, plainto_tsquery('english', ?)) AS rank", [q])
        )
      );
    }

    if (requested.includes("issuances")) {
      const qb = db("issuance_items AS ii")
        .join("issuances AS iss", "iss.id", "ii.issuance_id")
        .whereRaw("ii.search_vec @@ plainto_tsquery('english', ?)", [q]);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("iss.dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searches.push(
        qb.select(
          db.raw("'issuances' AS module"),
          "iss.id",
          "ii.name AS label",
          "iss.dept",
          "iss.date",
          db.raw("ts_rank(ii.search_vec, plainto_tsquery('english', ?)) AS rank", [q])
        )
      );
    }

    if (requested.includes("production")) {
      const qb = db("production")
        .whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q]);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searches.push(
        qb.select(
          db.raw("'production' AS module"),
          "id",
          "notes AS label",
          "dept",
          "date",
          db.raw("ts_rank(search_vec, plainto_tsquery('english', ?)) AS rank", [q])
        )
      );
    }

    if (requested.includes("leftovers")) {
      const qb = db("leftovers")
        .whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q]);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searches.push(
        qb.select(
          db.raw("'leftovers' AS module"),
          "id",
          "item AS label",
          "dept",
          "date",
          db.raw("ts_rank(search_vec, plainto_tsquery('english', ?)) AS rank", [q])
        )
      );
    }

    if (!searches.length) {
      return res.json({ success: true, data: [], total: 0 });
    }

    // UNION ALL then sort by rank desc
    let union = searches[0];
    for (let i = 1; i < searches.length; i++) {
      union = union.unionAll(searches[i]);
    }

    const results = await db.from(union.as("combined"))
      .select("*")
      .orderBy("rank", "desc")
      .limit(50);

    res.json({ success: true, data: results, total: results.length, query: q });
  } catch (err) { next(err); }
}

module.exports = { globalSearch };
