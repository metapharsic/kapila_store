const db = require("../db");
const { generatePONumber } = require("../controllers/purchaseOrderController");
const { createApprovalRequest } = require("../controllers/approvalController");

const PLACEHOLDER_SUPPLIERS = ["opening stock", "unknown", "n/a", "none", "initial inventory audit"];

/**
 * ReorderAgentEngine
 * Modular multi-agent engine for Hotel Kapila Reorder Points.
 * Coordinates Stockout Sentinel, Velocity Forecaster, Vendor Strategist, and Auto-Draft Dispatcher.
 */
class ReorderAgentEngine {
  constructor(options = {}) {
    this.leadTimeSafetyFactor = options.leadTimeSafetyFactor || 1.25;
    this.topUpCycleDays = options.topUpCycleDays || 7;
    this.chunkSize = options.chunkSize || 25;
  }

  /**
   * Run parallel queries to fetch stock balances, 14-day consumption, and vendor rates
   */
  async fetchInventoryData(itemCodes = null) {
    const pointsQuery = db("reorder_points")
      .leftJoin("suppliers", "reorder_points.preferred_supplier_id", "suppliers.id")
      .select(
        "reorder_points.*",
        "suppliers.name as preferred_supplier_name",
        "suppliers.phone as preferred_supplier_phone"
      );

    if (itemCodes && itemCodes.length > 0) {
      pointsQuery.whereIn("reorder_points.item_code", itemCodes);
    }

    const points = await pointsQuery;
    const targetCodes = points.map((p) => p.item_code);

    if (targetCodes.length === 0) {
      return { points: [], stockMap: {}, consumptionMap: {}, supplierMap: {} };
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);

    // Run parallel queries across database connections
    const [stockLevels, consumptionRows, purchaseRows] = await Promise.all([
      db("stock")
        .whereIn("item_code", targetCodes)
        .select("item_code", "category", "unit")
        .sum("remaining as total_remaining")
        .avg("price as avg_price")
        .groupBy("item_code", "category", "unit"),

      db("issuance_items")
        .join("issuances", "issuances.id", "issuance_items.issuance_id")
        .where("issuances.date", ">=", fourteenDaysAgoStr)
        .whereIn("issuance_items.item_code", targetCodes)
        .select("issuance_items.item_code")
        .sum("issuance_items.issued as total_issued")
        .groupBy("issuance_items.item_code"),

      db("stock")
        .whereIn("item_code", targetCodes)
        .whereNotNull("supplier")
        .whereNotNull("price")
        .where("price", ">", 0)
        .whereNotIn(db.raw("LOWER(supplier)"), PLACEHOLDER_SUPPLIERS)
        .select("item_code", "supplier", "price")
        .orderBy("price", "asc")
    ]);

    const stockMap = {};
    stockLevels.forEach((s) => {
      stockMap[s.item_code] = {
        remaining: parseFloat(s.total_remaining || 0),
        category: s.category || "General",
        unit: s.unit || "kg",
        avg_price: parseFloat(s.avg_price || 0)
      };
    });

    const consumptionMap = {};
    consumptionRows.forEach((c) => {
      consumptionMap[c.item_code] = parseFloat(c.total_issued || 0);
    });

    const supplierMap = {};
    purchaseRows.forEach((p) => {
      if (!supplierMap[p.item_code]) supplierMap[p.item_code] = [];
      const supName = p.supplier.trim();
      if (!supplierMap[p.item_code].some((s) => s.supplier.toLowerCase() === supName.toLowerCase())) {
        supplierMap[p.item_code].push({
          supplier: supName,
          price: parseFloat(p.price)
        });
      }
    });

    return { points, stockMap, consumptionMap, supplierMap };
  }

