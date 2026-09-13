const db = require("../db");
const { applyDepartmentScope, assertDepartmentAccess } = require("../services/permissionService");
const { classifyItem, ITEM_CLASSIFICATION } = require("../services/mondayTrendAgentService");

// GET /api/indents
// Query params: dept, status, date_from, date_to, q (search items), page, limit, sort, order
async function list(req, res, next) {
  try {
    const { dept, status, date_from, date_to, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    let baseQuery = db("indents").modify((qb) => {
      if (dept)      qb.where("dept", dept);
      if (status) {
        if (status.includes(",")) {
          qb.whereIn("status", status.split(","));
        } else {
          qb.where("status", status);
        }
      }
      if (date_from) qb.where("date", ">=", date_from);
      if (date_to)   qb.where("date", "<=", date_to);
      if (q) {
        qb.whereIn("id", db("indent_items")
          .select("indent_id")
          .whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q]));
      }
    });
    await applyDepartmentScope(baseQuery, req.user, "dept");

    const [{ count }] = await baseQuery.clone().count("indents.id as count");
    const indents = await baseQuery.clone()
      .select("indents.*")
      .orderBy(`indents.${sort}`, order)
      .orderBy("indents.id", "desc")
      .offset(offset).limit(limit);

    const ids = indents.map((i) => i.id);
    const items = ids.length ? await db("indent_items").whereIn("indent_id", ids) : [];

    const data = indents.map((ind) => ({
      ...ind,
      items: items.filter((it) => it.indent_id === ind.id),
    }));

    res.json({ success: true, data, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) { next(err); }
}

// POST /api/indents
async function create(req, res, next) {
  try {
    const { dept, date, indent_type = "routine", items, remarks, shift = "MORNING", priority = "NORMAL" } = req.body;
    
    const deptExists = await db("departments").whereRaw("LOWER(name) = LOWER(?)", [dept.trim()]).first();
    if (!deptExists) {
      return res.status(400).json({ success: false, error: `Department '${dept}' does not exist.` });
    }
    await assertDepartmentAccess(req.user, deptExists.name);

    const { getConversionMultiplier, areUnitsCompatible } = require("../utils/units");
    const itemNames = items.map((it) => (it.name || "").toLowerCase()).filter(Boolean);
    const itemCodes = items.map((it) => (it.item_code || "").trim().toUpperCase()).filter(Boolean);
    const priceRows = (itemNames.length || itemCodes.length)
      ? await db("stock")
          .where((qb) => {
            if (itemCodes.length) qb.whereIn(db.raw("UPPER(item_code)"), itemCodes);
            if (itemNames.length) qb.orWhereRaw("LOWER(name) = ANY(?)", [itemNames]);
          })
          .select("item_code", "name", "price", "unit")
      : [];
    const priceMap = {};
    priceRows.forEach((r) => {
      if (r.name) priceMap[r.name.toLowerCase()] = { price: parseFloat(r.price) || 0, unit: r.unit };
      if (r.item_code) priceMap[r.item_code.trim().toUpperCase()] = { price: parseFloat(r.price) || 0, unit: r.unit };
    });

    for (const it of items) {
      const codeKey = (it.item_code || "").trim().toUpperCase();
      const nameKey = (it.name || "").toLowerCase();
      const stockInfo = (codeKey && priceMap[codeKey]) || priceMap[nameKey];
      if (stockInfo && !areUnitsCompatible(it.unit, stockInfo.unit, it.name)) {
        return res.status(400).json({
          success: false,
          error: `Item '${it.name}' (${it.item_code || "N/A"}) has unit '${it.unit}', which is incompatible with master stock unit '${stockInfo.unit}'.`
        });
      }
    }

    const result = await db.transaction(async (trx) => {
      const [indent] = await trx("indents").insert({
        dept: deptExists.name,
        date,
        status: "pending",
        indent_type,
        shift: shift || "MORNING",
        priority: priority || "NORMAL",
        remarks: remarks ? String(remarks).trim() : null,
        created_by: req.user?.id || null,
      }).returning("*");
      const rows = items.map((it) => ({
        indent_id: indent.id,
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        item_code: it.item_code || "KPL-NEW",
        notes: it.notes || null,
      }));
      const savedItems = await trx("indent_items").insert(rows).returning("*");

      // Estimate indent value from latest known price per item so amount-based
      // approval routing (small → store manager, large → admin) actually works.
      const itemValues = items.map((it) => {
        const codeKey = (it.item_code || "").trim().toUpperCase();
        const nameKey = (it.name || "").toLowerCase();
        const stockInfo = (codeKey && priceMap[codeKey]) || priceMap[nameKey];
        const qty = parseFloat(it.qty) || 0;
        if (!stockInfo) return { name: it.name, qty, value: 0 };
        const mult = getConversionMultiplier(it.unit, stockInfo.unit, it.name) ?? 1;
        const normQty = qty * mult;
        return { name: it.name, qty, value: normQty * stockInfo.price };
      });
      const estimatedAmount = itemValues.reduce((sum, it) => sum + it.value, 0);

      // Trigger approval flow
      const { createApprovalRequest } = require("./approvalController");
      await createApprovalRequest(trx, "indents", indent.id, estimatedAmount, req.user.id);

      // Auto-advance menu_plans that are still "planned" for this dept+date → "indented"
      await trx("menu_plans")
        .where({ dept: deptExists.name, date, status: "planned" })
        .update({ status: "indented" });

      return { ...indent, items: savedItems, itemValues };
    });

    res.status(201).json({ success: true, data: result });


    const { checkHighValueAlert } = require("../utils/highValueAlert");
    checkHighValueAlert({
      module: "indent",
      id: result.id,
      dept: result.dept,
      creatorUserId: req.user.id,
      lineItems: result.itemValues,
      occurredAt: new Date(result.created_at || Date.now()),
    });

    // Kafka is the sync bus between modules — kafkaConsumer.js reacts to this
    // event and runs the reorder-breach check itself, decoupled from this
    // request. If the broker is unreachable, publish() returns false and we
    // fall back to running the check in-process so a downed broker never
    // silently disables auto-PO drafting.
    const { publish } = require("../services/kafkaProducer");
    const eventItems = result.items.map((it) => ({ name: it.name, qty: it.qty }));
    publish("indent-events", {
      type: "indent.create",
      id: result.id,
      dept: result.dept,
      indent_type: result.indent_type,
      items: eventItems,
      creator_user_id: req.user.id,
    }).then((delivered) => {
      if (!delivered) {
        const { checkAndDraftReorderPOs } = require("../services/reorderAutoPO");
        checkAndDraftReorderPOs(eventItems, `indent #${result.id} (Kafka fallback)`, req.user.id).catch(() => {});
      }
    });
  } catch (err) { next(err); }
}

// PATCH /api/indents/:id  — update status
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const existing = await db("indents").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    await assertDepartmentAccess(req.user, existing.dept);
    
    // Status transition validation
    const validTransitions = {
      pending: ["approved", "issued", "cancelled"],
      approved: ["issued", "partial", "cancelled", "pending"],
      partial: ["issued", "cancelled"],
      issued: ["pending"], // e.g. via delete issuance
      cancelled: ["pending"]
    };
    if (existing.status !== status && !validTransitions[existing.status]?.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status transition from ${existing.status} to ${status}` });
    }

    const [row] = await db("indents").where("id", req.params.id).update({ status }).returning("*");
    if (!row) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

// DELETE /api/indents/:id
async function remove(req, res, next) {
  try {
    const existing = await db("indents").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    await assertDepartmentAccess(req.user, existing.dept);
    
    // Check if any items have been issued or if an issuance record exists
    const issuanceDone = await db("issuances").where("indent_id", existing.id).first();
    const anyItemsIssued = await db("indent_items").where("indent_id", existing.id).andWhere("issued_qty", ">", 0).first();

    if (issuanceDone || anyItemsIssued) {
      return res.status(400).json({ success: false, error: "Cannot delete indent — issuance has already been recorded" });
    }

    await db.transaction(async (trx) => {
      await trx("indent_items").where("indent_id", existing.id).delete();
      await trx("indents").where("id", existing.id).delete();
    });

    res.json({ success: true, message: "Indent deleted successfully" });
  } catch (err) { next(err); }
}

// PATCH /api/indents/:id/items
async function updateItems(req, res, next) {
  try {
    const { items } = req.body;
    const existing = await db("indents").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });
    await assertDepartmentAccess(req.user, existing.dept);

    if (existing.status !== "pending") {
      return res.status(400).json({ success: false, error: "Cannot edit items of a non-pending indent" });
    }
    const alreadyIssued = await db("indent_items").where("indent_id", existing.id).andWhere("issued_qty", ">", 0).first();
    if (alreadyIssued) {
      return res.status(400).json({ success: false, error: "Cannot replace items — some have already been issued." });
    }

    const { areUnitsCompatible } = require("../utils/units");
    const itemNames = items.map((it) => (it.name || "").toLowerCase()).filter(Boolean);
    const itemCodes = items.map((it) => (it.item_code || "").trim().toUpperCase()).filter(Boolean);
    const priceRows = (itemNames.length || itemCodes.length)
      ? await db("stock")
          .where((qb) => {
            if (itemCodes.length) qb.whereIn(db.raw("UPPER(item_code)"), itemCodes);
            if (itemNames.length) qb.orWhereRaw("LOWER(name) = ANY(?)", [itemNames]);
          })
          .select("item_code", "name", "price", "unit")
      : [];
    const priceMap = {};
    priceRows.forEach((r) => {
      if (r.name) priceMap[r.name.toLowerCase()] = { price: parseFloat(r.price) || 0, unit: r.unit };
      if (r.item_code) priceMap[r.item_code.trim().toUpperCase()] = { price: parseFloat(r.price) || 0, unit: r.unit };
    });

    for (const it of items) {
      const codeKey = (it.item_code || "").trim().toUpperCase();
      const nameKey = (it.name || "").toLowerCase();
      const stockInfo = (codeKey && priceMap[codeKey]) || priceMap[nameKey];
      if (stockInfo && !areUnitsCompatible(it.unit, stockInfo.unit, it.name)) {
        return res.status(400).json({
          success: false,
          error: `Item '${it.name}' (${it.item_code || "N/A"}) has unit '${it.unit}', which is incompatible with master stock unit '${stockInfo.unit}'.`
        });
      }
    }

    const updatedItems = await db.transaction(async (trx) => {
      await trx("indent_items").where("indent_id", existing.id).delete();
      const rows = items.map((it) => ({ indent_id: existing.id, name: it.name, qty: it.qty, unit: it.unit, item_code: it.item_code }));
      return await trx("indent_items").insert(rows).returning("*");
    });

    res.json({ success: true, data: { ...existing, items: updatedItems } });

  } catch (err) { next(err); }
}

// GET /api/indents/recommendations
async function getRecommendations(req, res, next) {
  try {
    const { dept, date, dow } = req.query;
    const weeks = Math.min(12, Math.max(2, parseInt(req.query.weeks) || 4));

    if (!dept) {
      return res.status(400).json({ success: false, error: "Department is required." });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];
    const intervalDays = weeks * 7;
    const halfIntervalDays = Math.floor(weeks / 2) * 7;

    const baseQuery = db("indent_items as ii")
      .join("indents as i", "ii.indent_id", "i.id")
      .whereRaw("LOWER(i.dept) = LOWER(?)", [dept.trim()])
      .where("i.status", "!=", "cancelled");

    if (dow !== undefined && dow !== null && dow !== "") {
      baseQuery.whereRaw("EXTRACT(DOW FROM i.date) = ?", [parseInt(dow, 10)]);
    } else {
      baseQuery.whereRaw("EXTRACT(DOW FROM i.date) = EXTRACT(DOW FROM DATE(?))", [targetDate]);
    }

    baseQuery
      .whereRaw("i.date >= (DATE(?) - INTERVAL '1 day' * ?)::date", [targetDate, intervalDays])
      .whereRaw("i.date < DATE(?)", [targetDate]);

    const rows = await baseQuery
      .groupBy("ii.name", "ii.unit", "ii.item_code")
      .select("ii.name", "ii.unit", "ii.item_code")
      .avg("ii.qty as avg_qty")
      .countDistinct("i.id as occurrence_count")
      .max("i.date as last_ordered_date")
      .select(
        db.raw("AVG(CASE WHEN i.date >= (DATE(?) - INTERVAL '1 day' * ?) THEN ii.qty END) AS recent_avg", [targetDate, halfIntervalDays]),
        db.raw("AVG(CASE WHEN i.date < (DATE(?) - INTERVAL '1 day' * ?) THEN ii.qty END) AS older_avg", [targetDate, halfIntervalDays])
      );

    // Cross-check available stock levels
    const itemNames = rows.map((r) => r.name.toLowerCase());
    const stockLevels = itemNames.length
      ? await db("stock").whereRaw("LOWER(name) = ANY(?)", [itemNames]).select("name", "remaining", "unit")
      : [];
    const stockMap = Object.fromEntries(stockLevels.map((s) => [s.name.toLowerCase(), s]));

    const data = rows.map((r) => {
      const recentAvg  = parseFloat(r.recent_avg || 0);
      const olderAvg   = parseFloat(r.older_avg  || 0);
      const occurrences = parseInt(r.occurrence_count || 0);
      const avgQty     = parseFloat(parseFloat(r.avg_qty || 0).toFixed(2));
      const freqPct    = parseFloat((occurrences / Math.floor(weeks / 1)).toFixed(2));

      let trendDirection = "stable";
      if (olderAvg > 0) {
        if (recentAvg > olderAvg * 1.05)      trendDirection = "up";
        else if (recentAvg < olderAvg * 0.95) trendDirection = "down";
      } else if (recentAvg > 0) {
        trendDirection = "up";
      }

      const classification = classifyItem(r.name);
      const isBitPiece =
        classification === ITEM_CLASSIFICATION.SPICES_AROMATICS ||
        classification === ITEM_CLASSIFICATION.DISPOSABLES_PACKAGING;

      const stockEntry   = stockMap[r.name.toLowerCase()];
      const availableStock = stockEntry ? parseFloat(stockEntry.remaining || 0) : null;

      return {
        name:             r.name,
        unit:             r.unit,
        item_code:        r.item_code,
        avg_qty:          avgQty,
        occurrence_count: occurrences,
        frequency_pct:    Math.min(1, Math.max(0.2, freqPct)),
        trend_direction:  trendDirection,
        recent_avg:       parseFloat(recentAvg.toFixed(2)),
        older_avg:        parseFloat(olderAvg.toFixed(2)),
        last_ordered_date: r.last_ordered_date || null,
        available_stock:  availableStock,
        classification,
        is_bit_piece:     isBitPiece,
        confidence:       occurrences >= 3 ? "HIGH" : occurrences >= 2 ? "MEDIUM" : "LOW",
      };
    });

    const bitPiecesCount = data.filter((i) => i.is_bit_piece).length;
    const staplesCount = data.filter((i) => !i.is_bit_piece).length;

    res.json({
      success: true,
      data,
      weeks,
      dept,
      summary: {
        total: data.length,
        bit_pieces_count: bitPiecesCount,
        staples_count: staplesCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function smartAutofill(req, res, next) {
  try {
    const { dept, plannedRecipes } = req.body;
    if (!dept) {
      return res.status(400).json({ success: false, error: "Department is required." });
    }

    const { generateSmartIndent } = require("../services/localAI");

    const recipesData = plannedRecipes || [];
    const recipeIds = recipesData.map(r => r.id);
    
    const recipeItems = recipeIds.length 
      ? await db("recipe_items").whereIn("recipe_id", recipeIds).select("*")
      : [];
    const recipes = recipeIds.length
      ? await db("recipes").whereIn("id", recipeIds).select("id", "base_plates")
      : [];
    
    const recipeBasePlates = {};
    recipes.forEach(r => { recipeBasePlates[r.id] = r.base_plates || 100; });

    const scaledMap = {};
    recipesData.forEach(({ id, plates }) => {
      const basePlates = recipeBasePlates[id] || 100;
      const factor = plates / basePlates;

      recipeItems.filter(item => item.recipe_id === id).forEach(item => {
        const key = item.item_name.trim().toLowerCase();
        if (!scaledMap[key]) {
          scaledMap[key] = { name: item.item_name.trim(), qty: 0, unit: item.unit };
        }
        scaledMap[key].qty += item.base_qty * factor;
      });
    });
    const scaledIngredients = Object.values(scaledMap);

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const leftovers = await db("leftovers")
      .whereRaw("LOWER(dept) = LOWER(?)", [dept.trim()])
      .whereIn("date", [todayStr, yesterday])
      .where("carried_forward", true)
      .select("item", "qty", "unit");

    const ingredientNames = scaledIngredients.map(s => s.name.toLowerCase());
    const stock = ingredientNames.length
      ? await db("stock")
          .whereIn(db.raw("LOWER(name)"), ingredientNames)
          .select("name", "remaining", "unit", "item_code")
      : [];

    const trends = ingredientNames.length
      ? await db("indent_items")
          .join("indents", "indents.id", "indent_items.indent_id")
          .whereRaw("LOWER(indents.dept) = LOWER(?)", [dept.trim()])
          .whereIn(db.raw("LOWER(indent_items.name)"), ingredientNames)
          .where("indents.date", ">=", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
          .select("indent_items.name")
          .avg("indent_items.qty as avg_qty")
          .groupBy("indent_items.name")
      : [];

    const trendsMap = Object.fromEntries(trends.map(t => [t.name.toLowerCase(), parseFloat(t.avg_qty || 0)]));
    const trendsData = scaledIngredients.map(s => ({
      name: s.name,
      avg_monthly_qty: trendsMap[s.name.toLowerCase()] || 0.0
    }));

    const recommendations = await generateSmartIndent(dept, scaledIngredients, leftovers, stock, trendsData);

    const nameToCodeMap = {};
    stock.forEach(s => { nameToCodeMap[s.name.toLowerCase()] = s.item_code; });
    const enriched = recommendations.map(rec => ({
      ...rec,
      item_code: nameToCodeMap[rec.name.toLowerCase()] || "KPL-NEW"
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

async function voiceParse(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "Text is required." });
    }

    const { parseVoiceIndent } = require("../services/localAI");
    const parsedItems = await parseVoiceIndent(text);

    const itemNames = parsedItems.map(s => s.name.toLowerCase());
    const stock = itemNames.length
      ? await db("stock")
          .whereIn(db.raw("LOWER(name)"), itemNames)
          .select("name", "item_code")
      : [];

    const nameToCodeMap = {};
    stock.forEach(s => { nameToCodeMap[s.name.toLowerCase()] = s.item_code; });

    const enriched = parsedItems.map(rec => ({
      ...rec,
      item_code: nameToCodeMap[rec.name.toLowerCase()] || "KPL-NEW"
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

// POST /api/indents/day-close — store manager end-of-day trigger.
// Bundles every fully-issued indent for dept+date into one WhatsApp digest:
// indent #, dept, total value, time of issuance, and a high-value flag per
// indent (reuses the same absolute thresholds as the real-time alert so
// "high value" means one thing everywhere).
async function closeDay(req, res, next) {
  try {
    const { dept, date = new Date().toISOString().slice(0, 10) } = req.body;
    if (!dept) return res.status(400).json({ success: false, error: "dept is required" });

    const deptExists = await db("departments").whereRaw("LOWER(name) = LOWER(?)", [dept.trim()]).first();
    if (!deptExists) {
      return res.status(400).json({ success: false, error: `Department '${dept}' does not exist.` });
    }
    await assertDepartmentAccess(req.user, deptExists.name);

    const indents = await db("indents").where({ dept: deptExists.name, date, status: "issued" });

    if (indents.length === 0) {
      return res.json({ success: true, message: "No fully-issued indents for this department/date.", data: [] });
    }

    const { AMOUNT_THRESHOLD, QTY_THRESHOLD } = require("../utils/highValueAlert");
    const { sendWhatsApp } = require("../services/whatsapp");

    const summaries = [];
    for (const indent of indents) {
      const issuances = await db("issuances").where({ indent_id: indent.id }).orderBy("created_at", "desc");
      const issuanceIds = issuances.map((i) => i.id);
      const items = issuanceIds.length ? await db("issuance_items").whereIn("issuance_id", issuanceIds) : [];

      const totalValue = items.reduce((sum, it) => sum + (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0), 0);
      const totalQty = items.reduce((sum, it) => sum + (parseFloat(it.issued) || 0), 0);
      const topItem = items.reduce((max, it) => {
        const val = (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0);
        return val > (max?.value || 0) ? { name: it.name, value: val } : max;
      }, null);
      const isHighValue = totalValue > AMOUNT_THRESHOLD || totalQty > QTY_THRESHOLD;
      const issuedAt = issuances[0]?.created_at || null;

      summaries.push({
        indent_id: indent.id,
        dept: indent.dept,
        total_value: totalValue,
        issued_at: issuedAt,
        is_high_value: isHighValue,
        high_value_item: isHighValue && topItem ? topItem.name : null,
      });
    }

    const totalDeptValue = summaries.reduce((sum, s) => sum + s.total_value, 0);
    const lines = summaries.map((s) => {
      const time = s.issued_at ? new Date(s.issued_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "N/A";
      const flag = s.is_high_value ? ` ⚠️ HIGH VALUE${s.high_value_item ? ` (${s.high_value_item})` : ""}` : "";
      return `Indent #${s.indent_id} — Rs.${s.total_value.toFixed(2)} — Issued ${time}${flag}`;
    });

    const message =
      `*Kapila — Daily Indent Digest*\n` +
      `Department: *${deptExists.name}*\n` +
      `Date: ${date}\n` +
      `Indents completed: ${summaries.length}\n` +
      `Total value: Rs.${totalDeptValue.toFixed(2)}\n\n` +
      lines.join("\n");

    await sendWhatsApp(process.env.ADMIN_WHATSAPP_NUMBER || "1234567890", message);

    res.json({ success: true, data: summaries, message: "Digest sent." });
  } catch (err) { next(err); }
}

