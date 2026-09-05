const db = require("../db");
const { getDepartmentNames, assertDepartmentAccess } = require("../services/permissionService");

const formatDate = (d) => {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

async function overview(req, res, next) {
  try {
    const from = req.query.date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = req.query.date_to || new Date().toISOString().slice(0, 10);

    let deptsQuery = db("departments").select("id", "name", "code", "chef_name");
    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      if (deptNames && deptNames.length) {
        deptsQuery.whereIn("name", deptNames);
      } else {
        return res.json({ success: true, data: [] });
      }
    }
    const depts = await deptsQuery;
    if (!depts.length) {
      return res.json({ success: true, data: [] });
    }

    const deptNames = depts.map((d) => d.name.toLowerCase());

    const [
      indentsSum,
      indentItemsSum,
      issuancesSum,
      issuanceItemsSum,
      productionSum,
      leftoversSum,
      anomaliesSum
    ] = await Promise.all([
      db("indents")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(dept) as dept"),
          db.raw("COUNT(id) as total_indents"),
          db.raw("COUNT(id) FILTER (WHERE status = 'pending') as pending_indents")
        )
        .groupByRaw("LOWER(dept)"),

      db("indent_items")
        .join("indents", "indents.id", "indent_items.indent_id")
        .whereBetween("indents.date", [from, to])
        .whereRaw("LOWER(indents.dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(indents.dept) as dept"),
          db.raw("SUM(indent_items.qty) as total_items_requested")
        )
        .groupByRaw("LOWER(indents.dept)"),

      db("issuances")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(dept) as dept"),
          db.raw("COUNT(id) as total_issuances")
        )
        .groupByRaw("LOWER(dept)"),

      db("issuance_items")
        .join("issuances", "issuances.id", "issuance_items.issuance_id")
        .whereBetween("issuances.date", [from, to])
        .whereRaw("LOWER(issuances.dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(issuances.dept) as dept"),
          db.raw("SUM(issuance_items.issued) as total_items_issued"),
          db.raw("SUM(issuance_items.issued * COALESCE(NULLIF(issuance_items.unit_price, 0), (SELECT price FROM stock WHERE LOWER(stock.name) = LOWER(issuance_items.name) ORDER BY id DESC LIMIT 1), 0)) as estimated_cost")
        )
        .groupByRaw("LOWER(issuances.dept)"),

      db("production")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(dept) as dept"),
          db.raw("SUM(plates) as total_plates"),
          db.raw("COUNT(DISTINCT date) as distinct_production_days")
        )
        .groupByRaw("LOWER(dept)"),

      db("leftovers")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(dept) as dept"),
          db.raw("SUM(qty) as total_leftover_qty")
        )
        .groupByRaw("LOWER(dept)"),

      db("anomaly_alerts")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(department) IN (" + deptNames.map(() => "?").join(",") + ")", deptNames)
        .select(
          db.raw("LOWER(department) as dept"),
          db.raw("COUNT(id) as total_anomalies"),
          db.raw("COUNT(id) FILTER (WHERE status != 'RESOLVED') as unresolved_anomalies")
        )
        .groupByRaw("LOWER(department)")
    ]);

    const indentsMap = Object.fromEntries(indentsSum.map((row) => [row.dept, row]));
    const indentItemsMap = Object.fromEntries(indentItemsSum.map((row) => [row.dept, row.total_items_requested]));
    const issuancesMap = Object.fromEntries(issuancesSum.map((row) => [row.dept, row.total_issuances]));
    const issuanceItemsMap = Object.fromEntries(issuanceItemsSum.map((row) => [row.dept, row]));
    const productionMap = Object.fromEntries(productionSum.map((row) => [row.dept, row]));
    const leftoversMap = Object.fromEntries(leftoversSum.map((row) => [row.dept, row.total_leftover_qty]));
    const anomaliesMap = Object.fromEntries(anomaliesSum.map((row) => [row.dept, row]));

    const result = depts.map((d) => {
      const nameLower = d.name.toLowerCase();

      const total_indents = parseInt(indentsMap[nameLower]?.total_indents || 0);
      const pending_indents = parseInt(indentsMap[nameLower]?.pending_indents || 0);
      const total_issuances = parseInt(issuancesMap[nameLower]?.total_issuances || 0);
      const total_items_requested = parseFloat(indentItemsMap[nameLower] || 0);
      const total_items_issued = parseFloat(issuanceItemsMap[nameLower]?.total_items_issued || 0);
      const estimated_cost = parseFloat(issuanceItemsMap[nameLower]?.estimated_cost || 0);
      const total_plates = parseFloat(productionMap[nameLower]?.total_plates || 0);
      const distinct_production_days = parseInt(productionMap[nameLower]?.distinct_production_days || 0);
      const total_leftover_qty = parseFloat(leftoversMap[nameLower] || 0);
      const total_anomalies = parseInt(anomaliesMap[nameLower]?.total_anomalies || 0);
      const unresolved_anomalies = parseInt(anomaliesMap[nameLower]?.unresolved_anomalies || 0);

      const cost_per_plate = total_plates > 0 ? parseFloat((estimated_cost / total_plates).toFixed(2)) : 0.0;
      const waste_rate_pct = total_plates > 0 ? parseFloat(((total_leftover_qty / total_plates) * 100).toFixed(1)) : 0.0;
      const avg_daily_plates = distinct_production_days > 0 ? parseFloat((total_plates / distinct_production_days).toFixed(1)) : 0.0;
      const efficiency_score = Math.max(0, Math.min(100, Math.round(100 - (waste_rate_pct * 2) - (total_anomalies * 10))));
      return {
        dept_id: d.id,
        dept_name: d.name,
        dept_code: d.code,
        chef_name: d.chef_name || "Unassigned",
        total_indents,
        pending_indents,
        total_issuances,
        total_items_requested,
        total_items_issued,
        total_plates,
        total_leftover_qty,
        total_anomalies,
        unresolved_anomalies,
        waste_rate_pct,
        estimated_cost: parseFloat(estimated_cost.toFixed(2)),
        cost_per_plate,
        avg_daily_plates,
        efficiency_score
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const deptId = parseInt(req.params.deptId);
    const from = req.query.date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = req.query.date_to || new Date().toISOString().slice(0, 10);

    const dept = await db("departments").where("id", deptId).first();
    if (!dept) {
      return res.status(404).json({ success: false, error: "Department not found." });
    }

    await assertDepartmentAccess(req.user, dept.name);

    const nameLower = dept.name.toLowerCase();

    // 1. Summary details (calculated similar to overview but filtered to just this dept)
    const [
      indentsSum,
      indentItemsSum,
      issuancesSum,
      issuanceItemsSum,
      productionSum,
      leftoversSum,
      anomaliesSum
    ] = await Promise.all([
      db("indents")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .select(
          db.raw("COUNT(id) as total_indents"),
          db.raw("COUNT(id) FILTER (WHERE status = 'pending') as pending_indents")
        )
        .first(),

      db("indent_items")
        .join("indents", "indents.id", "indent_items.indent_id")
        .whereBetween("indents.date", [from, to])
        .whereRaw("LOWER(indents.dept) = ?", [nameLower])
        .sum("indent_items.qty as total_items_requested")
        .first(),

      db("issuances")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .count("id as total_issuances")
        .first(),

      db("issuance_items")
        .join("issuances", "issuances.id", "issuance_items.issuance_id")
        .whereBetween("issuances.date", [from, to])
        .whereRaw("LOWER(issuances.dept) = ?", [nameLower])
        .select(
          db.raw("SUM(issuance_items.issued) as total_items_issued"),
          db.raw("SUM(issuance_items.issued * COALESCE(NULLIF(issuance_items.unit_price, 0), (SELECT price FROM stock WHERE LOWER(stock.name) = LOWER(issuance_items.name) ORDER BY id DESC LIMIT 1), 0)) as estimated_cost")
        )
        .first(),

      db("production")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .select(
          db.raw("SUM(plates) as total_plates"),
          db.raw("COUNT(DISTINCT date) as distinct_production_days")
        )
        .first(),

      db("leftovers")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .sum("qty as total_leftover_qty")
        .first(),

      db("anomaly_alerts")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(department) = ?", [nameLower])
        .select(
          db.raw("COUNT(id) as total_anomalies"),
          db.raw("COUNT(id) FILTER (WHERE status != 'RESOLVED') as unresolved_anomalies")
        )
        .first()
    ]);

    const total_indents = parseInt(indentsSum?.total_indents || 0);
    const pending_indents = parseInt(indentsSum?.pending_indents || 0);
    const total_issuances = parseInt(issuancesSum?.total_issuances || 0);
    const total_items_requested = parseFloat(indentItemsSum?.total_items_requested || 0);
    const total_items_issued = parseFloat(issuanceItemsSum?.total_items_issued || 0);
    const estimated_cost = parseFloat(issuanceItemsSum?.estimated_cost || 0);
    const total_plates = parseFloat(productionSum?.total_plates || 0);
    const distinct_production_days = parseInt(productionSum?.distinct_production_days || 0);
    const total_leftover_qty = parseFloat(leftoversSum?.total_leftover_qty || 0);
    const total_anomalies = parseInt(anomaliesSum?.total_anomalies || 0);
    const unresolved_anomalies = parseInt(anomaliesSum?.unresolved_anomalies || 0);

    const cost_per_plate = total_plates > 0 ? parseFloat((estimated_cost / total_plates).toFixed(2)) : 0.0;
    const waste_rate_pct = total_plates > 0 ? parseFloat(((total_leftover_qty / total_plates) * 100).toFixed(1)) : 0.0;
    const avg_daily_plates = distinct_production_days > 0 ? parseFloat((total_plates / distinct_production_days).toFixed(1)) : 0.0;
    const efficiency_score = Math.max(0, Math.min(100, Math.round(100 - (waste_rate_pct * 2) - (total_anomalies * 10))));

    const summary = {
      total_indents,
      pending_indents,
      total_issuances,
      total_items_requested,
      total_items_issued,
      total_plates,
      total_leftover_qty,
      total_anomalies,
      unresolved_anomalies,
      waste_rate_pct,
      estimated_cost: parseFloat(estimated_cost.toFixed(2)),
      cost_per_plate,
      avg_daily_plates,
      efficiency_score
    };

    // 2. Material Breakdown
    const avgStockPricesSub = db("stock")
      .select("item_code", db.raw("AVG(price) as avg_price"))
      .groupBy("item_code")
      .as("sp");

    const issuedItems = await db("issuance_items")
      .join("issuances", "issuances.id", "issuance_items.issuance_id")
      .leftJoin(avgStockPricesSub, "sp.item_code", "issuance_items.item_code")
      .whereBetween("issuances.date", [from, to])
      .whereRaw("LOWER(issuances.dept) = ?", [nameLower])
      .select(
        "issuance_items.name",
        "issuance_items.item_code",
        "issuance_items.unit",
        db.raw("SUM(issuance_items.issued) as total_issued"),
        db.raw("AVG(COALESCE(NULLIF(issuance_items.unit_price, 0), sp.avg_price, (SELECT price FROM stock WHERE LOWER(stock.name) = LOWER(issuance_items.name) ORDER BY id DESC LIMIT 1), 0)) as avg_price"),
        db.raw("SUM(issuance_items.issued * COALESCE(NULLIF(issuance_items.unit_price, 0), sp.avg_price, (SELECT price FROM stock WHERE LOWER(stock.name) = LOWER(issuance_items.name) ORDER BY id DESC LIMIT 1), 0)) as estimated_cost")
      )
      .groupBy("issuance_items.name", "issuance_items.item_code", "issuance_items.unit")
      .orderBy("total_issued", "desc")
      .limit(15);

    const requestedItems = await db("indent_items")
      .join("indents", "indents.id", "indent_items.indent_id")
      .whereBetween("indents.date", [from, to])
      .whereRaw("LOWER(indents.dept) = ?", [nameLower])
      .select(
        "indent_items.item_code",
        db.raw("SUM(indent_items.qty) as total_requested")
      )
      .groupBy("indent_items.item_code");

    const requestedMap = Object.fromEntries(requestedItems.map((r) => [r.item_code, parseFloat(r.total_requested || 0)]));

    const material_breakdown = issuedItems.map((item) => ({
      name: item.name,
      item_code: item.item_code,
      unit: item.unit,
      total_requested: requestedMap[item.item_code] || 0.0,
      total_issued: parseFloat(item.total_issued || 0),
      avg_price: parseFloat(parseFloat(item.avg_price || 0).toFixed(2)),
      estimated_cost: parseFloat(parseFloat(item.estimated_cost || 0).toFixed(2))
    }));

    // 3. Daily Trend
    const [prodTrend, leftTrend, issueTrend] = await Promise.all([
      db("production")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .select("date", db.raw("SUM(plates) as plates"))
        .groupBy("date")
        .orderBy("date", "asc"),

      db("leftovers")
        .whereBetween("date", [from, to])
        .whereRaw("LOWER(dept) = ?", [nameLower])
        .select("date", db.raw("SUM(qty) as leftover_qty"))
        .groupBy("date"),

      db("issuances")
        .join("issuance_items", "issuances.id", "issuance_items.issuance_id")
        .whereBetween("issuances.date", [from, to])
        .whereRaw("LOWER(issuances.dept) = ?", [nameLower])
        .select("issuances.date", db.raw("COUNT(issuance_items.id) as items_issued_count"))
        .groupBy("issuances.date")
    ]);

    const prodMap = Object.fromEntries(prodTrend.map((r) => [formatDate(r.date), parseFloat(r.plates || 0)]));
    const leftMap = Object.fromEntries(leftTrend.map((r) => [formatDate(r.date), parseFloat(r.leftover_qty || 0)]));
    const issueMap = Object.fromEntries(issueTrend.map((r) => [formatDate(r.date), parseInt(r.items_issued_count || 0)]));

    const allDates = Array.from(new Set([
      ...Object.keys(prodMap),
      ...Object.keys(leftMap),
      ...Object.keys(issueMap)
    ])).sort();

    const daily_trend = allDates.map((dateStr) => {
      const plates = prodMap[dateStr] || 0.0;
      const leftover_qty = leftMap[dateStr] || 0.0;
      const waste_pct = plates > 0 ? parseFloat(((leftover_qty / plates) * 100).toFixed(1)) : 0.0;
      const items_issued_count = issueMap[dateStr] || 0;
      return {
        date: dateStr,
        plates,
        leftover_qty,
        waste_pct,
        items_issued_count
      };
    });

    // 4. Indent Fulfillment
    const indentFulfillmentStats = await db("indents")
      .whereBetween("date", [from, to])
      .whereRaw("LOWER(dept) = ?", [nameLower])
      .select("status", db.raw("COUNT(id) as count"))
      .groupBy("status");

    const indent_fulfillment = { total: 0, pending: 0, issued: 0, cancelled: 0 };
    indentFulfillmentStats.forEach((row) => {
      const cnt = parseInt(row.count || 0);
      indent_fulfillment.total += cnt;
      if (row.status === "pending") indent_fulfillment.pending = cnt;
      else if (row.status === "issued") indent_fulfillment.issued = cnt;
      else if (row.status === "cancelled") indent_fulfillment.cancelled = cnt;
    });

    // 5. Recent Indents
    const recentIndents = await db("indents")
      .whereRaw("LOWER(dept) = ?", [nameLower])
      .orderBy("date", "desc")
      .orderBy("created_at", "desc")
      .limit(10);

    const recent_indents = await Promise.all(recentIndents.map(async (ind) => {
      const items = await db("indent_items")
        .where("indent_id", ind.id)
        .select("name", "qty", "unit", "item_code");
      return {
        id: ind.id,
        date: formatDate(ind.date),
        status: ind.status,
        items
      };
    }));

    res.json({
      success: true,
      data: {
        department: {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          chef_name: dept.chef_name || "Unassigned"
        },
        summary,
        material_breakdown,
        daily_trend,
        indent_fulfillment,
        recent_indents
      }
    });
  } catch (err) {
    next(err);
  }
}

async function wastage(req, res, next) {
  try {
    const { dept, date_from, date_to } = req.query;
    if (!dept) {
      return res.status(400).json({ success: false, error: "department is required." });
    }

    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);

    await assertDepartmentAccess(req.user, dept);

    // 1. Get all production logs in this date range
    const productions = await db("production")
      .where("dept", dept)
      .whereBetween("date", [from, to]);

    // 2. Compute theoretical ingredient needs
    const theoreticalUse = {};
    for (const prod of productions) {
      const recipe = await db("recipes")
        .whereRaw("LOWER(name) = LOWER(?)", [prod.item_name.trim()])
        .first();

      if (recipe) {
        const recipeItems = await db("recipe_items").where("recipe_id", recipe.id);
        for (const ri of recipeItems) {
          const key = ri.item_code || ri.name.toLowerCase();
          if (!theoreticalUse[key]) {
            theoreticalUse[key] = {
              item_code: ri.item_code,
              name: ri.name,
              unit: ri.unit,
              qty: 0
            };
          }
          const plates = parseFloat(prod.portions_produced || prod.qty_produced || 0);
          theoreticalUse[key].qty += plates * parseFloat(ri.qty);
        }
      }
    }

    // 3. Get total actual issued quantities in this range
    const issuances = await db("issuance_items")
      .join("issuances", "issuance_items.issuance_id", "issuances.id")
      .where("issuances.dept", dept)
      .whereBetween("issuances.date", [from, to])
      .select("issuance_items.item_code", "issuance_items.name")
      .sum("issuance_items.issued as total_issued")
      .groupBy("issuance_items.item_code", "issuance_items.name");

    // 4. Get total leftovers in this range
    const leftovers = await db("leftovers")
      .where("dept", dept)
      .whereBetween("date", [from, to])
      .select("item_code", "name")
      .sum("qty as total_leftover")
      .groupBy("item_code", "name");

    const leftoverMap = new Map(leftovers.map(l => [l.item_code || l.name.toLowerCase(), parseFloat(l.total_leftover || 0)]));

    // Combine them into a wastage report
    const report = issuances.map(row => {
      const key = row.item_code || row.name.toLowerCase();
      const actualIssued = parseFloat(row.total_issued || 0);
      const leftover = leftoverMap.get(key) || 0;
      const theoreticalNeeded = theoreticalUse[key] ? theoreticalUse[key].qty : 0;

      // Actual consumed = Issued - Leftover
      const actualConsumed = Math.max(0, actualIssued - leftover);
      // Wastage = Actual Consumed - Theoretical Needed
      const wastage = Math.max(0, actualConsumed - theoreticalNeeded);

      return {
        item_code: row.item_code,
        name: row.name,
        actual_issued: actualIssued,
        leftover_carried_forward: leftover,
        actual_consumed: actualConsumed,
        theoretical_needed: theoreticalNeeded,
        wastage,
        wastage_percentage: actualConsumed > 0 ? (wastage / actualConsumed) * 100 : 0
      };
    });

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
}

module.exports = { overview, detail, wastage };
