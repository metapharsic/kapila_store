const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { sendNotification } = require("../controllers/notificationController");
const { resolveRoleIds, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// AI-standard enhancement #16: recompute every recipe's real cost from
// today's stock price, compare against the last snapshot, and alert when it
// drifts beyond DRIFT_THRESHOLD — catches a supplier price hike silently
// eating margin instead of it being noticed by accident weeks later.
const DRIFT_THRESHOLD = 0.15; // 15%

async function computeRecipeCost(recipeId) {
  const items = await db("recipe_items").where("recipe_id", recipeId).select("item_name", "base_qty");
  let total = 0;
  for (const item of items) {
    const stock = await db("stock")
      .whereRaw("LOWER(name) = LOWER(?)", [item.item_name])
      .orderBy("created_at", "desc")
      .first("price");
    const price = stock ? parseFloat(stock.price) || 0 : 0;
    total += price * (parseFloat(item.base_qty) || 0);
  }
  return total;
}

async function detectRecipeCostDrift() {
  console.log("[RecipeCostDrift] Scanning recipes for cost drift...");
  try {
    const recipes = await db("recipes").select("id", "name");
    let alerted = 0;

    // Resolve recipient role IDs ONCE before the recipes loop
    const recipientIds = await resolveRoleIds(
      [RECIPIENT_ROLE_KEYS.admin, RECIPIENT_ROLE_KEYS.manager],
      "RecipeCostDrift"
    );

    for (const recipe of recipes) {
      const newCost = await computeRecipeCost(recipe.id);

      const lastSnapshot = await db("recipe_cost_snapshots")
        .where("recipe_id", recipe.id)
        .orderBy("computed_at", "desc")
        .first();

      if (lastSnapshot) {
        const oldCost = parseFloat(lastSnapshot.total_cost);
        const driftPct = oldCost > 0 ? Math.abs(newCost - oldCost) / oldCost : 0;

        if (driftPct >= DRIFT_THRESHOLD) {
          alerted++;
          const direction = newCost > oldCost ? "up" : "down";
          await publish("recipe-events", {
            type: "recipe.cost_drift",
            recipe_id: recipe.id,
            name: recipe.name,
            old_cost: oldCost,
            new_cost: newCost,
            drift_pct: driftPct,
          });
          for (const roleId of recipientIds) {
            await sendNotification({
              recipient_role_id: roleId,
              title: `Recipe cost drift — ${recipe.name}`,
              message: `Cost moved ${direction} ${(driftPct * 100).toFixed(1)}% (was ₹${oldCost.toFixed(2)}, now ₹${newCost.toFixed(2)})`,
              type: "recipe_cost_drift",
              severity: "warning",
              metadata: { recipe_id: recipe.id, old_cost: oldCost, new_cost: newCost, drift_pct: driftPct },
            });
          }
        }
      }

      await db("recipe_cost_snapshots").insert({ recipe_id: recipe.id, total_cost: newCost });
    }

    console.log(`[RecipeCostDrift] Scan complete. ${recipes.length} recipes checked, ${alerted} drift alert(s) sent.`);
  } catch (err) {
    console.error("[RecipeCostDrift] Error during scan:", err);
  }
}

module.exports = detectRecipeCostDrift;
