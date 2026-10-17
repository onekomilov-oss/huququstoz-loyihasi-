import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID || "6345301727", 10);
const CHANNEL_ID = process.env.CHANNEL_ID || "-1002606641183";
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || "onekomilov-oss/huququstoz-loyihasi-";

if (!TOKEN) {
  console.error("Xato: BOT_TOKEN topilmadi!");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${TOKEN}`;
const STATE_DIR = path.join(process.cwd(), 'state');

if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

// AES-256-GCM kalitini yaratish
const ENC_KEY = crypto.createHash('sha256').update(TOKEN).digest();

let botUsername = "huquqmindBot"; // Standart username fallback

function encryptUserToken(userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  let encrypted = cipher.update(userId.toString(), 'utf8', 'base64url');
  encrypted += cipher.final('base64url');
  const tag = cipher.getAuthTag().toString('base64url');
  return `${iv.toString('base64url')}.${encrypted}.${tag}`;
}

function decryptUserToken(tokenStr) {
  try {
    const [ivB64, encData, tagB64] = tokenStr.split('.');
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encData, 'base64url', 'utf8');
    decrypted += decipher.final('utf8');
    return parseInt(decrypted, 10);
  } catch (e) {
    return null;
  }
}

function readJSONState(file, defaultData) {
  const p = path.join(STATE_DIR, file);
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return defaultData; }
  }
  return defaultData;
}

function writeJSONState(file, data) {
  const p = path.join(STATE_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

async function api(method, params = {}) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return await res.json();
}

function sanitizeText(str) {
  if (!str) return '';
  return str.replace(/[\r\n\t]/g, ' ').replace(/[<>]/g, '').trim().substring(0, 24);
}

// Kanal obunasini tekshirish
async function isSubscribed(userId) {
  try {
    const res = await api('getChatMember', { chat_id: CHANNEL_ID, user_id: userId });
    if (res.ok && ['creator', 'administrator', 'member'].includes(res.result.status)) {
      return true;
    }
  } catch (e) {}
  return false;
}

async function sendSubGate(chatId) {
  await api('sendMessage', {
    chat_id: chatId,
    text: "Avval kanalga a'zo bo'ling:",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Kanalga a'zo bo'lish", url: "https://t.me/huququstoz" }],
        [{ text: "✅ Tekshirish", callback_data: "check_sub" }]
      ]
    }
  });
}

function getMainMenu() {
  const webAppUrl = `https://${GITHUB_REPO.split('/')[0]}.github.io/${GITHUB_REPO.split('/')[1]}/`;
  return {
    keyboard: [
      [{ text: "🎓 Akademiyani ochish", web_app: { url: webAppUrl } }],
      [{ text: "💬 Anonim savol" }, { text: "🔔 Eslatma" }]
    ],
    resize_keyboard: true
  };
}

