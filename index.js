const cron = require("node-cron");
const axios = require("axios");
 
const CONFIG = {
  idInstance:  process.env.ID_INSTANCE,
  apiToken:    process.env.API_TOKEN,
  groupChatId: process.env.GROUP_CHAT_ID,
  timezone:    "Asia/Kuala_Lumpur",
  sendTime:    "0 12 * * 1-5",   // 12:00 PM Mon-Fri (poll)
  newsTime:    "30 11 * * 1-5",  // 11:30 AM Mon-Fri (news reminder)
};
 
const pollOptions = ["📈 Bullish", "📉 Bearish", "↔️ Neutral / Ranging"];
 
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
      message: `📊 *XAUUSD Daily Bias Poll*\n🗓 ${day}, ${date}`,
      options: pollOptions.map((o) => ({ optionName: o })),
      multipleAnswers: false,
    });
    console.log(`[${new Date().toISOString()}] ✅ Poll sent! ID: ${response.data.idMessage}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Poll error:`, err.response?.data || err.message);
  }
}
 
// ─── NEWS REMINDER ─────────────────────────────────────────────────────────
async function sendNewsReminder() {
  const { idInstance, apiToken, groupChatId } = CONFIG;
 
  try {
    const response = await axios.get("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
    const events = response.data;
 
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }); // YYYY-MM-DD
 
    const todayHighImpactUSD = events.filter((e) => {
      const eventDate = new Date(e.date).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
      return eventDate === todayStr && e.country === "USD" && e.impact === "High";
    });
 
    if (todayHighImpactUSD.length === 0) {
      console.log(`[${new Date().toISOString()}] ℹ️ No high-impact USD news today.`);
      return;
    }
 
    let message = `📰 *Today's High-Impact News (USD)*\n\n`;
    todayHighImpactUSD.forEach((e) => {
      const time = new Date(e.date).toLocaleTimeString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      message += `🕗 ${time} MYT - ${e.title}\n`;
    });
    message += `\n⚠️ Expect volatility around these times`;
 
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
    const result = await axios.post(url, {
      chatId: groupChatId,
      message: message,
    });
 
    console.log(`[${new Date().toISOString()}] ✅ News reminder sent! ID: ${result.data.idMessage}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ News reminder error:`, err.response?.data || err.message);
  }
}
 
// ─── SCHEDULER ─────────────────────────────────────────────────────────────
console.log("🤖 Bot running — news reminder at 11:30 AM, poll at 12:00 PM MYT, Mon-Fri");
 
cron.schedule(CONFIG.newsTime, () => {
  console.log("⏰ Cron triggered — checking news...");
  sendNewsReminder();
}, { timezone: CONFIG.timezone });
 
cron.schedule(CONFIG.sendTime, () => {
  console.log("⏰ Cron triggered — sending poll...");
  sendPoll();
}, { timezone: CONFIG.timezone });
 