const CANONICAL_TEMPLATES = [
  { dept: "TIFFINS", aliases: ["TIFFINS ", "TIFFINS"], displayName: "Tiffins & Breakfast", icon: "☕" },
  { dept: "STAFF", aliases: ["STAFF ", "STAFF"], displayName: "Staff Meals", icon: "👥" },
  { dept: "SI-MEALS", aliases: ["SI- MEALS ", "SI-MEALS", "SI MEALS"], displayName: "South Indian Meals", icon: "🍛" },
  { dept: "NORTH INDIAN", aliases: ["NORTH INDIAN"], displayName: "North Indian Kitchen", icon: "🍲" },
  { dept: "CHAT & SOFTY", aliases: ["CHAT, JP Disposal, Softy.", "CHAT & SOFTY", "CHAT"], displayName: "Chat & Softy / Disposables", icon: "🍦" },
  { dept: "CHINESE & DOSA", aliases: ["CHINESE & DOSA"], displayName: "Chinese & Dosa Counter", icon: "🍜" },
  { dept: "MOCKTAILS & CONTINENTAL", aliases: ["MOCKTAILS & Continental", "MOCKTAILS & CONTINENTAL"], displayName: "Mocktails & Continental", icon: "🍹" },
  { dept: "RESTAURANT", aliases: [" Restaurant", "RESTAURANT"], displayName: "Restaurant Service", icon: "🍽️" },
  { dept: "ROOM SERVICE", aliases: ["Room service", "ROOM SERVICE"], displayName: "Room Service", icon: "🛎️" },
];

