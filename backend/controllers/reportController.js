const inventoryReportService = require("../services/inventoryReportService");
const eodReportService = require("../services/eodReportService");
const indentIntelligenceReportService = require("../services/indentIntelligenceReportService");
const { auditLog } = require("../services/auditService");
const db = require("../db");

// ── Helper: run a query without letting one failing sub-query 500 the whole
// dashboard, but without lying about it either. Returns { data, error }.
// On failure, `data` is [] (so downstream forEach/filter/reduce stay safe)
// and `error` carries the real message so the caller can surface it instead
// of silently reporting "0 issues found".
async function safeQuery(label, queryPromise) {
  try {
    const data = await queryPromise;
    return { label, data, error: null };
  } catch (err) {
    console.error(`[reportController] Query '${label}' failed:`, err.message);
    return { label, data: [], error: err.message };
  }
}

// ── Simple in-memory TTL cache for expensive admin/insight reports ─────────────
// Keeps the last computed result per report for REPORT_CACHE_TTL_MS so switching
// tabs or re-opening a dashboard doesn't re-run the full scan every time.
// `?force=true` on the request bypasses the cache for an explicit re-run.
const REPORT_CACHE_TTL_MS = 45 * 1000;
const reportCache = new Map();

function isCacheableReportResult(body) {
  if (!body || body.success !== true || !body.data) return false;
  if (body.data.degraded) return false;
  if (body.data.status === "PARTIAL_AUDIT_FAILED") return false;
  return true;
}

function withTtlCache(cacheKey, handler) {
  return async function (req, res, next) {
    const force = req.query.force === "true" || req.query.force === "1";
    if (!force) {
      const cached = reportCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.data);
      }
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (isCacheableReportResult(body)) {
        reportCache.set(cacheKey, { data: body, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
      } else {
        reportCache.delete(cacheKey);
      }
      return originalJson(body);
    };
    return handler(req, res, next);
  };
}

// ── Helper: admin check ────────────────────────────────────────────────────────
function isAdmin(user) {
  return (
    user?.isAdmin ||
    user?.roles?.some((r) => ["admin"].includes(r.key || r))
  );
}
function canViewReports(user) {
  return (
    isAdmin(user) ||
    user?.permissions?.has("dashboard.view") ||
    user?.permissions?.has("stock.view") ||
    user?.roles?.some((r) => ["admin", "manager", "store_manager"].includes(r.key || r))
  );
}

// ── Existing: Excel Export ─────────────────────────────────────────────────────
async function exportInventoryExcel(req, res, next) {
  try {
    const authorized =
      req.user?.isAdmin ||
      req.user?.permissions?.has("stock.export") ||
      req.user?.permissions?.has("dashboard.export") ||
      req.user?.roles?.some((r) => ["admin", "manager", "store_manager"].includes(r.key || r));
    if (!authorized) return res.status(403).json({ success: false, error: "Forbidden" });

    const filters = { category: req.query.category, department: req.query.department };
    const metadata = { userName: req.user?.name || "Storekeeper", userId: req.user?.id };
    const workbook = await inventoryReportService.generateWorkbook(filters, metadata);
    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `Kapila_Inventory_Report_${todayStr}.xlsx`;

    await auditLog(req, { action: "report.export_excel", resource: "inventory_report", metadata: { filename, filters } });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export failed:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else next(err);
  }
}

