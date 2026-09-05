const db = require("../db");

async function calculateForecast() {
  // Select daily total issuance per item for the last 3 distinct days with issuances
  const distinctDates = await db("issuances")
    .distinct("date")
    .orderBy("date", "desc")
    .limit(3)
    .pluck("date");

  if (distinctDates.length === 0) {
    return [];
  }

  const issuances = await db("issuance_items")
    .join("issuances", "issuance_items.issuance_id", "issuances.id")
    .whereIn("issuances.date", distinctDates)
    .select("issuance_items.item_code", "issuance_items.name", "issuance_items.unit")
    .sum("issuance_items.issued as total_issued")
    .groupBy("issuance_items.item_code", "issuance_items.name", "issuance_items.unit");

  const numDays = distinctDates.length;
  const forecasts = issuances.map(row => ({
    item_code: row.item_code,
    name: row.name,
    unit: row.unit,
    avg_daily_demand: parseFloat(row.total_issued || 0) / numDays,
    forecasted_3day_need: (parseFloat(row.total_issued || 0) / numDays) * 3
  }));

  return forecasts;
}

module.exports = { calculateForecast };
