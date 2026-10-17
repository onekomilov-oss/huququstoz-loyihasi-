// Cloudflare Pages / Workers uchun to'liq moslashtirilgan va to'g'rilangan bot kodi

function sanitizeText(str) {
  if (!str) return 'Noma\'lum';
  return str.replace(/[\r\n\t]/g, ' ').trim().substring(0, 30);
}

// HTML teglari buzilib ketmasligi uchun escape funksiyasi
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Telegram API chaqiruvi
async function api(method, params, token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    console.error(`API Xatosi [${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Kanal obunasini tekshirish
async function isSubscribed(userId, channelId, token) {
  try {
    const res = await api('getChatMember', { chat_id: channelId, user_id: userId }, token);
    if (res.ok && ['creator', 'administrator', 'member'].includes(res.result.status)) {
      return true;
    }
  } catch (e) {}
  return false;
}

// Kanalga a'zo bo'lish tugmasi
async function sendSubGate(chatId, token) {
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
  }, token);
}

// Asosiy menyu
function getMainMenu(githubRepo) {
  const repoParts = (githubRepo || "onekomilov-oss/huququstoz-loyihasi-").split('/');
  const webAppUrl = `https://${repoParts[0]}.github.io/${repoParts[1]}/`;
  return {
    keyboard: [
      [{ text: "🎓 Akademiyani ochish", web_app: { url: webAppUrl } }],
      [{ text: "💬 Anonim savol" }, { text: "🔔 Eslatma" }]
    ],
    resize_keyboard: true
  };
}

// Cloudflare Webhook Handler
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('HuquqUstoz Bot Active', { status: 200 });
    }

    const TOKEN = env.BOT_TOKEN;
    const ADMIN_ID = parseInt(env.ADMIN_ID || "6345301727", 10);
    const CHANNEL_ID = env.CHANNEL_ID || "-1002606641183";
    const GITHUB_REPO = env.GITHUB_REPOSITORY || "onekomilov-oss/huququstoz-loyihasi-";

    if (!TOKEN) {
      return new Response('BOT_TOKEN missing', { status: 500 });
    }

    try {
      const update = await request.json();

      if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text || '';
        const botUsername = "huquqmindBot";

        // 1. Anonim link orqali kirganda (/start ask_ID)
        if (text.startsWith('/start ask_')) {
          const targetUserId = text.replace('/start ask_', '').trim();

          if (parseInt(targetUserId, 10) === userId) {
            await api('sendMessage', {
              chat_id: chatId,
              text: "<b>Bu sizning shaxsiy havolangiz. Uni do'stlaringizga ulashing!</b>",
              parse_mode: "HTML",
              reply_markup: getMainMenu(GITHUB_REPO)
            }, TOKEN);
            return new Response('OK');
          }

          // Force Reply orqali anonim xabar kiritishni so'rash (Target ID xabar matniga yashiriladi)
          await api('sendMessage', {
            chat_id: chatId,
            text: `<b>💬 Anonim Xabar Yuborish</b>\n\nSavolingizni yozib yuboring. Xabaringiz mazkur foydalanuvchiga <b>mutlaqo anonim</b> tarzda yetkaziladi.\n\n<i>(Target ID: <code>${targetUserId}</code> — Ushbu xabarga 'Reply' qilib yozing)</i>`,
            parse_mode: "HTML",
            reply_markup: { force_reply: true }
          }, TOKEN);
          return new Response('OK');
        }

        // 2. Foydalanuvchi anonim xabarni yozib yuborganda
        if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.includes("Anonim Xabar Yuborish")) {
          const matchTarget = msg.reply_to_message.text.match(/Target ID:\s*(\d+)/);
          const targetUserId = matchTarget ? matchTarget[1] : ADMIN_ID;

          const safeText = escapeHtml(text);
          const senderName = escapeHtml(sanitizeText(msg.from.first_name));
          const senderUsername = msg.from.username ? `@${msg.from.username}` : "Username yo'q";

          // A) HAVOLA EGASIGA BORADIGAN XABAR (To'liq anonim)
          await api('sendMessage', {
            chat_id: targetUserId,
            text: `<b>📩 Sizga yangi anonim xabar keldi:</b>\n\n<i>"${safeText}"</i>`,
            parse_mode: "HTML"
          }, TOKEN);

          // B) ADMINGA BORADIGAN MONITORING XABARI
          if (ADMIN_ID) {
            await api('sendMessage', {
              chat_id: ADMIN_ID,
              text: `<b>🕵️ [ANONIM XABAR MONITORINGI]</b>\n\n👤 <b>Kimdan:</b> ${senderName} (${senderUsername})\n🆔 <b>User ID:</b> <code>${userId}</code>\n🎯 <b>Target ID:</b> <code>${targetUserId}</code>\n\n💬 <b>Xabar:</b>\n<i>"${safeText}"</i>`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "✍️ Javob yozish", callback_data: `reply_${userId}` }]
                ]
              }
            }, TOKEN);
          }

          // C) YUBORGAN ODAMGA TASDIQ
          await api('sendMessage', {
            chat_id: chatId,
            text: "<b>✅ Xabaringiz egasiga muvaffaqiyatli yetkazildi!</b>",
            parse_mode: "HTML",
            reply_markup: getMainMenu(GITHUB_REPO)
          }, TOKEN);
          return new Response('OK');
        }

        // 3. Admin javob berishi (Reply orqali)
        if (userId === ADMIN_ID && msg.reply_to_message) {
          const origText = msg.reply_to_message.text || '';
          
          // Monitoring xabari yoki Target ID xabaridan user_id ajratib olish
          const matchUser = origText.match(/User ID:\s*(\d+)/) || origText.match(/Target ID:\s*(\d+)/);

          if (matchUser) {
            const targetUserId = matchUser[1];
            const safeReplyText = escapeHtml(text);

            await api('sendMessage', {
              chat_id: targetUserId,
              text: `<b>💬 Anonim xabaringizga javob keldi:</b>\n\n<i>"${safeReplyText}"</i>`,
              parse_mode: "HTML"
            }, TOKEN);

            await api('sendMessage', {
              chat_id: ADMIN_ID,
              text: "<b>✅ Javob foydalanuvchiga yetkazildi!</b>",
              parse_mode: "HTML"
            }, TOKEN);
            return new Response('OK');
          }
        }

        // Kanal obunasini tekshirish
        const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
        if (!subbed) {
          await sendSubGate(chatId, TOKEN);
          return new Response('OK');
        }

        // /start buyrug'i (Faqat admin uchun shaxsiy link)
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
            }, TOKEN);
          } else {
            await api('sendMessage', {
              chat_id: chatId,
              text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun pastdagi tugmani bosing.",
              parse_mode: "HTML"
            }, TOKEN);
          }

          await api('sendMessage', {
            chat_id: chatId,
            text: "<b>Asosiy menyu:</b>",
            parse_mode: "HTML",
            reply_markup: getMainMenu(GITHUB_REPO)
          }, TOKEN);
          return new Response('OK');
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
            }, TOKEN);
          } else {
            await api('sendMessage', {
              chat_id: chatId,
              text: "<b>Bu funksiya faqat admin uchun.</b>",
              parse_mode: "HTML"
            }, TOKEN);
          }
          return new Response('OK');
        }
      }

      // Inline tugmalar bosilganda
      if (update.callback_query) {
        const cb = update.callback_query;
        const userId = cb.from.id;

        if (cb.data === "check_sub") {
          const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
          if (subbed) {
            await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Rahmat! A'zolik tasdiqlandi." }, TOKEN);
            await api('sendMessage', {
              chat_id: cb.message.chat.id,
              text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun quyidagi tugmani bosing.",
              parse_mode: "HTML",
              reply_markup: getMainMenu(GITHUB_REPO)
            }, TOKEN);
          } else {
            await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Hali kanalga a'zo bo'lmadingiz!", show_alert: true }, TOKEN);
          }
          return new Response('OK');
        }

        if (cb.data.startsWith('reply_') && userId === ADMIN_ID) {
          const targetUserId = cb.data.replace('reply_', '').trim();
          await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Javobingizni yozing:" }, TOKEN);
          await api('sendMessage', {
            chat_id: ADMIN_ID,
            text: `<b>✍️ Javobingizni shu xabarga Reply (javob) qilib yuboring:</b>\n\n🆔 <b>Target ID:</b> <code>${targetUserId}</code>`,
            parse_mode: "HTML",
            reply_markup: { force_reply: true }
          }, TOKEN);
          return new Response('OK');
        }
      }

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Webhook error:', err);
      return new Response('Error handling update', { status: 500 });
    }
  }
};
