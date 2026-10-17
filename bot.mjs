import fs from 'fs';
import path from 'path';

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

let botUsername = "huquqmindBot";

function readJSONState(file, defaultData) {
  const p = path.join(STATE_DIR, file);
  if (fs.existsSync(p)) {
    try { 
      return JSON.parse(fs.readFileSync(p, 'utf8')); 
    } catch (e) { 
      return defaultData; 
    }
  }
  return defaultData;
}

function writeJSONState(file, data) {
  const p = path.join(STATE_DIR, file);
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Faylga yozishda xatolik (${file}):`, e.message);
  }
}

// HTML Escape funksiyasi
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Telegram API chaqiruvi (Xatosiz variant)
async function api(method, params = {}) {
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`Telegram API Xatosi [${method}]:`, data);
    }
    return data;
  } catch (err) {
    console.error(`Network API Xatosi [${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

function sanitizeText(str) {
  if (!str) return 'Noma\'lum';
  return str.replace(/[\r\n\t]/g, ' ').trim().substring(0, 30);
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

    let sessionData = readJSONState('sessions.json', {});

    // Media yuborilganda matn so'rash
    if (sessionData[userId] && !msg.text && (msg.photo || msg.voice || msg.video || msg.document || msg.sticker)) {
      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>Iltimos, matn ko'rinishida yuboring.</b>",
        parse_mode: "HTML"
      });
      return;
    }

    // 1. Anonim link orqali kirganda (/start ask_ID)
    if (text.startsWith('/start ask_')) {
      const targetUserId = text.replace('/start ask_', '').trim();

      if (parseInt(targetUserId, 10) === userId) {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Bu sizning shaxsiy havolangiz.</b>",
          parse_mode: "HTML",
          reply_markup: getMainMenu()
        });
        return;
      }

      sessionData[userId] = targetUserId;
      writeJSONState('sessions.json', sessionData);

      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>💬 Anonim Xabar Yuborish</b>\n\nSavolingiz yoki xabaringizni yozib yuboring. Xabaringiz mazkur foydalanuvchiga <b>mutlaqo anonim</b> tarzda yetkaziladi.",
        parse_mode: "HTML",
        reply_markup: { force_reply: true }
      });
      return;
    }

    // 2. Anonim xabar yuborilganda
    if (sessionData[userId] && text && !text.startsWith('/')) {
      const targetUserId = sessionData[userId];
      delete sessionData[userId];
      writeJSONState('sessions.json', sessionData);

      const safeText = escapeHtml(text);
      const senderName = escapeHtml(sanitizeText(msg.from.first_name));
      const rawUsername = msg.from.username ? msg.from.username.trim() : "";

      // Target foydalanuvchiga boradigan anonim xabar
      await api('sendMessage', {
        chat_id: targetUserId,
        text: `<b>📩 Sizga yangi anonim xabar keldi:</b>\n\n<i>"${safeText}"</i>`,
        parse_mode: "HTML"
      });

      // Adminga boradigan monitoring xabari
      if (ADMIN_ID) {
        let userLink = "";
        if (rawUsername) {
          userLink = `<a href="https://t.me/${rawUsername}">@${escapeHtml(rawUsername)}</a>`;
        } else {
          userLink = `<a href="tg://user?id=${userId}">${senderName}</a> (Username yo'q)`;
        }

        const adminMsgRes = await api('sendMessage', {
          chat_id: ADMIN_ID,
          text: `<b>🕵️ [ANONIM XABAR MONITORINGI]</b>\n\n👤 <b>Kimdan:</b> ${userLink}\n🆔 <b>ID:</b> <code>${userId}</code>\n🎯 <b>Kimga (Target ID):</b> <code>${targetUserId}</code>\n\n💬 <b>Xabar:</b>\n<i>"${safeText}"</i>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✍️ Javob yozish", callback_data: `reply_${userId}` }]
            ]
          }
        });

        if (adminMsgRes.ok && adminMsgRes.result) {
          const replySessions = readJSONState('reply_sessions.json', {});
          replySessions[adminMsgRes.result.message_id] = {
            targetUserId: userId,
            createdAt: Date.now()
          };
          writeJSONState('reply_sessions.json', replySessions);
        }
      }

      // Yuboruvchiga tasdiq
      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>✅ Xabaringiz egasiga muvaffaqiyatli yetkazildi!</b>",
        parse_mode: "HTML",
        reply_markup: getMainMenu()
      });
      return;
    }

    // 3. Admin Reply Orqali Javob Berishi
    if (userId === ADMIN_ID && msg.reply_to_message) {
      const repliedMsgId = msg.reply_to_message.message_id;
      let replySessions = readJSONState('reply_sessions.json', {});
      const session = replySessions[repliedMsgId];

      if (session) {
        if (Date.now() - session.createdAt < 600000) { // 10 daqiqa
          const safeReplyText = escapeHtml(text);
          await api('sendMessage', {
            chat_id: session.targetUserId,
            text: `<b>💬 Anonim xabaringizga javob keldi:</b>\n\n<i>"${safeReplyText}"</i>`,
            parse_mode: "HTML"
          });
          
          await api('sendMessage', {
            chat_id: ADMIN_ID,
            text: "<b>✅ Javob foydalanuvchiga yetkazildi!</b>",
            parse_mode: "HTML"
          });

          delete replySessions[repliedMsgId];
          writeJSONState('reply_sessions.json', replySessions);
          return;
        } else {
          delete replySessions[repliedMsgId];
          writeJSONState('reply_sessions.json', replySessions);
          await api('sendMessage', {
            chat_id: ADMIN_ID,
            text: "<b>⚠️ Javob berish vaqti tugagan (10 daqiqa o'tib ketgan).</b>",
            parse_mode: "HTML"
          });
          return;
        }
      }
    }

    // Kanal obunasi
    const subbed = await isSubscribed(userId);
    if (!subbed) {
      await sendSubGate(chatId);
      return;
    }

    // Darsliklar
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

    // /start buyrug'i
    if (text === '/start') {
      if (userId === ADMIN_ID) {
        const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;
        const shareText = encodeURIComponent("Menga anonim savol yoki fikringizni yuboring! 👇");
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(personalLink)}&text=${shareText}`;

        await api('sendMessage', {
          chat_id: chatId,
          text: `<b>Xush kelibsiz, Admin!</b> Akademiyani ochish uchun pastdagi tugmani bosing.\n\n🔗 <b>Sizning shaxsiy anonim havolangiz:</b>\n<code>${personalLink}</code>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📤 Do'stlarga ulashish", url: shareUrl }]
            ]
          }
        });
      } else {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun pastdagi tugmani bosing.",
          parse_mode: "HTML"
        });
      }

      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>Asosiy menyu:</b>",
        parse_mode: "HTML",
        reply_markup: getMainMenu()
      });
      return;
    }

    // Admin boshqaruvi
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

    // "💬 Anonim savol" tugmasi
    if (text === "💬 Anonim savol") {
      if (userId === ADMIN_ID) {
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
      } else {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Bu funksiya faqat admin uchun.</b>",
          parse_mode: "HTML"
        });
      }
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

  // Callback tugmalar
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

    if (cb.data.startsWith('reply_') && userId === ADMIN_ID) {
      await api('answerCallbackQuery', { 
        callback_query_id: cb.id, 
        text: "Javob berish uchun tepadagi monitoring xabariga 'Reply' (Javob) qilib yozing.",
        show_alert: true 
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
    if (me.ok && me.result && me.result.username) {
      botUsername = me.result.username;
    }
  } catch (e) {}

  let offset = 0;

  // Eski kutilayotgan updatelarni tozalash
  try {
    const pendingRes = await api('getUpdates', { offset: -1, timeout: 0 });
    if (pendingRes.ok && pendingRes.result && pendingRes.result.length > 0) {
      offset = pendingRes.result[pendingRes.result.length - 1].update_id + 1;
    }
  } catch (e) {}

  const startTime = Date.now();

  // Polling loop
  while (Date.now() - startTime < 285
