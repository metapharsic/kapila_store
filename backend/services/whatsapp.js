// Shared WhatsApp sender (Meta Graph API) — extracted from cron/anomalyDetector.js
// so the shrinkage-alert cron and the indent day-close digest use one code path.
async function sendWhatsApp(to, message) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) {
    console.log(`[WhatsApp] (Mock) Would send to ${to}:\n${message}`);
    return { mocked: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });
    const data = await res.json();
    console.log("[WhatsApp API] Sent. Message ID:", data.messages?.[0]?.id || data);
    return data;
  } catch (err) {
    console.error("[WhatsApp API] Failed to send:", err.message);
    throw err;
  }
}

module.exports = { sendWhatsApp };