  /**
   * Evaluates each SKU through Sentinel, Forecaster, and Strategist
   */
  async evaluateAll(itemCodes = null) {
    const { points, stockMap, consumptionMap, supplierMap } = await this.fetchInventoryData(itemCodes);

    const evaluated = points.map((p) => {
      const stock = stockMap[p.item_code] || { remaining: 0, category: "General", unit: "kg", avg_price: 0 };
      const currentStock = stock.remaining;
      const unit = stock.unit || "kg";
      const totalIssued14 = consumptionMap[p.item_code] || 0;
      const dailyVelocity = parseFloat((totalIssued14 / 14).toFixed(3));

      // Forecaster: Days To Stockout
      let daysToOut = 999;
      if (currentStock <= 0) {
        daysToOut = 0;
      } else if (dailyVelocity > 0) {
        daysToOut = parseFloat((currentStock / dailyVelocity).toFixed(1));
      }

      // Sentinel: Buffer Health
      const minQty = parseFloat(p.min_qty || 0);
      const reorderQty = parseFloat(p.reorder_qty || 10);
      const leadTime = parseInt(p.lead_time_days || 3, 10);

      const isBreached = currentStock <= minQty;
      const isCritical = currentStock <= 0 || daysToOut <= leadTime;
      const bufferHealthPct = minQty > 0 ? Math.round((currentStock / minQty) * 100) : 100;

      let riskLevel = "OPTIMAL";
      if (currentStock <= 0) riskLevel = "STOCKOUT";
      else if (isCritical) riskLevel = "CRITICAL";
      else if (isBreached) riskLevel = "BREACHED";
      else if (daysToOut <= leadTime * 2) riskLevel = "WARNING";

      // Strategist: Supplier selection & spend modeling
      const vendors = supplierMap[p.item_code] || [];
      const cheapest = vendors[0] || null;
      const selectedSupplier = p.preferred_supplier_name || (cheapest ? cheapest.supplier : null);
      const selectedPhone = p.preferred_supplier_phone || "";
      const unitCost = cheapest ? cheapest.price : stock.avg_price || 0;
      const projectedSpend = Math.round(reorderQty * unitCost * 100) / 100;

      // Smart Recalibration suggestion
      const suggestedMinQty = Math.max(1, Math.round(leadTime * dailyVelocity * this.leadTimeSafetyFactor * 10) / 10);
      const suggestedReorderQty = Math.max(suggestedMinQty, Math.round(this.topUpCycleDays * dailyVelocity * 10) / 10);

      // WhatsApp link generator
      const canWhatsApp = !!(selectedSupplier && selectedPhone.replace(/[^0-9]/g, ""));
      const waText = `Hi ${selectedSupplier}, please supply the following item for Hotel Kapila:\n- ${p.name} (${p.item_code}): ${reorderQty} ${unit}\n\nPlease confirm availability and delivery schedule. Thank you!`;
      const waLink = canWhatsApp
        ? `https://wa.me/${selectedPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waText)}`
        : null;

      return {
        id: p.id,
        item_code: p.item_code,
        name: p.name,
        category: stock.category,
        current_stock: currentStock,
        unit,
        min_qty: minQty,
        reorder_qty: reorderQty,
        lead_time_days: leadTime,
        daily_velocity: dailyVelocity,
        days_to_out: daysToOut,
        buffer_health_pct: bufferHealthPct,
        is_breached: isBreached,
        is_critical: isCritical,
        risk_level: riskLevel,
        is_active: p.is_active,
        preferred_supplier_id: p.preferred_supplier_id,
        preferred_supplier_name: p.preferred_supplier_name,
        cheapest_supplier: cheapest,
        recommended_supplier: selectedSupplier,
        recommended_phone: selectedPhone,
        unit_cost: unitCost,
        projected_spend: projectedSpend,
        suggested_min_qty: suggestedMinQty,
        suggested_reorder_qty: suggestedReorderQty,
        needs_reorder: isBreached || isCritical,
        wa_link: waLink,
        notes: p.notes
      };
    });

    return evaluated;
  }

  /**
   * Generates aggregated telemetry across the 4 agents
   */
  async getTelemetry() {
    const evaluated = await this.evaluateAll();

    const totalActive = evaluated.filter((e) => e.is_active).length;
    const breachedItems = evaluated.filter((e) => e.is_active && e.is_breached);
    const criticalItems = evaluated.filter((e) => e.is_active && e.is_critical);
    const stockoutItems = evaluated.filter((e) => e.is_active && e.current_stock <= 0);

    const totalSpendRequired = breachedItems.reduce((sum, item) => sum + item.projectedSpend, 0);

    return {
      agent_sentinel: {
        name: "Agent Stockout Sentinel",
        role: "Safety Buffer & Breach Detection",
        status: criticalItems.length > 0 ? "CRITICAL" : breachedItems.length > 0 ? "WARNING" : "HEALTHY",
        total_rules: totalActive,
        breached_count: breachedItems.length,
        critical_count: criticalItems.length,
        stockout_count: stockoutItems.length,
        breached_items: breachedItems.slice(0, 10)
      },
      agent_forecaster: {
        name: "Agent Velocity Forecaster",
        role: "14-Day Depletion Run-Rate Modeling",
        status: "ACTIVE",
        fast_depleting_count: evaluated.filter((e) => e.daily_velocity > 5).length,
        urgent_stockouts_48h: evaluated.filter((e) => e.is_active && e.days_to_out <= 2).length,
        burn_velocity_window_days: 14
      },
      agent_strategist: {
        name: "Agent Vendor Strategist",
        role: "Supplier Rate Optimization & Spend",
        status: "ACTIVE",
        total_spend_required: Math.round(totalSpendRequired * 100) / 100,
        currency: "INR",
        supplier_options_available: evaluated.filter((e) => e.recommended_supplier).length
      },
      agent_dispatcher: {
        name: "Agent Auto-Draft Dispatcher",
        role: "Autonomous Multi-Supplier PO Generator",
        status: breachedItems.length > 0 ? "READY" : "STANDBY",
        pending_pos_to_draft: breachedItems.filter((e) => e.preferred_supplier_id).length,
        ready_for_dispatch: breachedItems.length > 0
      }
    };
  }

