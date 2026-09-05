const db = require("../db");
const { calculateForecast } = require("../services/forecastingService");
const { runAutoPoDrafting } = require("../services/autoPoEngine");

async function getForecast(req, res, next) {
  try {
    const data = await calculateForecast();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function triggerAutoPoDraft(req, res, next) {
  try {
    const drafts = await runAutoPoDrafting();
    res.json({ success: true, message: `Successfully created ${drafts.length} auto-PO draft(s).`, data: drafts });
  } catch (err) { next(err); }
}

async function getMarginVariance(req, res, next) {
  try {
    const recipes = await db("recipes");
    const report = [];

    for (const r of recipes) {
      const items = await db("recipe_items").where("recipe_id", r.id);
      let theoreticalCost = 0.0;

      for (const it of items) {
        const latestStock = await db("stock")
          .where("item_code", it.item_code)
          .orderBy("date", "desc")
          .first();
        const price = latestStock ? parseFloat(latestStock.price) : 0.0;
        theoreticalCost += parseFloat(it.qty) * price;
      }

      // Check if menu plan exists and get price
      const menu = await db("menu_plans")
        .whereRaw("LOWER(name) = LOWER(?)", [r.name.trim()])
        .first();

      const menuPrice = menu ? parseFloat(menu.price || 0) : 0.0;
      const margin = menuPrice > 0 ? ((menuPrice - theoreticalCost) / menuPrice) * 100 : 0.0;

      report.push({
        recipe_id: r.id,
        name: r.name,
        theoretical_cost: theoreticalCost,
        menu_price: menuPrice,
        margin_percentage: margin,
        variance: menuPrice - theoreticalCost
      });
    }

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
}

module.exports = { getForecast, triggerAutoPoDraft, getMarginVariance };