async function getTemplates(req, res, next) {
  try {
    const { dept } = req.query;

    const templateRows = await db("indent_templates")
      .select("template_name")
      .count("* as item_count")
      .groupBy("template_name");

    const countMap = {};
    templateRows.forEach((r) => {
      countMap[r.template_name] = parseInt(r.item_count, 10) || 0;
    });

    const results = CANONICAL_TEMPLATES.map((tmpl) => {
      const activeTemplateName = tmpl.aliases.find((a) => countMap[a] !== undefined) || tmpl.aliases[0];
      const itemCount = tmpl.aliases.reduce((sum, a) => sum + (countMap[a] || 0), 0);
      return {
        dept: tmpl.dept,
        template_name: activeTemplateName,
        displayName: tmpl.displayName,
        icon: tmpl.icon,
        item_count: itemCount,
      };
    });

    if (dept) {
      const filtered = results.filter((r) => r.dept.toLowerCase() === dept.trim().toLowerCase());
      return res.json({ success: true, data: filtered });
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
}

async function getTemplateByName(req, res, next) {
  try {
    const rawName = (req.params.name || "").trim();
    const tmplDef = CANONICAL_TEMPLATES.find(
      (t) =>
        t.dept.toLowerCase() === rawName.toLowerCase() ||
        t.aliases.some((a) => a.trim().toLowerCase() === rawName.toLowerCase())
    );

    const aliasesToSearch = tmplDef ? tmplDef.aliases : [rawName, `${rawName} `];

    const templateItems = await db("indent_templates")
      .whereIn("template_name", aliasesToSearch)
      .orderBy("row_no", "asc");

    if (!templateItems.length) {
      return res.status(404).json({ success: false, error: `No indent template found for '${rawName}'.` });
    }

    // Pull stock aggregation for live remaining inventory
    const stockAgg = await db("stock")
      .select(
        db.raw("LOWER(TRIM(name)) as lower_name"),
        "item_code",
        db.raw("SUM(remaining) as total_remaining"),
        db.raw("MAX(unit) as unit"),
        db.raw("MAX(price) as price"),
        db.raw("MAX(min_alert_qty) as reorder_level")
      )
      .groupByRaw("LOWER(TRIM(name)), item_code");

    const stockMapByName = {};
    const stockMapByCode = {};

    stockAgg.forEach((s) => {
      const remaining = parseFloat(s.total_remaining) || 0;
      const price = parseFloat(s.price) || 0;
      const reorder_level = parseFloat(s.reorder_level) || 0;
      const info = { remaining, unit: s.unit, price, reorder_level, item_code: s.item_code };
      if (s.lower_name) stockMapByName[s.lower_name] = info;
      if (s.item_code) stockMapByCode[s.item_code.toLowerCase().trim()] = info;
    });

    const enrichedItems = templateItems.map((item) => {
      const codeKey = (item.item_code || "").toLowerCase().trim();
      const nameKey = (item.item_name || "").toLowerCase().trim();
      const stockInfo = stockMapByCode[codeKey] || stockMapByName[nameKey] || null;

      const current_stock = stockInfo ? stockInfo.remaining : 0;
      const stock_unit = stockInfo?.unit || item.default_unit;
      const price = stockInfo?.price || 0;
      const reorder_level = stockInfo?.reorder_level || 0;
      const is_low_stock = stockInfo ? current_stock <= reorder_level : false;

      return {
        id: item.id,
        row_no: item.row_no,
        item_name: item.item_name,
        item_code: item.item_code || stockInfo?.item_code || null,
        default_unit: item.default_unit,
        current_stock,
        stock_unit,
        price,
        reorder_level,
        is_low_stock,
        has_stock_match: !!stockInfo,
      };
    });

    res.json({
      success: true,
      data: {
        dept: tmplDef ? tmplDef.dept : rawName,
        displayName: tmplDef ? tmplDef.displayName : rawName,
        icon: tmplDef ? tmplDef.icon : "📋",
        template_name: templateItems[0].template_name,
        item_count: enrichedItems.length,
        items: enrichedItems,
      },
    });
  } catch (err) { next(err); }
}

async function exportAutomatedIndentExcel(req, res, next) {
  try {
    const indentAutomationService = require("../services/indentAutomationService");
    const workbook = await indentAutomationService.generateWorkbook(
      {},
      { userName: req.user?.name || "Store Administrator" }
    );

    const filename = "Automated_Indent_Pattern_and_Forecasting_Engine.xlsx";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function getAutomatedIndentPreview(req, res, next) {
  try {
    const indentAutomationService = require("../services/indentAutomationService");
    const summary = await indentAutomationService.getAutomationSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getTelemetry(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const telemetry = await IndentAgentService.getAuditTelemetry();
    res.json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
}

async function getSubcategories(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const subcategories = await IndentAgentService.getSubcategories(req.query.dept);
    res.json({ success: true, data: subcategories });
  } catch (err) {
    next(err);
  }
}

async function getSubcategoryDetails(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const result = await IndentAgentService.getSubcategoryItems(req.params.idOrCode);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function createSubcategory(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const subcat = await IndentAgentService.createSubcategory(req.body);
    res.json({ success: true, data: subcat });
  } catch (err) {
    next(err);
  }
}

async function createSubcategoryItem(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const item = await IndentAgentService.createSubcategoryItem({
      ...req.body,
      subcategory_id: req.params.id,
    });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function chefSubmit(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const result = await IndentAgentService.submitChefIndent(req.body, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function processFulfillment(req, res, next) {
  try {
    const IndentAgentService = require("../services/indentAgentService");
    const result = await IndentAgentService.processStoreFulfillment(
      {
        ...req.body,
        indentId: req.params.id,
      },
      req.user
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/indents/disposables
async function getDisposables(req, res, next) {
  try {
    const search = req.query.search ? String(req.query.search).trim() : "";
    let qb = db("stock")
      .where((builder) => {
        builder
          .whereILike("category", "%dispos%")
          .orWhereILike("category", "%pack%")
          .orWhereILike("name", "%container%")
          .orWhereILike("name", "%box%")
          .orWhereILike("name", "%foil%")
          .orWhereILike("name", "%cling%")
          .orWhereILike("name", "%cup%")
          .orWhereILike("name", "%bag%")
          .orWhereILike("name", "%napkin%")
          .orWhereILike("name", "%paper%");
      })
      .select(
        "name",
        "unit",
        "category",
        db.raw("MAX(item_code) as item_code"),
        db.raw("MAX(price) as price"),
        db.raw("SUM(remaining) as current_stock")
      )
      .groupBy("name", "unit", "category")
      .orderBy("name", "asc");

    if (search) {
      qb = qb.andWhereILike("name", `%${search}%`);
    }

    const items = await qb.limit(100);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

// GET /api/indents/:id/export-excel
async function exportSingleIndentExcel(req, res, next) {
  try {
    const { generateIndentRequisitionWorkbook } = require("../services/indentSlipExportService");
    const workbook = await generateIndentRequisitionWorkbook(req.params.id, {
      userName: req.user?.name || "Store Administrator",
    });

    const indent = await db("indents").where("id", req.params.id).first();
    const deptTag = indent ? (indent.dept || "DEPT").replace(/[^a-zA-Z0-9]/g, "_") : "GENERAL";
    const filename = `Kapila_Indent_Requisition_${deptTag}_#${req.params.id}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  list, 
  create, 
  updateStatus, 
  remove, 
  updateItems, 
  getRecommendations, 
  smartAutofill, 
  voiceParse, 
  closeDay,
  getTemplates,
  getTemplateByName,
  exportAutomatedIndentExcel,
  getAutomatedIndentPreview,
  getTelemetry,
  getSubcategories,
  getSubcategoryDetails,
  createSubcategory,
  createSubcategoryItem,
  chefSubmit,
  processFulfillment,
  getDisposables,
  exportSingleIndentExcel,
};


