const db = require("../db");
const { sendWhatsApp } = require("../services/whatsapp");
const { publish } = require("../services/kafkaProducer");

// Helper to determine dynamic sensitivity threshold
function getThreshold(department, item) {
  const highValueDepartments = ["MEATS", "TIFFINS"];
  const highValueItems = ["Premium Basmati Rice", "Mutton", "Chicken", "Cashew", "Paneer"];
  const volatileItems = ["Salt", "Sugar", "Chilli Powder", "Turmeric"];

  // High variance (volatile) items need a larger spike (60%) to trigger an alert
  if (volatileItems.includes(item)) return 1.60;
  
  // Expensive/critical items or departments need only a small spike (20%) to trigger
  if (highValueItems.includes(item) || highValueDepartments.includes(department)) return 1.20;

  // Default for all other items is 40%
  return 1.40;
}

// Run anomaly detection for the past day compared to a 7-day rolling baseline
async function detectAnomalies() {
  console.log("[AnomalyDetector] Starting nightly anomaly scan...");
  
  try {
    // We look at yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const baselineStart = new Date(yesterday);
    baselineStart.setDate(yesterday.getDate() - 7);
    const baselineStr = baselineStart.toISOString().split("T")[0];

    // 1. Get baseline (consumption per plate for the past 7 days)
    const baselineQuery = `
      SELECT 
        i.dept as department,
        ii.name as item,
        SUM(ii.issued) as total_issued,
        (SELECT SUM(plates) FROM production p WHERE p.dept = i.dept AND p.date >= ? AND p.date < ?) as total_plates
      FROM issuances i
      JOIN issuance_items ii ON i.id = ii.issuance_id
      WHERE i.date >= ? AND i.date < ?
      GROUP BY i.dept, ii.name
    `;

    const baselineRes = await db.raw(baselineQuery, [baselineStr, dateStr, baselineStr, dateStr]);

    // 2. Get yesterday's consumption per plate
    const yesterdayQuery = `
      SELECT 
        i.dept as department,
        ii.name as item,
        SUM(ii.issued) as total_issued,
        (SELECT SUM(plates) FROM production p WHERE p.dept = i.dept AND p.date = ?) as total_plates
      FROM issuances i
      JOIN issuance_items ii ON i.id = ii.issuance_id
      WHERE i.date = ?
      GROUP BY i.dept, ii.name
    `;

    const yesterdayRes = await db.raw(yesterdayQuery, [dateStr, dateStr]);

    let anomaliesFound = 0;

    for (let row of yesterdayRes.rows) {
      if (!row.total_plates || row.total_plates <= 0) continue; // no plates, division by zero
      if (row.total_issued <= 0) continue;

      const currentRatio = row.total_issued / row.total_plates;

      // Find matching baseline
      const baseRow = baselineRes.rows.find(b => b.department === row.department && b.item === row.item);
      if (!baseRow || !baseRow.total_plates || baseRow.total_plates <= 0) continue; // Need baseline to compare

      const baselineRatio = baseRow.total_issued / baseRow.total_plates;
      if (baselineRatio <= 0) continue;

      // Threshold check based on item sensitivity
      const dynamicThreshold = getThreshold(row.department, row.item);
      if (currentRatio > baselineRatio * dynamicThreshold) {
        anomaliesFound++;
        
        const description = `Spike detected: ${row.item} consumption jumped by ${(((currentRatio/baselineRatio)-1)*100).toFixed(1)}%.
Current: ${currentRatio.toFixed(3)} per plate (Total Issued: ${row.total_issued}, Plates: ${row.total_plates}). 
Baseline: ${baselineRatio.toFixed(3)} per plate (Total Issued: ${baseRow.total_issued}, Plates: ${baseRow.total_plates}).`;

        console.log(`[AnomalyDetector] ${row.department} - ${row.item}: ${description}`);

        // Check if already inserted
        const existing = await db("anomaly_alerts").where({
          date: dateStr,
          item: row.item,
          department: row.department
        }).first();

        if (!existing) {
          await db("anomaly_alerts").insert({
            item: row.item,
            department: row.department,
            date: dateStr,
            baseline_ratio: baselineRatio,
            current_ratio: currentRatio,
            severity: "Critical",
            description: description,
            status: "UNREAD"
          });

          const message = `🚨🚨 *KAPILA HIGH ALERT — SHRINKAGE* 🚨🚨\n\nDepartment: *${row.department}*\nItem: *${row.item}*\n\nConsumption spiked by *${(((currentRatio/baselineRatio)-1)*100).toFixed(1)}%* vs 7-day trend\nBaseline: ${baselineRatio.toFixed(3)} per plate\nYesterday: ${currentRatio.toFixed(3)} per plate\n\nReview in Dashboard immediately.`;

          const recipients = [process.env.ADMIN_WHATSAPP_NUMBER, process.env.STORE_MANAGER_WHATSAPP_NUMBER].filter(Boolean);
          for (const number of recipients) {
            await sendWhatsApp(number, message).catch(() => {});
          }

          await publish("issuance-events", {
            type: "issuance.anomaly.nightly",
            department: row.department,
            item: row.item,
            date: dateStr,
            baseline_ratio: baselineRatio,
            current_ratio: currentRatio,
            severity: "Critical",
            recipients_notified: recipients.length,
          }).catch(() => {});
        }
      }
    }

    console.log(`[AnomalyDetector] Scan complete. ${anomaliesFound} anomalies found for ${dateStr}.`);
  } catch (err) {
    console.error("[AnomalyDetector] Error during scan:", err);
  }
}

module.exports = detectAnomalies;
module.exports.getThreshold = getThreshold;