// Toshkent ISO haftasini hisoblash
function getTashkentISOWeek() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tashkentTime = new Date(utc + (3600000 * 5));
  const d = new Date(Date.UTC(tashkentTime.getFullYear(), tashkentTime.getMonth(), tashkentTime.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

async function handleUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';

    // 1. SHAXSIY LINK ORQALI KIRGANDA (/start ask_USERID)
    if (text.startsWith('/start ask_')) {
      const targetUserId = text.replace('/start ask_', '').trim();
      const token = encryptUserToken(userId);

      await api('sendMessage', {
        chat_id: chatId,
        text: `💬 **Anonim Xabar Yuborish**\n\nSavol yoki xabaringizni pastda yozib yuboring. Xabaringiz manzil egasiga mutlaqo anonim tarzda yetkaziladi.`,
        reply_markup: { force_reply: true }
      });

      // Target ID'ni vaqtinchalik saqlash/o'tkazish uchun session parametri
      const sessionData = readJSONState('sessions.json', {});
      sessionData[userId] = targetUserId;
      writeJSONState('sessions.json', sessionData);
      return;
    }

    // 2. REPLY ORQALI ANONIM SAVOL YUBORILGANDA
    if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.includes("Anonim Xabar Yuborish")) {
      const sessionData = readJSONState('sessions.json', {});
      const targetUserId = sessionData[userId];
      const senderName = sanitizeText(msg.from.first_name);
      const senderUsername = msg.from.username ? `@${msg.from.username}` : "Mavjud emas";
      const senderId = userId;
      const token = encryptUserToken(senderId);

      // A) FOYDALANUVCHIGA (Mavzu egasiga) - Mutlaqo anonim tarzda boradi
      if (targetUserId) {
        await api('sendMessage', {
          chat_id: targetUserId,
          text: `📩 **Sizga yangi anonim xabar keldi:**\n\n"${text}"\n\n🔒 ${token}`
        });
      }

      // B) ADMINGA (Sizga) - Kim yuborgani aniq ko'rinib boradi
      if (ADMIN_ID) {
        await api('sendMessage', {
          chat_id: ADMIN_ID,
          text: `🕵️ **[ADMIN MONITORING] Yangi Anonim Xabar**\n\n👤 **Kimdan:** ${senderName} (${senderUsername})\n🆔 **ID:** \`${senderId}\`\n🎯 **Kimga (Target ID):** \`${targetUserId || "Admin"}\`\n\n💬 **Xabar:**\n"${text}"\n\n🔒 ${token}`
        });
      }

      await api('sendMessage', {
        chat_id: chatId,
        text: "✅ Xabaringiz anonim tarzda yetkazildi!"
      });
      return;
    }

    // 3. Admin Reply orqali anonim xabarlarga javob qaytarishi
    if (msg.reply_to_message && msg.reply_to_message.text) {
      const origText = msg.reply_to_message.text;
      const match = origText.match(/🔒\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
      if (match) {
        const replyTargetUserId = decryptUserToken(match[1]);
        if (replyTargetUserId) {
          await api('sendMessage', {
            chat_id: replyTargetUserId,
            text: `💬 **Anonim xabaringizga javob keldi:**\n\n${text}`
          });
          await api('sendMessage', { chat_id: chatId, text: "Javob foydalanuvchiga yetkazildi!" });
          return;
        }
      }
    }

    // 4. Kanal a'zoligini tekshirish
    const subbed = await isSubscribed(userId);
    if (!subbed) {
      await sendSubGate(chatId);
      return;
    }

    // Darsliklarni ochish (Deep-link)
    if (text.startsWith('/start lib_')) {
      const libId = text.replace('/start lib_', '').trim();
      const library = readJSONState('library.json', []);
      const item = library.find(l => l.id === libId);
      if (item && item.file_id) {
        await api('sendDocument', { chat_id: chatId, document: item.file_id, caption: item.t });
      } else {
        await api('sendMessage', { chat_id: chatId, text: "Darslik topilmadi." });
      }
      return;
    }

    // 5. Command: /start (Shaxsiy link va menyu taqdim etiladi)
    if (text === '/start') {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;

      await api('sendMessage', {
        chat_id: chatId,
        text: `Xush kelibsiz! Akademiyani ochish uchun quyidagi tugmani bosing.\n\n🔗 **Sizning shaxsiy anonim havolangiz:**\n\`${personalLink}\`\n\n_Ushbu havolani kanalingizga yoki profilingizga joylang. Do'stlaringiz sizga anonim xabarlar yuborishlari mumkin!_\n\nMuhokama guruhi: @huquqmind`,
        reply_markup: getMainMenu()
      });
      return;
    }

    // 6. Admin buyruqlari
    if (userId === ADMIN_ID) {
      if (msg.document) {
        const docName = msg.caption || msg.document.file_name || "Darslik";
        const library = readJSONState('library.json', []);
        const newId = "lib_" + Date.now();
        library.push({ id: newId, t: docName, s: "PDF Darslik", d: new Date().toISOString(), file_id: msg.document.file_id });
        writeJSONState('library.json', library);
        await api('sendMessage', { chat_id: ADMIN_ID, text: `Darslik saqlandi! ID: ${newId}` });
        return;
      }

      if (text.startsWith('/del ')) {
        const delId = text.replace('/del ', '').trim();
        let library = readJSONState('library.json', []);
        library = library.filter(l => l.id !== delId);
        writeJSONState('library.json', library);
        await api('sendMessage', { chat_id: ADMIN_ID, text: "Darslik o'chirildi." });
        return;
      }

      if (text === '/stats') {
        const subs = readJSONState('subs.json', []);
        await api('sendMessage', { chat_id: ADMIN_ID, text: `Eslatmalarga obunachilar soni: ${subs.length}` });
        return;
      }
    }

    // 7. Menyu tugmalari
    if (text === "💬 Anonim savol") {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;

      await api('sendMessage', {
        chat_id: chatId,
        text: `💬 **Sizning Shaxsiy Anonim Havolangiz:**\n\n\`${personalLink}\`\n\nUshbu havolani nusxalab, profilingizga yoki kanalingizga qo'ying. Odamlar ushbu havola orqali sizga anonim xabar yuborishlari mumkin!`,
        disable_web_page_preview: true
      });
      return;
    }

    if (text === "🔔 Eslatma") {
      let subs = readJSONState('subs.json', []);
      if (subs.includes(chatId)) {
        subs = subs.filter(id => id !== chatId);
        writeJSONState('subs.json', subs);
        await api('sendMessage', { chat_id: chatId, text: "Kunlik eslatmalar o'chirildi." });
      } else {
        subs.push(chatId);
        writeJSONState('subs.json', subs);
        await api('sendMessage', { chat_id: chatId, text: "Kunlik eslatmalar yoqildi!" });
      }
      return;
    }

    // 8. WebApp orqali kelgan natijalar (tg.sendData)
    if (msg.web_app_data && msg.web_app_data.data) {
      try {
        const payload = JSON.parse(msg.web_app_data.data);
        if (payload.v === 1 && payload.t === "score") {
          const c = parseInt(payload.c, 10);
          const n = parseInt(payload.n, 10);

          if (n >= 1 && n <= 30 && c >= 0 && c <= n) {
            const currentWeek = getTashkentISOWeek();
            let leaderboardMeta = readJSONState('meta.json', { week: currentWeek });
            let leaderboard = readJSONState('leaderboard.json', []);
            let scores = readJSONState('scores.json', {});

            if (leaderboardMeta.week !== currentWeek) {
              leaderboardMeta.week = currentWeek;
              leaderboard = [];
              scores = {};
            }

            const cleanName = sanitizeText(msg.from.first_name);
            const userHash = crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 10);

            const userScoreData = scores[userHash] || { count: 0, totalScore: 0 };
            if (userScoreData.count < 40) {
              userScoreData.count++;
              userScoreData.totalScore += c;
              scores[userHash] = userScoreData;

              const existingIdx = leaderboard.findIndex(item => item.id === userHash);
              if (existingIdx >= 0) {
                leaderboard[existingIdx].score = userScoreData.totalScore;
                leaderboard[existingIdx].name = cleanName;
              } else {
                leaderboard.push({ id: userHash, name: cleanName, score: userScoreData.totalScore });
              }

              leaderboard.sort((a, b) => b.score - a.score);
              leaderboard = leaderboard.slice(0, 10);

              writeJSONState('meta.json', leaderboardMeta);
              writeJSONState('scores.json', scores);
              writeJSONState('leaderboard.json', leaderboard);

              await api('sendMessage', { chat_id: chatId, text: `Natijangiz qabul qilindi! Umumiy ball: ${userScoreData.totalScore}` });
            } else {
              await api('sendMessage', { chat_id: chatId, text: "Bugungi yuborish chekloviga yetdingiz." });
            }
          }
        }
      } catch (e) {}
      return;
    }
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    if (cb.data === "check_sub") {
      const subbed = await isSubscribed(cb.from.id);
      if (subbed) {
        await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Rahmat! A'zolik tasdiqlandi." });
        await api('sendMessage', {
          chat_id: cb.message.chat.id,
          text: "Xush kelibsiz! Akademiyani ochish uchun quyidagi tugmani bosing.",
          reply_markup: getMainMenu()
        });
      } else {
        await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Hali kanalga a'zo bo'lmadingiz!", show_alert: true });
      }
    }
  }
}