// ── Existing: Preview ─────────────────────────────────────────────────────────
async function previewInventoryMetadata(req, res, next) {
  try {
    const data = await inventoryReportService.fetchReportData(req.query);
    let totalValuation = 0, lowStockCount = 0;
    data.masterStock.forEach((s) => {
      const rem = parseFloat(s.total_remaining) || 0;
      const rate = parseFloat(s.avg_price) || 0;
      const min = parseFloat(s.min_alert_qty) || 0;
      totalValuation += rem * rate;
      if (min > 0 && rem <= min) lowStockCount++;
    });
    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        total_skus: data.masterStock.length,
        total_batches: data.batches.length,
        total_issuances: data.issuances.length,
        total_grn: data.grnRecords.length,
        total_reorder_points: data.reorderPoints.length,
        total_audit_items: data.auditItems.length,
        total_valuation: Math.round(totalValuation * 100) / 100,
        low_stock_count: lowStockCount,
        sheets: ["Executive Summary","Master Stock Valuation","Batch & FEFO Expiry","Department Consumption","Procurement & GRN","Reorder & Replenishment","Audit & Variances"],
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Admin Dimensions ─────────────────────────────────────────────────────
async function getAdminDimensions(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const [items, vendors, categories, indents, recipes] = await Promise.all([
      db("stock").select("item_code", "name", "category", "unit").orderBy("name"),
      db("suppliers").select("id", "name", "contact_name", "phone").orderBy("name"),
      db("stock").distinct("category").whereNotNull("category").orderBy("category"),
      db("indents")
        .select("id", "dept", "date", "status")
        .orderBy("created_at", "desc")
        .limit(200),
      db("recipes").select("id", "name", "category").orderBy("name").catch(() => []),
    ]);

    res.json({
      success: true,
      data: {
        items:      items.map(i => ({ code: i.item_code, name: i.name, category: i.category, unit: i.unit })),
        vendors:    vendors,
        categories: categories.map(c => c.category).filter(Boolean),
        indents:    indents,
        dishes:     recipes,
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Item History Chain ───────────────────────────────────────────────────
async function getItemHistory(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const { itemCode } = req.params;
    const { dateFrom, dateTo } = req.query;

    // Stock ledger — full transaction history
    let ledgerQ = db("stock_ledger")
      .where("item_code", itemCode)
      .orderBy("created_at", "asc");
    if (dateFrom) ledgerQ = ledgerQ.where("created_at", ">=", dateFrom);
    if (dateTo)   ledgerQ = ledgerQ.where("created_at", "<=", dateTo + "T23:59:59Z");

    // Run all independent lookups in parallel instead of awaiting them one by one.
    const [stockRows, ledger, poItems, grnItems, issuanceItems, indentItems] = await Promise.all([
      // Base stock record(s)
      db("stock")
        .where("item_code", itemCode)
        .select("id", "item_code", "name", "category", "unit", "remaining", "price", "supplier_id", "batch_no", "expiry_date", "rack_location", "storage_zone", "invoice_no", "purchase_time", "created_at"),

      ledgerQ,

      // PO items for this item_code
      db("purchase_order_items as poi")
        .join("purchase_orders as po", "poi.po_id", "po.id")
        .join("suppliers as s", "po.supplier_id", "s.id")
        .where("poi.item_code", itemCode)
        .select(
          "poi.id as poi_id", "poi.qty", "poi.unit", "poi.unit_price", "poi.total_price",
          "po.id as po_id", "po.po_number", "po.date as po_date", "po.status as po_status", "po.total_amount",
          "s.id as supplier_id", "s.name as supplier_name", "s.phone as supplier_phone"
        )
        .orderBy("po.date", "desc"),

      // GRN items for this item_code
      db("goods_receipt_items as gri")
        .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
        .join("suppliers as s", "grn.supplier_id", "s.id")
        .leftJoin("purchase_orders as po", "grn.po_id", "po.id")
        .where("gri.item_code", itemCode)
        .select(
          "gri.id as gri_id", "gri.qty_ordered", "gri.qty_received", "gri.qty_accepted", "gri.qty_rejected",
          "gri.unit", "gri.unit_price", "gri.landed_cost", "gri.batch_no", "gri.expiry_date",
          "grn.id as grn_id", "grn.grn_number", "grn.date as grn_date", "grn.invoice_no", "grn.received_by",
          "s.id as supplier_id", "s.name as supplier_name",
          "po.po_number"
        )
        .orderBy("grn.date", "desc"),

      // Issuance items — what departments consumed this item
      db("issuance_items as ii")
        .join("issuances as iss", "ii.issuance_id", "iss.id")
        .where("ii.item_code", itemCode)
        .select(
          "ii.id as isi_id", "ii.qty_issued", "ii.unit",
          "iss.id as issuance_id", "iss.dept", "iss.date", "iss.issued_by"
        )
        .orderBy("iss.date", "desc")
        .catch(() => []), // table may not exist yet

      // Indent items — what was requested for this item
      db("indent_items as ii")
        .join("indents as ind", "ii.indent_id", "ind.id")
        .where("ii.item_code", itemCode)
        .select(
          "ii.id as iti_id", "ii.qty", "ii.unit", "ii.issued_qty",
          "ind.id as indent_id", "ind.dept", "ind.date", "ind.status"
        )
        .orderBy("ind.date", "desc")
        .catch(() => []),
    ]);

    // Compute summary stats
    const totalInward  = ledger.filter(l => l.transaction_type.startsWith("INWARD")).reduce((a, l) => a + parseFloat(l.qty || 0), 0);
    const totalOutward = ledger.filter(l => l.transaction_type.startsWith("OUTWARD")).reduce((a, l) => a + parseFloat(l.qty || 0), 0);
    const totalSpend   = grnItems.reduce((a, g) => a + parseFloat(g.landed_cost || 0), 0);
    const currentBalance = ledger.length > 0 ? parseFloat(ledger[ledger.length - 1].balance_qty_after || 0) : 0;

    // Department consumption breakdown from ledger
    const deptBreakdown = {};
    ledger.filter(l => l.department && l.transaction_type === "OUTWARD_ISSUE").forEach(l => {
      const d = l.department;
      deptBreakdown[d] = (deptBreakdown[d] || 0) + parseFloat(l.qty || 0);
    });

    await auditLog(req, { action: "report.item_history", resource: "item", metadata: { itemCode } });

    res.json({
      success: true,
      data: {
        item:       stockRows[0] || { item_code: itemCode },
        batches:    stockRows,
        summary: {
          total_inward:     Math.round(totalInward * 1000) / 1000,
          total_outward:    Math.round(totalOutward * 1000) / 1000,
          current_balance:  Math.round(currentBalance * 1000) / 1000,
          total_po_count:   poItems.length,
          total_grn_count:  grnItems.length,
          total_spend:      Math.round(totalSpend * 100) / 100,
          dept_consumption: deptBreakdown,
        },
        ledger:       ledger,
        po_chain:     poItems,
        grn_chain:    grnItems,
        issuances:    issuanceItems,
        indent_lines: indentItems,
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Vendor 360 Profile ───────────────────────────────────────────────────
async function getVendorProfile(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const supplierId = parseInt(req.params.supplierId, 10);
    const { dateFrom, dateTo } = req.query;

    const supplier = await db("suppliers").where("id", supplierId).first();
    if (!supplier) return res.status(404).json({ success: false, error: "Supplier not found" });

    // POs raised to this vendor
    let poQ = db("purchase_orders as po")
      .where("po.supplier_id", supplierId)
      .join("suppliers as s", "po.supplier_id", "s.id")
      .orderBy("po.date", "desc");
    if (dateFrom) poQ = poQ.where("po.date", ">=", dateFrom);
    if (dateTo)   poQ = poQ.where("po.date", "<=", dateTo);
    const pos = await poQ.select("po.*", "s.name as supplier_name");

    const poIds = pos.map(p => p.id);

    // PO line items with categories from stock
    const poItems = poIds.length > 0
      ? await db("purchase_order_items as poi")
          .whereIn("poi.po_id", poIds)
          .leftJoin("stock as st", "poi.item_code", "st.item_code")
          .select("poi.*", "st.category", "st.unit as stock_unit")
          .groupBy("poi.id", "st.category", "st.unit")
      : [];

    // GRNs from this vendor
    let grnQ = db("goods_receipt_notes as grn")
      .where("grn.supplier_id", supplierId)
      .orderBy("grn.date", "desc");
    if (dateFrom) grnQ = grnQ.where("grn.date", ">=", dateFrom);
    if (dateTo)   grnQ = grnQ.where("grn.date", "<=", dateTo);
    const grns = await grnQ.select("grn.*");

    const grnIds = grns.map(g => g.id);
    const grnItems = grnIds.length > 0
      ? await db("goods_receipt_items as gri")
          .whereIn("gri.grn_id", grnIds)
          .leftJoin("stock as st", "gri.item_code", "st.item_code")
          .select(
            "gri.*",
            "st.category",
            db.raw("gri.grn_id as grn_id_ref")
          )
          .groupBy("gri.id", "st.category")
      : [];

    // Rate history per item (unit price trend over GRN dates)
    const priceHistory = grnIds.length > 0
      ? await db("goods_receipt_items as gri")
          .whereIn("gri.grn_id", grnIds)
          .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
          .select("gri.item_code", "gri.name", "gri.unit_price", "grn.date")
          .orderBy("grn.date", "asc")
      : [];

    // Ledger entries from this supplier
    const ledgerSpend = await db("stock_ledger")
      .where("supplier", supplier.name)
      .whereIn("transaction_type", ["INWARD_GRN", "INWARD_PURCHASE", "INWARD_DC_PROVISIONAL"])
      .select("item_code", "item_name", "category", "qty", "unit_price", "total_value", "created_at")
      .orderBy("created_at", "desc");

    // Category breakdown of spend
    const categorySpend = {};
    ledgerSpend.forEach(l => {
      const cat = l.category || "General";
      if (!categorySpend[cat]) categorySpend[cat] = { total_value: 0, total_qty: 0, items: new Set() };
      categorySpend[cat].total_value += parseFloat(l.total_value || 0);
      categorySpend[cat].total_qty  += parseFloat(l.qty || 0);
      categorySpend[cat].items.add(l.item_name);
    });
    const categoryBreakdown = Object.entries(categorySpend).map(([cat, v]) => ({
      category:    cat,
      total_value: Math.round(v.total_value * 100) / 100,
      total_qty:   Math.round(v.total_qty * 1000) / 1000,
      item_count:  v.items.size,
    })).sort((a, b) => b.total_value - a.total_value);

    // Item spend breakdown
    const itemSpend = {};
    ledgerSpend.forEach(l => {
      const key = l.item_code;
      if (!itemSpend[key]) itemSpend[key] = { item_code: l.item_code, item_name: l.item_name, category: l.category, total_value: 0, total_qty: 0, transactions: 0 };
      itemSpend[key].total_value   += parseFloat(l.total_value || 0);
      itemSpend[key].total_qty     += parseFloat(l.qty || 0);
      itemSpend[key].transactions  += 1;
    });
    const itemBreakdown = Object.values(itemSpend)
      .sort((a, b) => b.total_value - a.total_value);

    // Rate quotes if available
    const rateQuotes = await db("supplier_rate_quotes")
      .where("supplier_id", supplierId)
      .orderBy("valid_from", "desc")
      .catch(() => []);

    const totalPOValue  = pos.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
    const totalGRNValue = grns.reduce((a, g) => a + parseFloat(g.total_amount || 0), 0);

    await auditLog(req, { action: "report.vendor_profile", resource: "supplier", metadata: { supplierId } });

    res.json({
      success: true,
      data: {
        supplier,
        summary: {
          total_po_count:    pos.length,
          total_grn_count:   grns.length,
          total_po_value:    Math.round(totalPOValue * 100) / 100,
          total_grn_value:   Math.round(totalGRNValue * 100) / 100,
          total_items_traded: Object.keys(itemSpend).length,
          fill_rate:         pos.length > 0 ? Math.round((grns.length / pos.length) * 100) : 0,
        },
        pos,
        po_items:          poItems,
        grns,
        grn_items:         grnItems,
        price_history:     priceHistory,
        category_breakdown: categoryBreakdown,
        item_breakdown:    itemBreakdown,
        rate_quotes:       rateQuotes,
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Indent Trace ─────────────────────────────────────────────────────────
async function getIndentTrace(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const indentId = parseInt(req.params.indentId, 10);

    const indent = await db("indents").where("id", indentId).first();
    if (!indent) return res.status(404).json({ success: false, error: "Indent not found" });

    // Indent line items
    const items = await db("indent_items").where("indent_id", indentId).catch(() => []);

    // For each item_code in the indent, find issuances on the same date+dept
    const itemCodes = [...new Set(items.map(i => i.item_code).filter(Boolean))];

    const issuanceLines = itemCodes.length > 0
      ? await db("issuance_items as ii")
          .join("issuances as iss", "ii.issuance_id", "iss.id")
          .whereIn("ii.item_code", itemCodes)
          .where("iss.dept", indent.dept)
          .whereRaw("DATE(iss.date) = DATE(?)", [indent.date])
          .select(
            "ii.item_code", "ii.qty_issued", "ii.unit",
            "iss.id as issuance_id", "iss.dept", "iss.date", "iss.issued_by", "iss.notes"
          )
          .catch(() => [])
      : [];

    // Ledger deductions for those item codes from that dept on indent date
    const ledgerDeductions = itemCodes.length > 0
      ? await db("stock_ledger")
          .whereIn("item_code", itemCodes)
          .where("department", indent.dept)
          .where("transaction_type", "OUTWARD_ISSUE")
          .whereRaw("DATE(created_at) = DATE(?)", [indent.date])
          .select("item_code", "item_name", "qty", "unit", "balance_qty_before", "balance_qty_after", "batch_no", "created_at")
          .orderBy("created_at", "asc")
          .catch(() => [])
      : [];

    // Build per-item trace map
    const traceMap = items.map(item => {
      const issued = issuanceLines.filter(i => i.item_code === item.item_code);
      const deducted = ledgerDeductions.filter(l => l.item_code === item.item_code);
      const totalIssued = issued.reduce((a, i) => a + parseFloat(i.qty_issued || 0), 0);
      const requested = parseFloat(item.qty || 0);
      const fulfillmentPct = requested > 0 ? Math.round((totalIssued / requested) * 100) : 0;
      return {
        ...item,
        issued_lines:    issued,
        ledger_lines:    deducted,
        total_issued:    totalIssued,
        fulfillment_pct: fulfillmentPct,
        status:          fulfillmentPct === 0 ? "PENDING" : fulfillmentPct >= 100 ? "FULL" : "PARTIAL",
      };
    });

    const totalRequested = traceMap.reduce((a, i) => a + parseFloat(i.qty || 0), 0);
    const totalIssued    = traceMap.reduce((a, i) => a + i.total_issued, 0);
    const fullItems      = traceMap.filter(i => i.status === "FULL").length;
    const partialItems   = traceMap.filter(i => i.status === "PARTIAL").length;
    const pendingItems   = traceMap.filter(i => i.status === "PENDING").length;

    await auditLog(req, { action: "report.indent_trace", resource: "indent", metadata: { indentId } });

    res.json({
      success: true,
      data: {
        indent,
        summary: {
          total_items:     items.length,
          full_items:      fullItems,
          partial_items:   partialItems,
          pending_items:   pendingItems,
          total_requested: Math.round(totalRequested * 1000) / 1000,
          total_issued:    Math.round(totalIssued * 1000) / 1000,
          overall_fulfillment_pct: totalRequested > 0 ? Math.round((totalIssued / totalRequested) * 100) : 0,
        },
        trace: traceMap,
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Category / Dish Lens ─────────────────────────────────────────────────
async function getCategoryLens(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const { category, dateFrom, dateTo, department } = req.query;

    // Stock items in this category
    let stockQ = db("stock").orderBy("name");
    if (category) stockQ = stockQ.where("category", category);
    const categoryItems = await stockQ.select("item_code", "name", "category", "unit", "remaining", "price", "supplier_id");

    const itemCodes = categoryItems.map(i => i.item_code).filter(Boolean);

    // Ledger for these items
    let ledgerQ = db("stock_ledger")
      .whereIn("item_code", itemCodes)
      .orderBy("created_at", "desc");
    if (dateFrom)   ledgerQ = ledgerQ.where("created_at", ">=", dateFrom);
    if (dateTo)     ledgerQ = ledgerQ.where("created_at", "<=", dateTo + "T23:59:59Z");
    if (department) ledgerQ = ledgerQ.where("department", department);
    const ledger = itemCodes.length > 0 ? await ledgerQ : [];

    // GRN items for this category
    let grnQ = db("goods_receipt_items as gri")
      .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
      .join("suppliers as s", "grn.supplier_id", "s.id")
      .whereIn("gri.item_code", itemCodes)
      .select("gri.item_code", "gri.name", "gri.qty_accepted", "gri.unit_price", "gri.landed_cost", "grn.date", "s.name as supplier_name");
    if (dateFrom) grnQ = grnQ.where("grn.date", ">=", dateFrom);
    if (dateTo)   grnQ = grnQ.where("grn.date", "<=", dateTo);
    const grnData = itemCodes.length > 0 ? await grnQ : [];

    // Per-item summary
    const itemSummary = categoryItems.map(item => {
      const itemLedger   = ledger.filter(l => l.item_code === item.item_code);
      const inward       = itemLedger.filter(l => l.transaction_type.startsWith("INWARD")).reduce((a, l) => a + parseFloat(l.qty || 0), 0);
      const outward      = itemLedger.filter(l => l.transaction_type.startsWith("OUTWARD")).reduce((a, l) => a + parseFloat(l.qty || 0), 0);
      const totalSpend   = grnData.filter(g => g.item_code === item.item_code).reduce((a, g) => a + parseFloat(g.landed_cost || 0), 0);
      const suppliers    = [...new Set(grnData.filter(g => g.item_code === item.item_code).map(g => g.supplier_name))];
      const depts        = [...new Set(itemLedger.filter(l => l.department).map(l => l.department))];
      return {
        item_code:    item.item_code,
        name:         item.name,
        category:     item.category,
        unit:         item.unit,
        current_stock: parseFloat(item.remaining || 0),
        total_inward: Math.round(inward * 1000) / 1000,
        total_outward: Math.round(outward * 1000) / 1000,
        total_spend:  Math.round(totalSpend * 100) / 100,
        avg_price:    inward > 0 ? Math.round((totalSpend / inward) * 100) / 100 : parseFloat(item.price || 0),
        suppliers,
        departments:  depts,
      };
    });

    // Dept consumption breakdown across all items in category
    const deptConsumption = {};
    ledger.filter(l => l.department && l.transaction_type === "OUTWARD_ISSUE").forEach(l => {
      const d = l.department;
      if (!deptConsumption[d]) deptConsumption[d] = { qty: 0, value: 0 };
      deptConsumption[d].qty   += parseFloat(l.qty || 0);
      deptConsumption[d].value += parseFloat(l.total_value || 0);
    });

    // Supplier breakdown for this category
    const supplierSpend = {};
    grnData.forEach(g => {
      const s = g.supplier_name;
      if (!supplierSpend[s]) supplierSpend[s] = { supplier: s, total_value: 0, items: new Set() };
      supplierSpend[s].total_value += parseFloat(g.landed_cost || 0);
      supplierSpend[s].items.add(g.item_code);
    });
    const supplierBreakdown = Object.values(supplierSpend).map(s => ({
      supplier:    s.supplier,
      total_value: Math.round(s.total_value * 100) / 100,
      item_count:  s.items.size,
    })).sort((a, b) => b.total_value - a.total_value);

    const totalCategorySpend = itemSummary.reduce((a, i) => a + i.total_spend, 0);
    const totalCategoryOutward = itemSummary.reduce((a, i) => a + i.total_outward, 0);

    res.json({
      success: true,
      data: {
        category: category || "All Categories",
        summary: {
          total_items:    categoryItems.length,
          total_spend:    Math.round(totalCategorySpend * 100) / 100,
          total_outward:  Math.round(totalCategoryOutward * 1000) / 1000,
          total_ledger_entries: ledger.length,
        },
        items:          itemSummary,
        dept_consumption: Object.entries(deptConsumption).map(([dept, v]) => ({
          dept,
          qty:   Math.round(v.qty * 1000) / 1000,
          value: Math.round(v.value * 100) / 100,
        })).sort((a, b) => b.value - a.value),
        supplier_breakdown: supplierBreakdown,
        ledger_sample:  ledger.slice(0, 100),
      },
    });
  } catch (err) { next(err); }
}

// ── NEW: Cross-Module Intelligence & Anomaly Engine (Multi-Agent) ─────────────
// ── Report Settings (admin-configurable thresholds) ──────────────────────────
const REPORT_SETTINGS_DEFAULTS = { price_spike_pct: 12, dormancy_days: 7 };

async function loadReportSettings() {
  const settings = { ...REPORT_SETTINGS_DEFAULTS };
  try {
    const rows = await db("report_settings").whereIn("key", Object.keys(REPORT_SETTINGS_DEFAULTS));
    rows.forEach((row) => {
      const raw = row.value;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed !== null && parsed !== undefined && !Number.isNaN(Number(parsed))) {
        settings[row.key] = Number(parsed);
      }
    });
  } catch (err) {
    console.error("[reportController] Failed to load report_settings, using defaults:", err.message);
  }
  return settings;
}

async function getReportSettings(req, res, next) {
  try {
    const settings = await loadReportSettings();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}

async function updateReportSettings(req, res, next) {
  try {
    const { price_spike_pct, dormancy_days } = req.body || {};
    const updates = [];
    if (price_spike_pct !== undefined) {
      const n = Number(price_spike_pct);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: "price_spike_pct must be a positive number" });
      updates.push({ key: "price_spike_pct", value: JSON.stringify(n) });
    }
    if (dormancy_days !== undefined) {
      const n = Number(dormancy_days);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: "dormancy_days must be a positive number" });
      updates.push({ key: "dormancy_days", value: JSON.stringify(n) });
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: "No valid settings provided" });

    for (const u of updates) {
      await db("report_settings")
        .insert({ key: u.key, value: u.value, updated_at: db.fn.now() })
        .onConflict("key")
        .merge({ value: u.value, updated_at: db.fn.now() });
    }

    await auditLog?.({
      userId: req.user?.id,
      action: "report_settings.update",
      details: { updates: updates.map((u) => u.key) },
    }).catch?.(() => {});

    const settings = await loadReportSettings();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}

// ── Valuation Trend (stock_ledger value over time) ────────────────────────────
async function getValuationTrend(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rows = await db("stock_ledger")
      .where("created_at", ">=", sinceDate)
      .select(db.raw("DATE(created_at) as day"), "total_value")
      .orderBy("day", "asc");

    const byDay = {};
    rows.forEach((r) => {
      const day = (r.day instanceof Date) ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + parseFloat(r.total_value || 0);
    });

    const trend = Object.keys(byDay).sort().map((day) => ({
      date: day,
      value: Math.round(byDay[day] * 100) / 100,
    }));

    res.json({ success: true, data: { days, trend } });
  } catch (err) { next(err); }
}

async function getCrossModuleInsights(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const reportSettings = await loadReportSettings();
    const priceSpikeThresholdPct = reportSettings.price_spike_pct;
    const dormancyDays = reportSettings.dormancy_days;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - dormancyDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Parallel multi-agent queries — one failing sub-query degrades that
    // agent's slice (with a visible error) rather than 500ing the whole
    // dashboard or silently reporting fake zeros.
    const [
      allStocksR, recentGrnItemsR, recentOutwardLedgerR, pendingIndentsR, supplierQualityR
    ] = await Promise.all([
      safeQuery("stock", db("stock").select("item_code", "name", "category", "unit", "remaining", "price", "min_alert_qty")),
      safeQuery("recent_grn_items", db("goods_receipt_items as gri")
        .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
        .leftJoin("suppliers as s", "grn.supplier_id", "s.id")
        .select("gri.item_code", "gri.item_name", "gri.unit_price", "gri.landed_cost", "gri.qty_received", "gri.qty_accepted", "gri.qty_rejected", "grn.date", "s.name as supplier_name", "s.id as supplier_id")
        .orderBy("grn.date", "desc")
        .limit(500)),
      safeQuery("recent_outward_ledger", db("stock_ledger")
        .where("transaction_type", "OUTWARD_ISSUE")
        .where("created_at", ">=", sevenDaysAgo)
        .select("item_code", "qty", "unit_price", "total_value", "department", "created_at")),
      safeQuery("pending_indents", db("indents as ind")
        .join("indent_items as ii", "ind.id", "ii.indent_id")
        .whereIn("ind.status", ["Pending", "Draft", "Partially Approved", "Approved"])
        .select("ind.id as indent_id", "ind.dept", "ind.date", "ind.status", "ii.item_code", "ii.qty", "ii.issued_qty", "ii.unit")),
      safeQuery("supplier_quality", db("goods_receipt_items as gri")
        .join("goods_receipt_notes as grn", "gri.grn_id", "grn.id")
        .leftJoin("suppliers as s", "grn.supplier_id", "s.id")
        .select("s.id as supplier_id", "s.name as supplier_name", "gri.qty_received", "gri.qty_accepted", "gri.qty_rejected")),
    ]);

    const allStocks = allStocksR.data;
    const recentGrnItems = recentGrnItemsR.data;
    const recentOutwardLedger = recentOutwardLedgerR.data;
    const pendingIndents = pendingIndentsR.data;
    const supplierQuality = supplierQualityR.data;

    const queryErrors = [allStocksR, recentGrnItemsR, recentOutwardLedgerR, pendingIndentsR, supplierQualityR]
      .filter((r) => r.error)
      .map((r) => ({ agent: r.label, message: r.error }));

    // 1. Agent Analyst: Detect Price Spike Anomalies
    const itemPrices = {};
    recentGrnItems.forEach(g => {
      if (!g.item_code || !g.landed_cost) return;
      const cost = parseFloat(g.landed_cost || g.unit_price || 0);
      if (cost <= 0) return;
      if (!itemPrices[g.item_code]) {
        itemPrices[g.item_code] = {
          item_code: g.item_code,
          name: g.item_name,
          latest_price: cost,
          latest_date: g.date,
          supplier_name: g.supplier_name,
          supplier_id: g.supplier_id,
          history: [],
        };
      }
      itemPrices[g.item_code].history.push(cost);
    });

    const priceAnomalies = [];
    Object.values(itemPrices).forEach(item => {
      if (item.history.length >= 2) {
        const histWithoutLatest = item.history.slice(1);
        const avgHist = histWithoutLatest.reduce((a, b) => a + b, 0) / histWithoutLatest.length;
        if (avgHist > 0) {
          const jumpPercent = ((item.latest_price - avgHist) / avgHist) * 100;
          if (jumpPercent >= priceSpikeThresholdPct) {
            priceAnomalies.push({
              item_code: item.item_code,
              name: item.name,
              latest_price: Math.round(item.latest_price * 100) / 100,
              avg_historical_price: Math.round(avgHist * 100) / 100,
              spike_pct: Math.round(jumpPercent * 10) / 10,
              supplier_name: item.supplier_name || "Unknown Supplier",
              supplier_id: item.supplier_id,
              date: item.latest_date,
              severity: jumpPercent > 25 ? "HIGH" : "MEDIUM",
            });
          }
        }
      }
    });
    priceAnomalies.sort((a, b) => b.spike_pct - a.spike_pct);

    // 2. Agent Analyst: Cold / Dormant Items (>30 days inactive with stock value locked)
    const activeItemCodes7d = new Set(recentOutwardLedger.map(l => l.item_code));
    const coldItems = [];
    let dormantCapitalLocked = 0;

    allStocks.forEach(s => {
      const remaining = parseFloat(s.remaining || 0);
      const price = parseFloat(s.price || 0);
      if (remaining > 0 && !activeItemCodes7d.has(s.item_code)) {
        const value = remaining * price;
        dormantCapitalLocked += value;
        coldItems.push({
          item_code: s.item_code,
          name: s.name,
          category: s.category,
          unit: s.unit,
          remaining: Math.round(remaining * 1000) / 1000,
          unit_price: Math.round(price * 100) / 100,
          value_locked: Math.round(value * 100) / 100,
          status: `Dormant (>${dormancyDays}d without issue)`,
        });
      }
    });
    coldItems.sort((a, b) => b.value_locked - a.value_locked);

    // 3. Agent Scout: Hot Velocity Items (Kitchen Demand Top Drivers in last 7 days)
    const velocityMap = {};
    recentOutwardLedger.forEach(l => {
      if (!velocityMap[l.item_code]) {
        velocityMap[l.item_code] = { item_code: l.item_code, total_qty: 0, total_value: 0, departments: {} };
      }
      velocityMap[l.item_code].total_qty += parseFloat(l.qty || 0);
      velocityMap[l.item_code].total_value += parseFloat(l.total_value || (l.qty * l.unit_price) || 0);
      if (l.department) {
        velocityMap[l.item_code].departments[l.department] = (velocityMap[l.item_code].departments[l.department] || 0) + parseFloat(l.qty || 0);
      }
    });

    const stockNameMap = {};
    allStocks.forEach(s => { stockNameMap[s.item_code] = s; });

    const hotVelocityItems = Object.values(velocityMap).map(v => {
      const st = stockNameMap[v.item_code] || {};
      const topDept = Object.entries(v.departments).sort((a, b) => b[1] - a[1])[0];
      return {
        item_code: v.item_code,
        name: st.name || v.item_code,
        category: st.category || "General",
        unit: st.unit || "units",
        velocity_7d: Math.round(v.total_qty * 1000) / 1000,
        value_consumed_7d: Math.round(v.total_value * 100) / 100,
        top_department: topDept ? `${topDept[0]} (${Math.round(topDept[1])} ${st.unit || ""})` : "General",
      };
    }).sort((a, b) => b.velocity_7d - a.velocity_7d);

    // 4. Agent PO-GRN: Supplier Quality & Fill-Rate Alerts
    const supplierStats = {};
    supplierQuality.forEach(sq => {
      if (!sq.supplier_id) return;
      if (!supplierStats[sq.supplier_id]) {
        supplierStats[sq.supplier_id] = {
          id: sq.supplier_id,
          name: sq.supplier_name || "Unknown",
          total_received: 0,
          total_accepted: 0,
          total_rejected: 0,
        };
      }
      supplierStats[sq.supplier_id].total_received += parseFloat(sq.qty_received || 0);
      supplierStats[sq.supplier_id].total_accepted += parseFloat(sq.qty_accepted || 0);
      supplierStats[sq.supplier_id].total_rejected += parseFloat(sq.qty_rejected || 0);
    });

    const supplierAlerts = [];
    Object.values(supplierStats).forEach(s => {
      if (s.total_received > 0) {
        const fillRate = (s.total_accepted / s.total_received) * 100;
        if (fillRate < 92 || s.total_rejected > 0) {
          supplierAlerts.push({
            supplier_id: s.id,
            name: s.name,
            total_received: Math.round(s.total_received * 100) / 100,
            total_accepted: Math.round(s.total_accepted * 100) / 100,
            total_rejected: Math.round(s.total_rejected * 100) / 100,
            fill_rate_pct: Math.round(fillRate * 10) / 10,
            alert: s.total_rejected > 0 ? "Quality Rejections Recorded" : "Sub-optimal Fill Rate",
          });
        }
      }
    });
    supplierAlerts.sort((a, b) => a.fill_rate_pct - b.fill_rate_pct);

    // 5. Agent Indent: Unfulfilled / Bottleneck Indents
    const unfulfilledLines = pendingIndents.filter(pi => {
      const requested = parseFloat(pi.qty || 0);
      const issued = parseFloat(pi.issued_qty || 0);
      return requested > issued;
    });

    // 6. Agent Composer: AI Synthesis Highlights
    const totalInventoryValue = allStocks.reduce((sum, s) => sum + (parseFloat(s.remaining || 0) * parseFloat(s.price || 0)), 0);
    const executiveComposerNotes = [
      `Price Watch: ${priceAnomalies.length} SKU(s) triggered cost spike alerts (>${priceSpikeThresholdPct}% variance vs historical baseline).`,
      `Working Capital: ₹${Math.round(dormantCapitalLocked).toLocaleString("en-IN")} locked across ${coldItems.length} dormant inventory lines.`,
      `Kitchen Velocity: ${hotVelocityItems.slice(0, 3).map(h => h.name).join(", ") || "Active items"} driving >60% of 7-day culinary consumption.`,
      `Fulfillment Health: ${unfulfilledLines.length} indent request item(s) pending warehouse dispatch.`,
      supplierAlerts.length > 0
        ? `Vendor Risk: ${supplierAlerts.length} vendor(s) flagged for fill-rate shortfall or item rejections.`
        : `Vendor Health: All active suppliers maintaining clean delivery standards.`,
    ];

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        summary: {
          total_skus: allStocks.length,
          total_inventory_valuation: Math.round(totalInventoryValue * 100) / 100,
          dormant_capital_locked: Math.round(dormantCapitalLocked * 100) / 100,
          price_anomalies_count: priceAnomalies.length,
          cold_items_count: coldItems.length,
          supplier_alerts_count: supplierAlerts.length,
          unfulfilled_indents_count: unfulfilledLines.length,
        },
        price_anomalies: priceAnomalies.slice(0, 15),
        cold_items: coldItems.slice(0, 20),
        hot_velocity_items: hotVelocityItems.slice(0, 15),
        supplier_alerts: supplierAlerts,
        unfulfilled_indents: unfulfilledLines.slice(0, 25),
        composer_synthesis: executiveComposerNotes,
        query_errors: queryErrors,
        degraded: queryErrors.length > 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── NEW: Data Quality & System Integrity Audit (Agent Veritas) ────────────────
async function getDataQualityAudit(req, res, next) {
  try {
    if (!canViewReports(req.user)) return res.status(403).json({ success: false, error: "Forbidden" });

    const [negativeBalancesR, zeroPriceStocksR, unlinkedLedgersR, indentVariancesR] = await Promise.all([
      safeQuery("negative_balances", db("stock_ledger").where("balance_qty_after", "<", 0).select("id", "item_code", "balance_qty_after", "transaction_type", "created_at").limit(50)),
      safeQuery("zero_price_stocks", db("stock").where("remaining", ">", 0).andWhere(function() { this.where("price", "<=", 0).orWhereNull("price"); }).select("item_code", "name", "remaining", "price")),
      safeQuery("unlinked_ledgers", db("stock_ledger").whereNull("item_code").orWhere("item_code", "").select("id", "transaction_type", "created_at")),
      safeQuery("indent_variances", db("indent_items as ii")
        .join("indents as ind", "ii.indent_id", "ind.id")
        .whereRaw("ii.issued_qty > ii.qty")
        .select("ii.id", "ind.id as indent_id", "ind.dept", "ii.item_code", "ii.qty", "ii.issued_qty")
        .limit(50)),
    ]);

    const negativeBalances = negativeBalancesR.data;
    const zeroPriceStocks = zeroPriceStocksR.data;
    const unlinkedLedgers = unlinkedLedgersR.data;
    const indentVariances = indentVariancesR.data;

    const queryErrors = [negativeBalancesR, zeroPriceStocksR, unlinkedLedgersR, indentVariancesR]
      .filter((r) => r.error)
      .map((r) => ({ agent: r.label, message: r.error }));

    const issues = [];

    queryErrors.forEach((qe) => {
      issues.push({
        code: "VERITAS_AGENT_ERROR",
        severity: "CRITICAL",
        title: `Audit Agent '${qe.agent}' Failed`,
        description: `The '${qe.agent}' check could not run: ${qe.message}`,
        impact: "This check's findings are unavailable — treat this area as unaudited, not as clean.",
        recommendation: "Investigate the underlying query/schema error and re-run the audit.",
        count: null,
        samples: [],
      });
    });

    if (negativeBalances.length > 0) {
      issues.push({
        code: "VERITAS_NEG_BAL",
        severity: "CRITICAL",
        title: "Negative Stock Ledger Balances",
        description: `${negativeBalances.length} transaction entries resulted in negative physical stock balance.`,
        impact: "Inventory distortion & potential phantom stock.",
        recommendation: "Run Stock Reconciliation or post compensatory ADJUSTMENT_ADD entry.",
        count: negativeBalances.length,
        samples: negativeBalances.slice(0, 5),
      });
    }

    if (zeroPriceStocks.length > 0) {
      issues.push({
        code: "VERITAS_ZERO_PRICE",
        severity: "WARNING",
        title: "Active Stock With Zero / Missing Valuation",
        description: `${zeroPriceStocks.length} SKU(s) hold physical units but have ₹0.00 unit purchase price.`,
        impact: "Understates total enterprise balance sheet valuation.",
        recommendation: "Update landed purchase cost from recent GRN or supplier price list.",
        count: zeroPriceStocks.length,
        samples: zeroPriceStocks.slice(0, 5),
      });
    }

    if (indentVariances.length > 0) {
      issues.push({
        code: "VERITAS_OVER_ISSUE",
        severity: "WARNING",
        title: "Over-Issuance Beyond Indent Requisition",
        description: `${indentVariances.length} indent line item(s) had issued quantity exceeding requisitioned quantity.`,
        impact: "Kitchen station budget leakage & unaccounted consumption.",
        recommendation: "Review storekeeper issuance protocol against kitchen indents.",
        count: indentVariances.length,
        samples: indentVariances.slice(0, 5),
      });
    }

    if (unlinkedLedgers.length > 0) {
      issues.push({
        code: "VERITAS_ORPHAN_ENTRY",
        severity: "INFO",
        title: "Unlinked Ledger Transactions",
        description: `${unlinkedLedgers.length} ledger row(s) missing associated SKU identifier.`,
        impact: "Audit trail fragmentation.",
        recommendation: "Archive or retag orphaned records.",
        count: unlinkedLedgers.length,
        samples: unlinkedLedgers.slice(0, 5),
      });
    }

    // Compute System Integrity Score (100 - penalties)
    let penalty = 0;
    if (negativeBalances.length > 0) penalty += Math.min(25, negativeBalances.length * 5);
    if (zeroPriceStocks.length > 0)   penalty += Math.min(15, zeroPriceStocks.length * 2);
    if (indentVariances.length > 0)   penalty += Math.min(10, indentVariances.length * 2);
    if (unlinkedLedgers.length > 0)   penalty += Math.min(5, unlinkedLedgers.length);

    const integrityScore = Math.max(60, 100 - penalty);

    res.json({
      success: true,
      data: {
        audited_at: new Date().toISOString(),
        integrity_score: integrityScore,
        status: queryErrors.length > 0
          ? "PARTIAL_AUDIT_FAILED"
          : integrityScore >= 95 ? "EXCELLENT" : integrityScore >= 85 ? "STABLE" : "ATTENTION_REQUIRED",
        total_issues_found: issues.length,
        issues,
        query_errors: queryErrors,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── End-of-Day stock report: real per-item breakdown + Excel + WhatsApp ────────
// POST /api/reports/eod/run — computes the full EOD stock report for `date`
// (defaults to today), sends the WhatsApp digest to the admin number, and
// streams back the Excel workbook. Admin-gated (requirePermission in the
// route, same pattern as system-reset / report-settings).
async function runEodReport(req, res, next) {
  try {
    const date = req.body?.date || req.query?.date || new Date().toISOString().slice(0, 10);

    const granularity = req.query?.granularity || req.body?.granularity || "overall";
    if (!eodReportService.VALID_GRANULARITIES.includes(granularity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid granularity '${granularity}'. Must be one of: ${eodReportService.VALID_GRANULARITIES.join(", ")}`,
      });
    }

    const { eodData, whatsappResult } = await eodReportService.runEodReport(date, granularity);
    const workbook = eodReportService.buildEodWorkbook(eodData);
    const filename = granularity === "overall"
      ? `Kapila_EOD_Report_${date}.xlsx`
      : `Kapila_EOD_Report_${date}_by_${granularity}.xlsx`;

    await auditLog(req, {
      action: "report.eod_run",
      resource: "eod_report",
      metadata: { date, granularity, totals: eodData.totals, whatsapp_sent: whatsappResult?.sent === true },
    });

    // Return both: the Excel as the response body (download), plus the
    // WhatsApp status and day totals in headers so the caller doesn't have
    // to parse the workbook to know whether the digest went out.
    res.setHeader("X-EOD-Whatsapp-Sent", String(whatsappResult?.sent === true));
    res.setHeader("X-EOD-Items-Tracked", String(eodData.totals.totalItems));
    res.setHeader("X-EOD-Items-Moved", String(eodData.totals.itemsMoved));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EOD report run failed:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else next(err);
  }
}

// ── Indent & Purchase Intelligence report: indents/POs/GRNs/anomalies/
// approval-times/hourly-distribution for the day, sent via WhatsApp digest
// to admin + store manager, and streamed back as an Excel workbook.
// POST /api/reports/indent-intelligence/run — admin/manager/store_manager
// gated (requirePermission in the route, same pattern as eod/run).
async function runIndentIntelligenceReport(req, res, next) {
  try {
    const date = req.body?.date || req.query?.date || new Date().toISOString().slice(0, 10);

    const { data, whatsappResult } = await indentIntelligenceReportService.runIndentIntelligenceReport(date);
    const workbook = indentIntelligenceReportService.buildIndentIntelligenceWorkbook(data);
    const filename = `Kapila_Indent_Intelligence_Report_${date}.xlsx`;

    await auditLog(req, {
      action: "report.indent_intelligence_run",
      resource: "indent_intelligence_report",
      metadata: {
        date,
        totals: {
          indents: data.indents.total,
          pos: data.purchases.total_pos,
          grns: data.grn.total_count,
          beyond_expectation: data.beyondExpectation.items.length,
        },
        whatsapp_sent: whatsappResult?.sent === true,
      },
    });

    res.setHeader("X-Indent-Intelligence-Whatsapp-Sent", String(whatsappResult?.sent === true));
    res.setHeader("X-Indent-Intelligence-Total-Indents", String(data.indents.total));
    res.setHeader("X-Indent-Intelligence-Beyond-Expectation-Count", String(data.beyondExpectation.items.length));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Indent Intelligence report run failed:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
    else next(err);
  }
}

module.exports = {
  exportInventoryExcel,
  previewInventoryMetadata,
  getAdminDimensions: withTtlCache("adminDimensions", getAdminDimensions),
  getItemHistory,
  getVendorProfile,
  getIndentTrace,
  getCategoryLens,
  getCrossModuleInsights,
  getDataQualityAudit,
  getReportSettings,
  updateReportSettings,
  getValuationTrend,
  runEodReport,
  runIndentIntelligenceReport,
};
