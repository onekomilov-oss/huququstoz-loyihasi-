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
    text: "<b>Avval kanalga a'zo bo'ling:</b>",
    parse_mode: "HTML",
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

async function handleUpdate(update) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';

    // 1. Shaxsiy link orqali kimdir kirganda (/start ask_ID)
    if (text.startsWith('/start ask_')) {
      const targetUserId = text.replace('/start ask_', '').trim();
      
      if (parseInt(targetUserId, 10) === userId) {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Bu sizning shaxsiy havolangiz. Uni do'stlaringizga ulashing!</b>",
          parse_mode: "HTML",
          reply_markup: getMainMenu()
        });
        return;
      }

      let sessionData = readJSONState('sessions.json', {});
      sessionData[userId] = targetUserId;
      writeJSONState('sessions.json', sessionData);

      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>💬 Anonim Xabar Yuborish</b>\n\nUshbu foydalanuvchiga yubormoqchi bo'lgan xabaringizni yozib yuboring. Xabaringiz unga <b>mutlaqo anonim</b> tarzda yetkaziladi.",
        parse_mode: "HTML",
        reply_markup: { force_reply: true }
      });
      return;
    }

    // 2. Foydalanuvchi anonim xabar yozib yuborganda
    let sessionData = readJSONState('sessions.json', {});
    if (sessionData[userId] && !text.startsWith('/')) {
      const targetUserId = sessionData[userId];
      delete sessionData[userId];
      writeJSONState('sessions.json', sessionData);

      const senderName = sanitizeText(msg.from.first_name);
      const senderUsername = msg.from.username ? `@${msg.from.username}` : "Mavjud emas";
      const token = encryptUserToken(userId);

      // A) EGASIGA (Qabul qiluvchiga) - Mutlaqo anonim boradi
      await api('sendMessage', {
        chat_id: targetUserId,
        text: `<b>📩 Sizga yangi anonim xabar keldi:</b>\n\n<i>"${text}"</i>`,
        parse_mode: "HTML"
      });

      // B) ADMINGA - Kim yuborgani ko'rinadi va maxsus "Javob yozish" tugmasi qo'shiladi
      if (ADMIN_ID) {
        await api('sendMessage', {
          chat_id: ADMIN_ID,
          text: `<b>🕵️ [ANONIM MONITORING]</b>\n\n👤 <b>Kimdan:</b> ${senderName} (${senderUsername})\n🆔 <b>ID:</b> <code>${userId}</code>\n🎯 <b>Kimga:</b> <code>${targetUserId}</code>\n\n💬 <b>Xabar:</b>\n<i>"${text}"</i>\n\n🔒 <code>${token}</code>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✍️ Javob yozish", callback_data: `reply_${userId}` }]
            ]
          }
        });
      }

      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>✅ Xabaringiz egasiga muvaffaqiyatli yetkazildi!</b>",
        parse_mode: "HTML",
        reply_markup: getMainMenu()
      });
      return;
    }

    // 3. Admin callback orqali javob yozishni boshlaganda (Sessiyaga yozamiz)
    // (Pastdagi callback_query qismida ishlaydi)

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
        await api('sendMessage', { chat_id: chatId, text: "<b>Darslik topilmadi.</b>", parse_mode: "HTML" });
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
        text: `<b>Xush kelibsiz!</b> Akademiyani ochish uchun pastdagi tugmani bosing.\n\n🔗 <b>Sizning shaxsiy anonim havolangiz:</b>\n<code>${personalLink}</code>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Do'stlarga ulashish", url: shareUrl }]
          ]
        }
      });
      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>Asosiy menyu:</b>",
        parse_mode: "HTML",
        reply_markup: getMainMenu()
      });
      return;
    }

    // Admin javob yozayotganini tekshirish (Force reply orqali)
    if (userId === ADMIN_ID && msg.reply_to_message && msg.reply_to_message.text) {
      const replySessions = readJSONState('reply_sessions.json', {});
      if (replySessions[ADMIN_ID]) {
        const targetUserId = replySessions[ADMIN_ID];
        delete replySessions[ADMIN_ID];
        writeJSONState('reply_sessions.json', replySessions);

        await api('sendMessage', {
          chat_id: targetUserId,
          text: `<b>💬 Anonim xabaringizga javob keldi:</b>\n\n<i>"${text}"</i>`,
          parse_mode: "HTML"
        });
        await api('sendMessage', { chat_id: ADMIN_ID, text: "<b>✅ Javob foydalanuvchiga yetkazildi!</b>", parse_mode: "HTML" });
        return;
      }
    }

    // Admin buyruqlari
    if (userId === ADMIN_ID) {
      if (msg.document) {
        const docName = msg.caption || msg.document.file_name || "Darslik";
        const library = readJSONState('library.json', []);
        const newId = "lib_" + Date.now();
        library.push({ id: newId, t: docName, s: "PDF Darslik", d: new Date().toISOString(), file_id: msg.document.file_id });
        writeJSONState('library.json', library);
        await api('sendMessage', { chat_id: ADMIN_ID, text: `<b>Darslik saqlandi! ID:</b> ${newId}`, parse_mode: "HTML" });
        return;
      }
      if (text.startsWith('/del ')) {
        const delId = text.replace('/del ', '').trim();
        let library = readJSONState('library.json', []);
        library = library.filter(l => l.id !== delId);
        writeJSONState('library.json', library);
        await api('sendMessage', { chat_id: ADMIN_ID, text: "<b>Darslik o'chirildi.</b>", parse_mode: "HTML" });
        return;
      }
      if (text === '/stats') {
        const subs = readJSONState('subs.json', []);
        await api('sendMessage', { chat_id: ADMIN_ID, text: `<b>Eslatmalarga obunachilar soni:</b> ${subs.length}`, parse_mode: "HTML" });
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
        text: `<b>💬 Sizning Shaxsiy Anonim Havolangiz:</b>\n\n<code>${personalLink}</code>`,
        parse_mode: "HTML",
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
        await api('sendMessage', { chat_id: chatId, text: "<b>Kunlik eslatmalar o'chirildi.</b>", parse_mode: "HTML" });
      } else {
        subs.push(chatId);
        writeJSONState('subs.json', subs);
        await api('sendMessage', { chat_id: chatId, text: "<b>Kunlik eslatmalar yoqildi!</b>", parse_mode: "HTML" });
      }
      return;
    }
  }

  // Callback Queries (Tugmalar bosilganda)
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;

    if (cb.data === "check_sub") {
      const subbed = await isSubscribed(userId);
      if (subbed) {
        await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Rahmat! A'zolik tasdiqlandi." });
        await api('sendMessage', {
          chat_id: cb.message.chat.id,
          text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun quyidagi tugmani bosing.",
          parse_mode: "HTML",
          reply_markup: getMainMenu()
        });
      } else {
        await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Hali kanalga a'zo bo'lmadingiz!", show_alert: true });
      }
      return;
    }

    // Admin "✍️ Javob yozish" tugmasini bosganda
    if (cb.data.startsWith('reply_') && userId === ADMIN_ID) {
      const targetUserId = cb.data.replace('reply_', '').trim();
      
      let replySessions = readJSONState('reply_sessions.json', {});
      replySessions[ADMIN_ID] = targetUserId;
      writeJSONState('reply_sessions.json', replySessions);

      await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Javobingizni yozib yuboring:" });
      await api('sendMessage', {
        chat_id: ADMIN_ID,
        text: `<b>✍️ Ushbu foydalanuvchiga yozmoqchi bo'lgan javobingizni yuboring (shu xabarga reply qiling):</b>`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true }
      });
      return;
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
