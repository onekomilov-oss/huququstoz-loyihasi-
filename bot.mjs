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

const ENC_KEY = crypto.createHash('sha256').update(TOKEN).digest();
let botUsername = "huquqmindBot";

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

    // 1. Shaxsiy link orqali kimdir kirganda (/start ask_ID)
    if (text.startsWith('/start ask_')) {
      const targetUserId = text.replace('/start ask_', '').trim();
      
      // O'z-o'ziga yozishining oldini olish
      if (parseInt(targetUserId, 10) === userId) {
        await api('sendMessage', {
          chat_id: chatId,
          text: "Bu sizning shaxsiy havolangiz. Uni do'stlaringizga ulashing!",
          reply_markup: getMainMenu()
        });
        return;
      }

      // Target ID'ni sessiyada saqlaymiz
      let sessionData = readJSONState('sessions.json', {});
      sessionData[userId] = targetUserId;
      writeJSONState('sessions.json', sessionData);

      await api('sendMessage', {
        chat_id: chatId,
        text: `💬 **Anonim Xabar Yuborish**\n\nUshbu foydalanuvchiga yubormoqchi bo'lgan xabaringizni yozib yuboring. Xabaringiz unga anonim tarzda yetkaziladi.`,
        reply_markup: { force_reply: true }
      });
      return;
    }

    // 2. Foydalanuvchi anonim xabar yozib yuborganda (Sessiya tekshiriladi)
    let sessionData = readJSONState('sessions.json', {});
    if (sessionData[userId] && !text.startsWith('/')) {
      const targetUserId = sessionData[userId];
      delete sessionData[userId]; // Sessiyani tozalaymiz
      writeJSONState('sessions.json', sessionData);

      const senderName = sanitizeText(msg.from.first_name);
      const senderUsername = msg.from.username ? `@${msg.from.username}` : "Mavjud emas";
      const token = encryptUserToken(userId);

      // Xabarni QABUL QILUVCHIGA yuborish (Anonim tarzda)
      await api('sendMessage', {
        chat_id: targetUserId,
        text: `📩 **Sizga yangi anonim xabar keldi:**\n\n"${text}"\n\n🔒 ${token}`
      });

      // Xabarni ADMINGA yuborish (Kim yuborgani aniq ko'rinadi)
      if (ADMIN_ID && ADMIN_ID !== targetUserId) {
        await api('sendMessage', {
          chat_id: ADMIN_ID,
          text: `🕵️ **[ANONIM MONITORING]**\n\n👤 **Kimdan:** ${senderName} (${senderUsername})\n🆔 **ID:** \`${userId}\`\n🎯 **Kimga (Target):** \`${targetUserId}\`\n\n💬 **Xabar:**\n"${text}"\n\n🔒 ${token}`
        });
      }

      await api('sendMessage', {
        chat_id: chatId,
        text: "✅ Xabaringiz egasiga muvaffaqiyatli yetkazildi!",
        reply_markup: getMainMenu()
      });
      return;
    }

    // 3. Admin anonim xabarga javob yozganda
    if (userId === ADMIN_ID && msg.reply_to_message && msg.reply_to_message.text) {
      const origText = msg.reply_to_message.text;
      const match = origText.match(/🔒\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
      if (match) {
        const replyTargetUserId = decryptUserToken(match[1]);
        if (replyTargetUserId) {
          await api('sendMessage', {
            chat_id: replyTargetUserId,
            text: `👨‍⚖️ **Anonim xabaringizga javob keldi:**\n\n${text}`
          });
          await api('sendMessage', { chat_id: ADMIN_ID, text: "Javob foydalanuvchiga yetkazildi!" });
          return;
        }
      }
    }

    // Kanal a'zoligini tekshirish
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

    // Command: /start
    if (text === '/start') {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;
      const shareText = encodeURIComponent("Menga anonim savol yoki fikringizni yuboring! 👇");
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(personalLink)}&text=${shareText}`;

      await api('sendMessage', {
        chat_id: chatId,
        text: `Xush kelibsiz! Akademiyani ochish uchun quyidagi tugmani bosing.\n\n🔗 **Sizning shaxsiy anonim havolangiz:**\n\`${personalLink}\``,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Do'stlarga ulashish", url: shareUrl }]
          ]
        }
      });
      await api('sendMessage', {
        chat_id: chatId,
        text: "Asosiy menyu:",
        reply_markup: getMainMenu()
      });
      return;
    }

    // Admin buyruqlari
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

    // Menyu tugmalari
    if (text === "💬 Anonim savol") {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;
      const shareText = encodeURIComponent("Menga anonim savol yoki fikringizni yuboring! 👇");
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(personalLink)}&text=${shareText}`;

      await api('sendMessage', {
        chat_id: chatId,
        text: `💬 **Sizning Shaxsiy Anonim Havolangiz:**\n\n\`${personalLink}\``,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Do'stlarga ulashish", url: shareUrl }]
          ]
        },
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

    // WebApp natijalari
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

async function startBot() {
  console.log("Bot ishga tushdi...");
  await api('deleteWebhook');

  try {
    const me = await api('getMe');
    if (me.ok && me.result.username) {
      botUsername = me.result.username;
    }
  } catch (e) {}

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
