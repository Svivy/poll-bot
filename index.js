const cron = require("node-cron");
const axios = require("axios");

const CONFIG = {
  idInstance:  process.env.ID_INSTANCE,
  apiToken:    process.env.API_TOKEN,
  groupChatId: process.env.GROUP_CHAT_ID,
  timezone:    "Asia/Kuala_Lumpur",
  sendTime:    "0 12 * * 1-5",
};

const pollOptions = ["📈 Bullish", "📉 Bearish", "↔️ Ranging"];

function getDayLabel() {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return days[new Date().getDay()];
}

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
    console.log(`✅ Poll sent! ID: ${response.data.idMessage}`);
  } catch (err) {
    console.error(`❌ Error:`, err.response?.data || err.message);
  }
}

console.log("🤖 Bot running — poll sends at 12:00 PM MYT, Mon–Fri");
cron.schedule(CONFIG.sendTime, sendPoll, { timezone: CONFIG.timezone });