  /**
   * Concurrently updates reorder points in chunks using multi-threading chunk logic
   */
  async batchUpdate(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return [];

    const updated = [];
    await db.transaction(async (trx) => {
      for (let i = 0; i < rules.length; i += this.chunkSize) {
        const chunk = rules.slice(i, i + this.chunkSize);
        const chunkResults = await Promise.all(
          chunk.map(async ({ id, min_qty, reorder_qty, lead_time_days, preferred_supplier_id, is_active, notes }) => {
            const updates = {};
            if (min_qty !== undefined) updates.min_qty = parseFloat(min_qty);
            if (reorder_qty !== undefined) updates.reorder_qty = parseFloat(reorder_qty);
            if (lead_time_days !== undefined) updates.lead_time_days = parseInt(lead_time_days, 10);
            if (preferred_supplier_id !== undefined) updates.preferred_supplier_id = preferred_supplier_id ? parseInt(preferred_supplier_id, 10) : null;
            if (is_active !== undefined) updates.is_active = Boolean(is_active);
            if (notes !== undefined) updates.notes = notes;
            updates.updated_at = trx.fn.now();

            const [row] = await trx("reorder_points").where("id", id).update(updates).returning("*");
            return row;
          })
        );
        updated.push(...chunkResults.filter(Boolean));
      }
    });

    return updated;
  }

  /**
   * Automatically recalibrates min_qty and reorder_qty based on actual 14-day velocity
   */
  async recalibrateAll(itemCodes = null) {
    const evaluated = await this.evaluateAll(itemCodes);
    const toRecalibrate = evaluated
      .filter((e) => e.daily_velocity > 0)
      .map((e) => ({
        id: e.id,
        min_qty: e.suggested_min_qty,
        reorder_qty: e.suggested_reorder_qty
      }));

    return this.batchUpdate(toRecalibrate);
  }

  /**
   * Bundles breached items by supplier and drafts Purchase Orders atomically
   */
  async batchDraftPOs(itemIds, creatorUserId) {
    const evaluated = await this.evaluateAll();
    const targetItems = itemIds && itemIds.length > 0
      ? evaluated.filter((e) => itemIds.includes(e.id))
      : evaluated.filter((e) => e.is_breached && e.is_active);

    const eligible = targetItems.filter((e) => e.preferred_supplier_id && e.reorder_qty > 0);
    if (eligible.length === 0) {
      return { success: false, message: "No eligible items with assigned suppliers found to draft POs." };
    }

    // Group by supplier_id
    const grouped = {};
    eligible.forEach((item) => {
      const sid = item.preferred_supplier_id;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push(item);
    });

    const today = new Date().toISOString().slice(0, 10);
    const createdPOs = [];

    await db.transaction(async (trx) => {
      for (const [supplierId, supplierItems] of Object.entries(grouped)) {
        const poNumber = await generatePONumber(today);
        const poItems = supplierItems.map((it) => ({
          item_code: it.item_code,
          name: it.name,
          qty: it.reorder_qty,
          unit: it.unit,
          unit_price: it.unit_cost,
          total_price: Math.round(it.reorder_qty * it.unit_cost * 100) / 100
        }));

        const totalAmount = poItems.reduce((sum, it) => sum + it.total_price, 0);

        const [po] = await trx("purchase_orders")
          .insert({
            po_number: poNumber,
            supplier_id: parseInt(supplierId, 10),
            date: today,
            status: "Draft",
            total_amount: totalAmount,
            notes: `Auto-drafted by Agent Auto-Draft Dispatcher for ${supplierItems.length} breached items`
          })
          .returning("*");

        await trx("purchase_order_items").insert(poItems.map((it) => ({ ...it, po_id: po.id })));
        await createApprovalRequest(trx, "purchase_orders", po.id, totalAmount, creatorUserId || null);

        createdPOs.push({ ...po, items_count: poItems.length });
      }
    });

    return {
      success: true,
      created_count: createdPOs.length,
      orders: createdPOs
    };
  }
}

module.exports = new ReorderAgentEngine();
