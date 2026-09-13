const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

/**
 * GET /api/search?q=po&modules=stock,purchase_orders,suppliers,indents,issuances,assets,reorder
 * Multi-Agent OmniSearch engine: 2-letter minimum, prefix-boosted cross-domain search.
 */
async function globalSearch(req, res, next) {
  try {
    const { q, modules } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Query must be at least 2 characters" });
    }

    const cleanQ = q.trim();
    const exactPrefix = `${cleanQ}%`;
    const wildcard = `%${cleanQ}%`;

    const isAdmin = req.user?.isAdmin || false;
    const permissions = req.user?.permissions || new Set();

    const allowedModules = [];
    if (isAdmin || permissions.has("stock.view")) allowedModules.push("stock");
    if (isAdmin || permissions.has("purchase_orders.view")) allowedModules.push("purchase_orders");
    if (isAdmin || permissions.has("suppliers.view")) allowedModules.push("suppliers");
    if (isAdmin || permissions.has("indents.view")) allowedModules.push("indents");
    if (isAdmin || permissions.has("issuances.view")) allowedModules.push("issuances");
    if (isAdmin || permissions.has("maintenance.view")) allowedModules.push("assets");
    if (isAdmin || permissions.has("reorder_points.view")) allowedModules.push("reorder");
    if (isAdmin || permissions.has("production.view")) allowedModules.push("production");
    if (isAdmin || permissions.has("leftovers.view")) allowedModules.push("leftovers");

    const requested = modules
      ? modules.split(",").map((m) => m.trim()).filter((m) => allowedModules.includes(m))
      : allowedModules;

    const deptNames = !isAdmin ? await getDepartmentNames(req.user) : null;
    const searchPromises = [];

    // 1. Stock / Inventory Items
    if (requested.includes("stock")) {
      searchPromises.push(
        db("stock")
          .whereRaw("name ILIKE ? OR item_code ILIKE ? OR category ILIKE ?", [wildcard, wildcard, wildcard])
          .select(
            "id",
            "name AS label",
            "item_code",
            "category",
            "remaining",
            "unit",
            "price",
            "rack_location",
            db.raw("'stock' AS module"),
            db.raw("'stock' AS screen_id"),
            db.raw(`
              CASE 
                WHEN name ILIKE ? THEN 100
                WHEN item_code ILIKE ? THEN 90
                WHEN name ILIKE ? THEN 70
                ELSE 40
              END AS rank
            `, [exactPrefix, exactPrefix, wildcard])
          )
          .orderBy("rank", "desc")
          .limit(15)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Code: ${r.item_code || "N/A"} · In Stock: ${r.remaining ?? 0} ${r.unit || ""} · ${r.category || "General"}`,
              badge: "Stock Item"
            }))
          )
      );
    }

    // 2. Purchase Orders
    if (requested.includes("purchase_orders")) {
      searchPromises.push(
        db("purchase_orders")
          .leftJoin("suppliers", "suppliers.id", "purchase_orders.supplier_id")
          .whereRaw(
            "purchase_orders.po_number ILIKE ? OR suppliers.name ILIKE ? OR purchase_orders.status ILIKE ?",
            [wildcard, wildcard, wildcard]
          )
          .select(
            "purchase_orders.id",
            "purchase_orders.po_number AS label",
            "suppliers.name AS supplier_name",
            "purchase_orders.status",
            "purchase_orders.total_amount",
            "purchase_orders.date",
            db.raw("'purchase_orders' AS module"),
            db.raw("'pos' AS screen_id"),
            db.raw(`
              CASE 
                WHEN purchase_orders.po_number ILIKE ? THEN 100
                WHEN suppliers.name ILIKE ? THEN 85
                ELSE 50
              END AS rank
            `, [exactPrefix, exactPrefix])
          )
          .orderBy("rank", "desc")
          .limit(12)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `${r.supplier_name || "Supplier"} · ₹${parseFloat(r.total_amount || 0).toLocaleString("en-IN")} · ${r.status}`,
              badge: `PO (${r.status})`
            }))
          )
      );
    }

    // 3. Vendors & Suppliers
    if (requested.includes("suppliers")) {
      searchPromises.push(
        db("suppliers")
          .whereRaw(
            "name ILIKE ? OR contact_name ILIKE ? OR phone ILIKE ? OR gstin ILIKE ?",
            [wildcard, wildcard, wildcard, wildcard]
          )
          .select(
            "id",
            "name AS label",
            "contact_name",
            "phone",
            "rating",
            "gstin",
            db.raw("'suppliers' AS module"),
            db.raw("'suppliers' AS screen_id"),
            db.raw(`
              CASE 
                WHEN name ILIKE ? THEN 100
                WHEN contact_name ILIKE ? THEN 80
                ELSE 50
              END AS rank
            `, [exactPrefix, exactPrefix])
          )
          .orderBy("rank", "desc")
          .limit(10)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `${r.contact_name || "Primary Contact"} · ${r.phone || "No Phone"} · ${r.rating ? `${r.rating}★` : "Unrated"}`,
              badge: "Vendor"
            }))
          )
      );
    }

    // 4. Indents & Department Requisitions
    if (requested.includes("indents")) {
      const qb = db("indent_items AS ii")
        .join("indents AS ind", "ind.id", "ii.indent_id")
        .whereRaw("ii.name ILIKE ? OR ind.dept ILIKE ?", [wildcard, wildcard]);

      if (!isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("ind.dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searchPromises.push(
        qb.select(
          "ind.id",
          "ii.name AS label",
          "ind.dept",
          "ind.date",
          "ind.status",
          db.raw("'indents' AS module"),
          db.raw("'indent' AS screen_id"),
          db.raw(`
            CASE 
              WHEN ii.name ILIKE ? THEN 95
              ELSE 55
            END AS rank
          `, [exactPrefix])
        )
          .orderBy("rank", "desc")
          .limit(10)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Dept: ${r.dept} · Indent #${r.id} · ${r.date ? new Date(r.date).toISOString().slice(0, 10) : ""}`,
              badge: "Indent Item"
            }))
          )
      );
    }

    // 5. Store Issuances
    if (requested.includes("issuances")) {
      const qb = db("issuance_items AS ii")
        .join("issuances AS iss", "iss.id", "ii.issuance_id")
        .whereRaw("ii.name ILIKE ? OR iss.dept ILIKE ?", [wildcard, wildcard]);

      if (!isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("iss.dept", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }

      searchPromises.push(
        qb.select(
          "iss.id",
          "ii.name AS label",
          "iss.dept",
          "iss.date",
          db.raw("'issuances' AS module"),
          db.raw("'issuance' AS screen_id"),
          db.raw(`
            CASE 
              WHEN ii.name ILIKE ? THEN 95
              ELSE 55
            END AS rank
          `, [exactPrefix])
        )
          .orderBy("rank", "desc")
          .limit(10)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Issued to: ${r.dept} · #${r.id} · ${r.date ? new Date(r.date).toISOString().slice(0, 10) : ""}`,
              badge: "Issuance Item"
            }))
          )
      );
    }

    // 6. Hotel & Kitchen Assets (CMMS)
    if (requested.includes("assets")) {
      searchPromises.push(
        db("hotel_assets")
          .whereRaw(
            "name ILIKE ? OR asset_code ILIKE ? OR category ILIKE ? OR department ILIKE ?",
            [wildcard, wildcard, wildcard, wildcard]
          )
          .select(
            "id",
            "name AS label",
            "asset_code",
            "department",
            "category",
            "status",
            db.raw("'assets' AS module"),
            db.raw("'maintenance' AS screen_id"),
            db.raw(`
              CASE 
                WHEN name ILIKE ? THEN 100
                WHEN asset_code ILIKE ? THEN 90
                ELSE 50
              END AS rank
            `, [exactPrefix, exactPrefix])
          )
          .orderBy("rank", "desc")
          .limit(10)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `${r.asset_code} · ${r.department} · ${r.status}`,
              badge: "Kitchen Asset"
            }))
          )
      );
    }

    // 7. Reorder Points
    if (requested.includes("reorder")) {
      searchPromises.push(
        db("reorder_points")
          .whereRaw("name ILIKE ? OR item_code ILIKE ?", [wildcard, wildcard])
          .select(
            "id",
            "name AS label",
            "item_code",
            "min_qty",
            db.raw("'reorder' AS module"),
            db.raw("'reorder' AS screen_id"),
            db.raw(`
              CASE 
                WHEN name ILIKE ? THEN 95
                ELSE 50
              END AS rank
            `, [exactPrefix])
          )
          .orderBy("rank", "desc")
          .limit(10)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Min Alert Level: ${r.min_qty} · Code: ${r.item_code || "N/A"}`,
              badge: "Reorder Point"
            }))
          )
      );
    }

    // 8. Leftovers
    if (requested.includes("leftovers")) {
      const qb = db("leftovers").whereRaw("item ILIKE ? OR dept ILIKE ?", [wildcard, wildcard]);
      if (!isAdmin && deptNames?.length) qb.whereIn("dept", deptNames);

      searchPromises.push(
        qb.select(
          "id",
          "item AS label",
          "dept",
          "date",
          db.raw("'leftovers' AS module"),
          db.raw("'leftovers' AS screen_id"),
          db.raw("50 AS rank")
        )
          .limit(8)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Leftover · Dept: ${r.dept} · ${r.date ? new Date(r.date).toISOString().slice(0, 10) : ""}`,
              badge: "Leftover"
            }))
          )
      );
    }

    // 9. Production
    if (requested.includes("production")) {
      const qb = db("production").whereRaw("notes ILIKE ? OR dept ILIKE ?", [wildcard, wildcard]);
      if (!isAdmin && deptNames?.length) qb.whereIn("dept", deptNames);

      searchPromises.push(
        qb.select(
          "id",
          "notes AS label",
          "dept",
          "date",
          db.raw("'production' AS module"),
          db.raw("'production' AS screen_id"),
          db.raw("50 AS rank")
        )
          .limit(8)
          .then((rows) =>
            rows.map((r) => ({
              ...r,
              sublabel: `Production · Dept: ${r.dept} · ${r.date ? new Date(r.date).toISOString().slice(0, 10) : ""}`,
              badge: "Production"
            }))
          )
      );
    }

    const domainResults = await Promise.all(searchPromises);
    const combined = domainResults.flat().sort((a, b) => (b.rank || 0) - (a.rank || 0));

    const categorized = {
      stock: [],
      purchase_orders: [],
      suppliers: [],
      assets: [],
      indents: [],
      issuances: [],
      reorder: [],
      leftovers: [],
      production: []
    };

    combined.forEach((item) => {
      if (categorized[item.module]) {
        categorized[item.module].push(item);
      }
    });

    res.json({
      success: true,
      query: cleanQ,
      total: combined.length,
      data: combined.slice(0, 50),
      categories: categorized
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { globalSearch };
