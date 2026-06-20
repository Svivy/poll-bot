const cron = require("node-cron");
const axios = require("axios");
 
const CONFIG = {
  idInstance:  process.env.ID_INSTANCE,
  apiToken:    process.env.API_TOKEN,
  groupChatId: process.env.GROUP_CHAT_ID,
  timezone:    "Asia/Kuala_Lumpur",
  sendTime:    "0 12 * * 1-5",  // 12:00 PM Mon-Fri (poll)
};
 
const pollOptions = ["📈 Bullish", "📉 Bearish", "↔️ Ranging"];
 
// Keeps track of which events we've already alerted on, so we don't repeat-spam
// every 15 min while an event sits inside the 1-hour window.
const alertedEventIds = new Set();
 
function getDayLabel() {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return days[new Date().getDay()];
}
 
// ─── BIAS POLL ─────────────────────────────────────────────────────────────
async function sendPoll() {
  const { idInstance, apiToken, groupChatId } = CONFIG;
  const day = getDayLabel();
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const url = `https://api.green-api.com/waInstance${idInstance}/sendPoll/${apiToken}`;
 
  try {
    const response = await axios.post(url, {
      chatId: groupChatId,
      message: `📊 *XAUUSD Bias*\n🗓 ${day}, ${date}`,
      options: pollOptions.map((o) => ({ optionName: o })),
      multipleAnswers: false,
    });
    console.log(`[${new Date().toISOString()}] ✅ Poll sent! ID: ${response.data.idMessage}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Poll error:`, err.response?.data || err.message);
  }
}
 
// ─── ROLLING NEWS CHECK (runs every 15 min, alerts ~1hr before each event) ──
async function checkUpcomingNews() {
  const { idInstance, apiToken, groupChatId } = CONFIG;
 
  try {
    const response = await axios.get("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
    const events = response.data;
 
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 75 * 60 * 1000); // 1hr15min buffer so 15-min cron doesn't skip events
 
    const upcoming = events.filter((e) => {
      if (e.country !== "USD" || e.impact !== "High") return false;
      const eventTime = new Date(e.date);
      const eventId = `${e.title}-${e.date}`;
      if (alertedEventIds.has(eventId)) return false;
      // Event falls within the next ~1hr to 1hr15min window
      return eventTime >= now && eventTime <= windowEnd;
    });
 
    for (const e of upcoming) {
      const eventId = `${e.title}-${e.date}`;
      const eventTime = new Date(e.date);
      const timeStr = eventTime.toLocaleTimeString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = eventTime.toLocaleDateString("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        day: "2-digit",
        month: "short",
      });
 
      const message =
        `📰 *High-Impact News in ~1 Hour*\n\n` +
        `🕗 ${timeStr} MYT (${dateStr})\n` +
        `📌 ${e.title}\n\n` +
        `⚠️ Trade Safe`;
 
      const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
      const result = await axios.post(url, { chatId: groupChatId, message });
 
      alertedEventIds.add(eventId);
      console.log(`[${new Date().toISOString()}] ✅ News alert sent for "${e.title}" — ID: ${result.data.idMessage}`);
    }
 
    if (upcoming.length === 0) {
      console.log(`[${new Date().toISOString()}] ℹ️ No high-impact news.`);
    }
 
    // Cleanup: drop alerted IDs for events that are now in the past, so the Set doesn't grow forever
    for (const id of alertedEventIds) {
      const eventDateStr = id.split("-").slice(1).join("-");
      if (new Date(eventDateStr) < now) alertedEventIds.delete(id);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ News check error:`, err.response?.data || err.message);
  }
}
 
// ─── SCHEDULER ─────────────────────────────────────────────────────────────
console.log("🤖 Bot running — news checked every 15 min, poll at 12:00 PM MYT Mon-Fri");
 
// Check for upcoming high-impact news every 15 minutes, every day (news doesn't respect weekdays-only)
cron.schedule("*/15 * * * *", () => {
  checkUpcomingNews();
}, { timezone: CONFIG.timezone });
 
cron.schedule(CONFIG.sendTime, () => {
  console.log("⏰ Cron triggered — sending poll...");
  sendPoll();
}, { timezone: CONFIG.timezone });
 
