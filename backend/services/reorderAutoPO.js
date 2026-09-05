const db = require("../db");

// Shared by indentController (after indent creation) and issuanceController
// (after stock deduction) — one engine, one set of validation rules, so
// "auto PO on reorder breach" behaves the same no matter what triggered it.
//
// consumedItems: [{ name, qty }] — qty just consumed/reserved for these items.
// sourceLabel: human string for the PO note, e.g. "indent #12" / "issuance #45".
// creatorUserId: attributed as the approval-request creator.
async function checkAndDraftReorderPOs(consumedItems, sourceLabel, creatorUserId) {
  const items = consumedItems || [];
  if (!items.length) return;

  const itemNames = items.map((i) => i.name.toLowerCase());

  const stockRows = await db("stock")
    .whereRaw("LOWER(name) = ANY(?)", [itemNames])
    .select("name", db.raw("SUM(remaining) as total_remaining"), db.raw("MAX(price) as last_price"), "unit")
    .groupBy("name", "unit");
  const stockMap = Object.fromEntries(stockRows.map((r) => [r.name.toLowerCase(), r]));

  const reorderRows = await db("reorder_points")
    .whereRaw("LOWER(name) = ANY(?)", [itemNames])
    .where("is_active", true)
    .select("name", "item_code", "min_qty", "reorder_qty", "preferred_supplier_id");
  if (!reorderRows.length) return;

  const toReorder = reorderRows.filter((rp) => {
    const available = parseFloat(stockMap[rp.name.toLowerCase()]?.total_remaining) || 0;
    const consumedQty = items.find((i) => i.name.toLowerCase() === rp.name.toLowerCase())?.qty || 0;
    return (available - consumedQty) < rp.min_qty;
  });
  if (!toReorder.length) return;

  // --- Strict validation: drop anything that would create a garbage PO line ---
  const valid = [];
  for (const rp of toReorder) {
    if (!rp.preferred_supplier_id) continue; // no vendor to order from — skip, don't guess
    const supplierExists = await db("suppliers").where("id", rp.preferred_supplier_id).first();
    if (!supplierExists) continue; // dangling/deleted supplier reference

    const qty = parseFloat(rp.reorder_qty) || 0;
    if (qty <= 0 || qty > 100000) continue; // sane cap — catches fat-finger reorder_qty

    const price = parseFloat(stockMap[rp.name.toLowerCase()]?.last_price) || 0;
    if (price <= 0) continue; // no price on record — needs manual entry, not an auto-PO line

    valid.push({ ...rp, resolvedPrice: price, resolvedQty: qty });
  }
  if (!valid.length) return;

  const bySupplier = {};
  for (const rp of valid) {
    if (!bySupplier[rp.preferred_supplier_id]) bySupplier[rp.preferred_supplier_id] = [];
    bySupplier[rp.preferred_supplier_id].push(rp);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { createApprovalRequest } = require("../controllers/approvalController");

  for (const [sid, rpItems] of Object.entries(bySupplier)) {
    const existingDraft = await db("purchase_orders")
      .where({ supplier_id: parseInt(sid), date: today, status: "Draft" })
      .first();

    if (existingDraft) {
      const existingItemNames = (await db("purchase_order_items").where("po_id", existingDraft.id).pluck("name"))
        .map((n) => n.toLowerCase());
      const newItems = rpItems.filter((rp) => !existingItemNames.includes(rp.name.toLowerCase()));
      if (newItems.length) {
        const rows = newItems.map((rp) => ({
          po_id: existingDraft.id,
          item_code: rp.item_code,
          name: rp.name,
          qty: rp.resolvedQty,
          unit: items.find((i) => i.name.toLowerCase() === rp.name.toLowerCase())?.unit || "unit",
          unit_price: rp.resolvedPrice,
          total_price: rp.resolvedPrice * rp.resolvedQty,
        }));
        await db("purchase_order_items").insert(rows);
        const addedAmount = rows.reduce((s, r) => s + r.total_price, 0);
        await db("purchase_orders").where("id", existingDraft.id)
          .update({ total_amount: db.raw("total_amount + ?", [addedAmount]) });
      }
      continue;
    }

    const { generatePONumber } = require("../controllers/purchaseOrderController");
    const po_number = await generatePONumber(today);

    const poItems = rpItems.map((rp) => ({
      item_code: rp.item_code,
      name: rp.name,
      qty: rp.resolvedQty,
      unit: items.find((i) => i.name.toLowerCase() === rp.name.toLowerCase())?.unit || "unit",
      unit_price: rp.resolvedPrice,
      total_price: rp.resolvedPrice * rp.resolvedQty,
    }));
    const totalAmount = poItems.reduce((s, it) => s + it.total_price, 0);

    await db.transaction(async (trx) => {
      const [po] = await trx("purchase_orders")
        .insert({
          po_number,
          supplier_id: parseInt(sid),
          date: today,
          status: "Draft",
          total_amount: totalAmount,
          notes: `Auto-drafted: stock will breach reorder point after ${sourceLabel}`,
        })
        .returning("*");

      await trx("purchase_order_items").insert(poItems.map((it) => ({ ...it, po_id: po.id })));

      // Route into the real approval matrix (amount-tiered SM/Admin) instead of
      // sitting as an untracked "Draft" nobody is notified about.
      await createApprovalRequest(trx, "purchase_orders", po.id, totalAmount, creatorUserId || null);
    });
  }
}

module.exports = { checkAndDraftReorderPOs };
