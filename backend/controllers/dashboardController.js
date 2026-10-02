const db = require("../db");
const { getDepartmentNames, assertDepartmentAccess } = require("../services/permissionService");
const { publish } = require("../services/kafkaProducer");

// GET /api/dashboard?date=YYYY-MM-DD
async function summary(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const pendingIndentsQuery = db("indents").whereIn("status", ["pending", "approved", "partial"]).count("id as count");
    const todayIssuancesQuery = db("issuances").where("date", date).count("id as count");
    const todayPlatesQuery = db("production").where("date", date).sum("plates as total");
    const todayLeftoversQuery = db("leftovers").where("date", date).count("id as count");

    if (!req.user.isAdmin) {
      if (deptNames && deptNames.length) {
        pendingIndentsQuery.whereIn("dept", deptNames);
        todayIssuancesQuery.whereIn("dept", deptNames);
        todayPlatesQuery.whereIn("dept", deptNames);
        todayLeftoversQuery.whereIn("dept", deptNames);
      } else {
        pendingIndentsQuery.whereRaw("1 = 0");
        todayIssuancesQuery.whereRaw("1 = 0");
        todayPlatesQuery.whereRaw("1 = 0");
        todayLeftoversQuery.whereRaw("1 = 0");
      }
    }

    let deptQueryText = `
        SELECT
          d.name                     AS dept,
          COALESCE(p.plates, 0)      AS total_plates,
          COALESCE(i.issuances, 0)   AS total_issuances,
          COALESCE(l.leftover_qty, 0) AS total_leftover_qty,
          CASE WHEN COALESCE(p.plates, 0) > 0
            THEN ROUND((COALESCE(l.leftover_qty, 0)::numeric / p.plates * 100), 1)
            ELSE 0
          END AS waste_rate_pct
        FROM departments d
        LEFT JOIN (
          SELECT dept, SUM(plates) AS plates FROM production GROUP BY dept
        ) p ON LOWER(p.dept) = LOWER(d.name)
        LEFT JOIN (
          SELECT dept, COUNT(*) AS issuances FROM issuances GROUP BY dept
        ) i ON LOWER(i.dept) = LOWER(d.name)
        LEFT JOIN (
          SELECT dept, SUM(qty) AS leftover_qty FROM leftovers GROUP BY dept
        ) l ON LOWER(l.dept) = LOWER(d.name)
    `;
    const queryParams = [];
    if (!req.user.isAdmin) {
      if (deptNames && deptNames.length) {
        deptQueryText += ` WHERE LOWER(d.name) IN (${deptNames.map(() => "?").join(",")})`;
        queryParams.push(...deptNames.map(d => d.toLowerCase()));
      } else {
        deptQueryText += ` WHERE 1 = 0`;
      }
    }
    deptQueryText += ` ORDER BY d.name ASC`;

    let weeklyWasteQueryText = `
        SELECT
          p.date,
          SUM(p.plates) AS plates,
          COALESCE(SUM(l.qty), 0) AS leftover_qty,
          CASE WHEN SUM(p.plates) > 0
            THEN ROUND((COALESCE(SUM(l.qty), 0)::numeric / SUM(p.plates) * 100), 1)
            ELSE 0
          END AS waste_rate_pct
        FROM production p
        LEFT JOIN leftovers l ON l.date = p.date AND LOWER(l.dept) = LOWER(p.dept)
        WHERE p.date >= (DATE(?) - INTERVAL '6 days')::date
    `;
    const weeklyWasteParams = [date];
    if (!req.user.isAdmin) {
      if (deptNames && deptNames.length) {
        weeklyWasteQueryText += ` AND LOWER(p.dept) IN (${deptNames.map(() => "?").join(",")})`;
        weeklyWasteParams.push(...deptNames.map(d => d.toLowerCase()));
      } else {
        weeklyWasteQueryText += ` AND 1 = 0`;
      }
    }
    weeklyWasteQueryText += `
        GROUP BY p.date
        ORDER BY p.date ASC
    `;

    const [
      stockStats,
      pendingIndents,
      todayIssuances,
      todayPlates,
      todayLeftovers,
      deptStats,
      lowStock,
      weeklyWaste,
    ] = await Promise.all([
      db("stock").select(
        db.raw("COUNT(*) AS total"),
        db.raw("COUNT(*) FILTER (WHERE remaining <= COALESCE(min_alert_qty, qty * 0.25)) AS low_stock")
      ).first(),

      pendingIndentsQuery.first(),
      todayIssuancesQuery.first(),
      todayPlatesQuery.first(),
      todayLeftoversQuery.first(),
      db.raw(deptQueryText, queryParams),

      db("stock")
        .whereRaw("remaining <= COALESCE(min_alert_qty, qty * 0.25)")
        .select("id", "name", "remaining", "qty", "unit",
          db.raw("ROUND((remaining / NULLIF(qty, 0) * 100)::numeric, 1) AS pct"))
        .orderBy("pct", "asc"),

      db.raw(weeklyWasteQueryText, weeklyWasteParams),
    ]);

    const actualKpis = {
      total_stock: parseInt(stockStats.total) || 0,
      low_stock: parseInt(stockStats.low_stock) || 0,
      pending_indents: parseInt(pendingIndents.count) || 0,
      today_issuances: parseInt(todayIssuances.count) || 0,
      today_plates: parseInt(todayPlates.total) || 0,
      today_leftovers: parseInt(todayLeftovers.count) || 0,
    };

    res.json({
      success: true,
      data: {
        date,
        kpis: actualKpis,
        dept_stats: deptStats.rows || deptStats,
        low_stock_items: lowStock,
        weekly_waste: weeklyWaste.rows || weeklyWaste,
      },
    });
  } catch (err) { next(err); }
}