// Kunlik eslatma yuborish
async function checkAndSendReminders() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tashkentTime = new Date(utc + (3600000 * 5));
  const hour = tashkentTime.getHours();

  if (hour >= 7 && hour < 21) {
    const today = tashkentTime.toISOString().split('T')[0];
    const hb = readJSONState('heartbeat.json', { lastReminderDate: "" });

    if (hb.lastReminderDate !== today) {
      hb.lastReminderDate = today;
      writeJSONState('heartbeat.json', hb);

      const subs = readJSONState('subs.json', []);
      const webAppUrl = `https://${GITHUB_REPO.split('/')[0]}.github.io/${GITHUB_REPO.split('/')[1]}/`;
      let activeSubs = [...subs];

      for (const subId of subs) {
        const res = await api('sendMessage', {
          chat_id: subId,
          text: "Bugungi huquqiy streakni yangilash esdan chiqmadimi? 🔥 Kun testini yechish uchun bosing!",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔥 Testni Boshlash", web_app: { url: webAppUrl } }]
            ]
          }
        });

        if (!res.ok && res.error_code === 403) {
          activeSubs = activeSubs.filter(id => id !== subId);
        }
        await new Promise(r => setTimeout(r, 60));
      }
      writeJSONState('subs.json', activeSubs);
    }
  }
}

// Bot ma'lumotlarini olish va ishga tushirish
async function startBot() {
  console.log("Bot ishga tushdi...");
  await api('deleteWebhook');

  try {
    const me = await api('getMe');
    if (me.ok && me.result.username) {
      botUsername = me.result.username;
    }
  } catch (e) {}

  await checkAndSendReminders();

  const startTime = Date.now();
  let offset = 0;

  while (Date.now() - startTime < 285000) {
    try {
      const res = await api('getUpdates', { offset, timeout: 50 });
      if (res.ok && res.result.length > 0) {
        for (const update of res.result) {
          await handleUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (e) {
      console.error("Polling xatosi:", e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log("Polling yakunlandi.");
}

startBot();