// GET /api/dashboard/analytics?dept=&date_from=&date_to=
async function analytics(req, res, next) {
  try {
    const { dept, date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to   = date_to   || new Date().toISOString().slice(0, 10);

    if (dept) {
      await assertDepartmentAccess(req.user, dept);
    }

    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const filter = (qb, table) => {
      qb.whereBetween(`${table}.date`, [from, to]);
      if (dept) {
        qb.whereRaw(`LOWER(${table}.dept) = LOWER(?)`, [dept]);
      } else if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn(`${table}.dept`, deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }
    };

    let consumptionQueryText = `
        SELECT ii.name, ii.unit, SUM(ii.issued) AS total_issued, COUNT(DISTINCT i.date) AS days_issued
        FROM issuance_items ii
        JOIN issuances i ON i.id = ii.issuance_id
        WHERE i.date BETWEEN ? AND ?
    `;
    const consumptionParams = [from, to];
    if (dept) {
      consumptionQueryText += " AND LOWER(i.dept) = LOWER(?)";
      consumptionParams.push(dept);
    } else if (!req.user.isAdmin) {
      if (deptNames && deptNames.length) {
        consumptionQueryText += ` AND LOWER(i.dept) IN (${deptNames.map(() => "?").join(",")})`;
        consumptionParams.push(...deptNames.map(d => d.toLowerCase()));
      } else {
        consumptionQueryText += " AND 1 = 0";
      }
    }
    consumptionQueryText += `
        GROUP BY ii.name, ii.unit
        ORDER BY total_issued DESC
        LIMIT 20
    `;

    const [consumption, production, topItems] = await Promise.all([
      db.raw(consumptionQueryText, consumptionParams),

      db("production")
        .modify((qb) => filter(qb, "production"))
        .select("date", db.raw("SUM(plates) AS plates"), "dept")
        .groupBy("date", "dept")
        .orderBy("date"),

      db("leftovers")
        .modify((qb) => filter(qb, "leftovers"))
        .select("item", db.raw("SUM(qty) AS total_qty"), "unit")
        .groupBy("item", "unit")
        .orderBy("total_qty", "desc")
        .limit(10),
    ]);

    res.json({
      success: true,
      data: {
        period: { from, to, dept: dept || "all" },
        top_consumed: consumption.rows,
        production_trend: production,
        top_leftovers: topItems,
      },
    });
  } catch (err) { next(err); }
}

async function procurement(req, res, next) {
  try {
    const [shrinkage, supplierPerf, outstanding] = await Promise.all([
      // 1. Shrinkage details (financial loss per reason)
      db("stock_adjustments")
        .join("stock", "stock.id", "stock_adjustments.stock_id")
        .select(
          "stock_adjustments.reason",
          db.raw("COUNT(*) as count"),
          db.raw("SUM(ABS(stock_adjustments.qty)) as total_qty"),
          db.raw("SUM(ABS(stock_adjustments.qty) * COALESCE(stock.price, 0)) as total_cost")
        )
        .where("stock_adjustments.qty", "<", 0)
        .groupBy("stock_adjustments.reason"),

      // 2. Supplier performance (lead time and fulfillment)
      db("goods_receipt_notes")
        .join("suppliers", "goods_receipt_notes.supplier_id", "suppliers.id")
        .leftJoin("purchase_orders", "goods_receipt_notes.po_id", "purchase_orders.id")
        .leftJoin("goods_receipt_items", "goods_receipt_notes.id", "goods_receipt_items.grn_id")
        .select(
          "suppliers.id as supplier_id",
          "suppliers.name as supplier_name",
          db.raw("AVG(CASE WHEN goods_receipt_notes.po_id IS NOT NULL AND goods_receipt_notes.date >= purchase_orders.date THEN (goods_receipt_notes.date - purchase_orders.date) ELSE NULL END) as avg_lead_time_days"),
          db.raw("ROUND((COALESCE(SUM(goods_receipt_items.qty_accepted), 0) / NULLIF(SUM(goods_receipt_items.qty_ordered), 0) * 100)::numeric, 1) as fulfillment_rate")
        )
        .groupBy("suppliers.id", "suppliers.name"),

      // 3. Outstanding POs by status
      db("purchase_orders")
        .select("status")
        .count("id as count")
        .groupBy("status")
    ]);

    // Format outputs
    const formattedShrinkage = shrinkage.map(s => ({
      reason: s.reason,
      count: parseInt(s.count || 0),
      total_qty: parseFloat(s.total_qty || 0),
      total_cost: parseFloat(s.total_cost || 0)
    }));

    const formattedSupplier = supplierPerf.map(s => ({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      avg_lead_time_days: s.avg_lead_time_days ? Math.round(parseFloat(s.avg_lead_time_days) * 10) / 10 : null,
      fulfillment_rate: s.fulfillment_rate ? parseFloat(s.fulfillment_rate) : null
    }));

    const formattedOutstanding = outstanding.reduce((acc, curr) => {
      acc[curr.status] = parseInt(curr.count || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        shrinkage: formattedShrinkage,
        supplier_performance: formattedSupplier,
        outstanding: formattedOutstanding
      }
    });
  } catch (err) {
    next(err);
  }
}

async function morningBriefing(req, res, next) {
  try {
    const { generateMorningBriefing } = require("../services/localAI");
    const todayStr = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const [pendingRes, lowStockRes, expiringRes, lastHandoff] = await Promise.all([
      db("indents").where("status", "pending").count("id as count").first(),
      db("stock").whereRaw("remaining <= COALESCE(min_alert_qty, qty * 0.25)").count("id as count").first(),
      db("stock").whereBetween("expiry_date", [todayStr, soon]).count("id as count").first(),
      db("shift_handoffs").orderBy("created_at", "desc").first()
    ]);

    const pendingIndents = parseInt(pendingRes?.count || 0, 10);
    const lowStockCount = parseInt(lowStockRes?.count || 0, 10);
    const expiringCount = parseInt(expiringRes?.count || 0, 10);
    const handoffText = lastHandoff ? `Last shift handoff note: "${lastHandoff.note}"` : "No previous shift handoff notes available.";

    const briefing = await generateMorningBriefing({
      pendingIndents,
      lowStockCount,
      expiringCount,
      handoffText
    });

    res.json({ success: true, briefing });
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/adhoc-summary — adhoc vs routine indent split, last 7 days.
// Adhoc spikes usually mean either a real emergency or a broken reorder point
// that should be added so the item stops needing emergency requests.
async function adhocSummary(req, res, next) {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const scope = (qb) => {
      qb.where("i.date", ">=", since);
      if (deptNames) qb.whereIn("i.dept", deptNames);
    };

    const byType = await db("indents as i")
      .modify(scope)
      .groupBy("i.indent_type")
      .select("i.indent_type")
      .count("i.id as count");

    const itemRows = await db("indent_items as ii")
      .join("indents as i", "ii.indent_id", "i.id")
      .modify(scope)
      .where("i.indent_type", "adhoc")
      .leftJoin("stock as s", (j) => j.on(db.raw("LOWER(s.name)"), "=", db.raw("LOWER(ii.name)")))
      .select("ii.name")
      .select(db.raw("SUM(ii.qty * COALESCE(s.price, 0)) as value"))
      .count("ii.id as occurrences")
      .groupBy("ii.name")
      .orderBy("occurrences", "desc")
      .limit(10);

    const byDept = await db("indents as i")
      .modify(scope)
      .where("i.indent_type", "adhoc")
      .groupBy("i.dept")
      .select("i.dept")
      .count("i.id as count")
      .orderBy("count", "desc");

    const adhocCount = parseInt(byType.find((r) => r.indent_type === "adhoc")?.count || 0);
    const routineCount = parseInt(byType.find((r) => r.indent_type === "routine")?.count || 0);
    const adhocValue = itemRows.reduce((s, r) => s + parseFloat(r.value || 0), 0);

    res.json({
      success: true,
      data: {
        days,
        adhoc_count: adhocCount,
        routine_count: routineCount,
        adhoc_value: parseFloat(adhocValue.toFixed(2)),
        top_adhoc_items: itemRows.map((r) => ({ name: r.name, occurrences: parseInt(r.occurrences), value: parseFloat(r.value || 0) })),
        by_dept: byDept.map((r) => ({ dept: r.dept, count: parseInt(r.count) })),
      },
    });
  } catch (err) { next(err); }
}

// GET /api/dashboard/indent-funnel — status breakdown + "stuck" indents
// (approved with zero linked issuance). This is the visibility gap admin
// never had: 5 real indents sat approved for 2+ days with no issuance and
// nothing surfaced that fact anywhere. Enriched with kafka_event_log so the
// "last activity" timestamp reflects the real event stream, not just DB rows.
async function indentFunnel(req, res, next) {
  try {
    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;
    const scope = (qb) => { if (deptNames) deptNames.length ? qb.whereIn("dept", deptNames) : qb.whereRaw("1=0"); };

    const statusCounts = await db("indents").modify(scope).select("status").count("id as count").groupBy("status");
    const funnel = { pending: 0, approved: 0, partial: 0, issued: 0, cancelled: 0 };
    statusCounts.forEach((r) => { funnel[r.status] = parseInt(r.count); });

    const stuck = await db("indents as i")
      .modify(scope)
      .where("i.status", "approved")
      .whereNotExists(function () {
        this.select("*").from("issuances as iss").whereRaw("iss.indent_id = i.id");
      })
      .select("i.id", "i.dept", "i.created_at")
      .orderBy("i.created_at", "asc");

    const stuckIds = stuck.map((s) => s.id);
    const lastActivity = stuckIds.length
      ? await db("kafka_event_log")
          .whereIn(db.raw("(payload->>'id')::int"), stuckIds)
          .whereIn("topic", ["indent-events", "issuance-events"])
          .select(db.raw("(payload->>'id')::int as indent_id"), "event_type", "produced_at")
          .orderBy("produced_at", "desc")
      : [];
    const lastActivityMap = {};
    lastActivity.forEach((r) => { if (!lastActivityMap[r.indent_id]) lastActivityMap[r.indent_id] = r; });

    const now = Date.now();
    const stuckEnriched = stuck.map((s) => ({
      id: s.id,
      dept: s.dept,
      created_at: s.created_at,
      age_hours: Math.round((now - new Date(s.created_at).getTime()) / 3600000),
      last_event: lastActivityMap[s.id]?.event_type || null,
      last_event_at: lastActivityMap[s.id]?.produced_at || null,
    }));

    res.json({ success: true, data: { funnel, stuck: stuckEnriched } });
  } catch (err) { next(err); }
}

// GET /api/dashboard/store-home
// Consolidated single-call API for Store Manager Dashboard with multi-threaded parallel execution
async function storeHome(req, res, next) {
  try {
    // Emit Kafka event
    publish("dashboard-events", "dashboard.viewed", {
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    }).catch(e => console.error("Kafka error:", e));

    const todayStr = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    // Multi-threaded parallel query execution of all dashboard metrics & configuration
    const [
      issuancesRes,
      grnRes,
      stockEntriesRes,
      pendingIndentsRes,
      lowStockRes,
      expiringRes,
      trendRows,
      highValueRes,
      recentActivity,
      shiftsRes
    ] = await Promise.all([
      db("issuances").where("date", todayStr).count("id as count").first(),
      db("goods_receipt_notes").where("date", todayStr).count("id as count").first(),
      db("stock").where("date", todayStr).count("id as count").first(),
      db("indents").whereIn("status", ["pending", "approved", "partial"]).count("id as count").first(),
      db("stock").whereRaw("remaining <= COALESCE(min_alert_qty, qty * 0.25)").count("id as count").first(),
      db("stock").whereBetween("expiry_date", [todayStr, soon]).count("id as count").first(),
      db("issuances")
        .where("date", ">=", db.raw("CURRENT_DATE - 6"))
        .select(db.raw("date::text as day"))
        .count("id as count")
        .groupBy("date")
        .orderBy("date", "asc"),
      db("notifications")
        .whereIn("type", ["indent_high_value", "issuance_high_value"])
        .where("created_at", ">=", db.raw("CURRENT_DATE - 6"))
        .count("id as count").first(),
      db("kafka_event_log")
        .whereIn("topic", ["indent-events", "issuance-events", "stock-events", "leftover-events"])
        .orderBy("produced_at", "desc")
        .limit(10)
        .select("topic", "event_type", "payload", "produced_at"),
      db("shift_patterns")
        .where("is_active", true)
        .orderBy("start_time", "asc")
    ]);

    const todayIssuances = parseInt(issuancesRes?.count || 0, 10);
    const grnCount = parseInt(grnRes?.count || 0, 10);
    const stockEntriesCount = parseInt(stockEntriesRes?.count || 0, 10);
    const todayStockEntries = grnCount > 0 ? grnCount : stockEntriesCount;
    const pendingIndents = parseInt(pendingIndentsRes?.count || 0, 10);
    const lowStockCount = parseInt(lowStockRes?.count || 0, 10);
    const expiringCount = parseInt(expiringRes?.count || 0, 10);
    const highValueAlertCount = parseInt(highValueRes?.count || 0, 10);

    const trendMap = Object.fromEntries(trendRows.map(r => [r.day, parseInt(r.count, 10)]));
    const issuanceTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: trendMap[key] || 0 };
    });

    const userPerms = new Set(req.user?.permissions || []);
    const isAdmin = Boolean(req.user?.isAdmin);

    const ALL_MODULES = [
      {
        id: 'store_manager_available_stock',
        icon_key: 'Package',
        title: 'Available Stock',
        description: 'View current stock levels, expiry alerts, and inventory health across all items.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'stock.view',
      },
      {
        id: 'store_manager_stock_purchase',
        icon_key: 'ShoppingCart',
        title: 'Receive Stock',
        description: 'Record new stock purchases, scan receipts, and update supplier information.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'stock.create',
      },
      {
        id: 'pos',
        icon_key: 'FileText',
        title: 'Purchase Orders',
        description: 'Same Purchase Orders window as admin — create, approve, mark sent/received, print.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'purchase_orders.view',
      },
      {
        id: 'suppliers',
        icon_key: 'Building2',
        title: 'Vendors & Suppliers',
        description: 'Register and manage vendor profiles, GSTIN, contacts, and live reliability benchmarks.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'suppliers.view',
      },
      {
        id: 'store_manager_store_issuance',
        icon_key: 'ClipboardList',
        title: 'Store Issuance',
        description: 'Issue materials to kitchens and departments against pending indent requests with LIFO priority.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'issuances.create',
      },
      {
        id: 'store_manager_indent',
        icon_key: 'FileText',
        title: 'Indent Request',
        description: 'View, review, and manage department material indent requests. Smart auto-indent and recipe planner included.',
        accentColor: '#f59e0b',
        bgAccent: 'rgba(245, 158, 11, 0.1)',
        permission: 'indents.view',
      },
    ];

    const modules = ALL_MODULES.filter(m => isAdmin || !m.permission || userPerms.has(m.permission));

    const shifts = (shiftsRes && shiftsRes.length > 0) ? shiftsRes.map(s => ({
      id: s.id,
      name: s.name,
      shift_type: s.shift_type,
      start_time: s.start_time,
      end_time: s.end_time,
      department: s.department || "Central Store"
    })) : [
      { id: 1, name: "Morning Shift", shift_type: "MORNING", start_time: "06:00:00", end_time: "14:00:00" },
      { id: 2, name: "Evening Shift", shift_type: "EVENING", start_time: "14:00:00", end_time: "22:00:00" },
      { id: 3, name: "Night Shift", shift_type: "NIGHT", start_time: "22:00:00", end_time: "06:00:00" },
    ];

    res.json({
      success: true,
      data: {
        pending_indents: pendingIndents,
        low_stock_count: lowStockCount,
        expiring_soon_count: expiringCount,
        today_issuances: todayIssuances,
        today_stock_entries: todayStockEntries,
        high_value_alert_count: highValueAlertCount,
        issuance_trend: issuanceTrend,
        modules,
        shifts,
        recent_activity: recentActivity.map(event => {
          let desc = `System event: ${event.event_type}`;
          if (event.event_type === "indent_created") desc = `New indent request from ${event.payload?.dept || 'kitchen'}`;
          if (event.event_type === "indent_approved") desc = `Indent approved for ${event.payload?.dept || 'kitchen'}`;
          if (event.event_type === "issuance_created") desc = `Materials issued to ${event.payload?.dept || 'department'}`;
          if (event.event_type === "stock_received") desc = `New stock received from ${event.payload?.supplier_name || 'supplier'}`;
          if (event.event_type === "low_stock_alert") desc = `Low stock alert: ${event.payload?.item_name || 'item'}`;
          if (event.event_type === "leftover_logged") desc = `Leftovers logged from ${event.payload?.dept || 'kitchen'}`;
          
          return {
            type: event.topic?.split("-")[0] || "system",
            desc,
            date: event.produced_at
          };
        })
      }
    });
  } catch (err) { next(err); }
}

module.exports = { summary, analytics, procurement, morningBriefing, adhocSummary, indentFunnel, storeHome };
