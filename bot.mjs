// HuquqUstoz Telegram Bot — Hardened Edition (Cloudflare Workers)
// XAVFSIZLIK: webhookga "X-Telegram-Bot-Api-Secret-Token" sarlavhasini tekshirish
// webhookni o'rnatganda --secret-token bilan bir xil qiymat bering.

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeText(str) {
  if (!str) return "Noma'lum";
  return String(str).replace(/[\r\n\t]/g, ' ').trim().substring(0, 30);
}

function extractId(text, label) {
  const m = text.match(new RegExp(label + ':\\s*(\\d+)'));
  return m ? m[1] : null;
}

async function api(method, params, token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API xatosi [${method}]:`, err.message);
    return { ok: false, description: err.message };
  }
}

// BOT USERNAME CACHE — har bir xabarda getMe chaqirmaslik uchun
let _botUsernameCache = null;
async function getBotUsername(token) {
  if (_botUsernameCache) return _botUsernameCache;
  const me = await api('getMe', {}, token);
  if (me.ok && me.result && me.result.username) {
    _botUsernameCache = me.result.username;
    return _botUsernameCache;
  }
  return 'huquqmindBot';
}

async function isSubscribed(userId, channelId, token) {
  if (!channelId) return true; // kanal sozlanmagan bo'lsa darvoza o'chiriladi
  try {
    const res = await api('getChatMember', { chat_id: channelId, user_id: userId }, token);
    if (res.ok && ['creator', 'administrator', 'member'].includes(res.result.status)) {
      return true;
    }
  } catch (e) {
    console.error('isSubscribed xatosi:', e.message);
  }
  return false;
}

async function sendSubGate(chatId, channelId, token) {
  const channelUrl = typeof channelId === 'string' && channelId.startsWith('@')
    ? `https://t.me/${channelId.slice(1)}`
    : 'https://t.me/huququstoz';
  await api('sendMessage', {
    chat_id: chatId,
    text: "⚠️ <b>Botdan foydalanish uchun rasmiy kanalimizga a'zo bo'ling:</b>",
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Kanalga a'zo bo'lish", url: channelUrl }],
        [{ text: "✅ A'zolikni tekshirish", callback_data: 'check_sub' }]
      ]
    }
  }, token);
}

function getMainMenu(githubRepo) {
  const parts = (githubRepo || '').split('/').filter(Boolean);
  let webAppUrl = '';
  if (parts.length >= 2) {
    webAppUrl = `https://${parts[0]}.github.io/${parts[1]}/`;
  }
  const row1 = webAppUrl
    ? [{ text: '🎓 Akademiyani ochish', web_app: { url: webAppUrl } }]
    : [];
  return {
    keyboard: [
      ...row1,
      [{ text: '💬 Anonim savol' }, { text: '🔔 Eslatma' }]
    ],
    resize_keyboard: true
  };
}

async function forwardMediaOrText(targetChatId, msg, captionText, token) {
  if (msg.text) {
    return api('sendMessage', { chat_id: targetChatId, text: captionText, parse_mode: 'HTML' }, token);
  }
  const base = { chat_id: targetChatId, caption: captionText, parse_mode: 'HTML' };
  if (msg.photo) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    return api('sendPhoto', { ...base, photo: fileId }, token);
  }
  if (msg.voice) return api('sendVoice', { ...base, voice: msg.voice.file_id }, token);
  if (msg.audio) return api('sendAudio', { ...base, audio: msg.audio.file_id }, token);
  if (msg.video) return api('sendVideo', { ...base, video: msg.video.file_id }, token);
  if (msg.video_note) return api('sendVideoNote', { chat_id: targetChatId, video_note: msg.video_note.file_id }, token);
  if (msg.document) return api('sendDocument', { ...base, document: msg.document.file_id }, token);
  if (msg.sticker) {
    await api('sendMessage', { chat_id: targetChatId, text: captionText, parse_mode: 'HTML' }, token);
    return api('sendSticker', { chat_id: targetChatId, sticker: msg.sticker.file_id }, token);
  }
  if (msg.animation) return api('sendAnimation', { ...base, animation: msg.animation.file_id }, token);
  return { ok: false, description: 'unsupported media' };
}

function ok() {
  return new Response('OK', { status: 200 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Faqat POST (alive-check uchun GET ruxsat etiladi)
    if (request.method === 'GET') {
      return new Response('HuquqUstoz Bot Server Active', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const TOKEN = env.BOT_TOKEN;
    const ADMIN_ID = parseInt(env.ADMIN_ID || '6345301727', 10);
    const CHANNEL_ID = env.CHANNEL_ID || '-1002606641183';
    const GITHUB_REPO = env.GITHUB_REPOSITORY || 'onekomilov-oss/huququstoz-loyihasi-';
    const SECRET = env.WEBHOOK_SECRET || '';

    if (!TOKEN) {
      return new Response('BOT_TOKEN missing in environment variables', { status: 500 });
    }

    // XAVFSIZLIK: maxfiy token tekshiruvi
    if (SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch (e) {
      return ok();
    }
    if (!update || update.update_id === undefined) return ok();

    // Javobni darhol qaytaramiz, og'ir ishni fondda bajaramiz
    // (Telegram takroriy webhook yubormaydi)
    ctx.waitUntil(handleUpdate(update, { TOKEN, ADMIN_ID, CHANNEL_ID, GITHUB_REPO }).catch(err => {
      console.error('handleUpdate xatosi:', err);
    }));
    return ok();
  }
};

async function handleUpdate(update, cfg) {
  const { TOKEN, ADMIN_ID, CHANNEL_ID, GITHUB_REPO } = cfg;

  // ===== Inline callback =====
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;

    if (cb.data === 'check_sub') {
      const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
      if (!subbed) {
        await api('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: "Hali kanalga a'zo bo'lmadingiz!",
          show_alert: true
        }, TOKEN);
        return;
      }
      await api('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: "Rahmat! A'zolik tasdiqlandi."
      }, TOKEN);
      // cb.message bo'lmasligi mumkin (inaccessible message) — himoyalangan yuborish
      const chatId = cb.message?.chat?.id;
      if (chatId) {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun quyidagi tugmani bosing.",
          parse_mode: 'HTML',
          reply_markup: getMainMenu(GITHUB_REPO)
        }, TOKEN);
      }
    }
    return;
  }

  const msg = update.message;
  if (!msg || !msg.from) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';

  // ===== 1. Majburiy obuna darvozasi =====
  const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
  if (!subbed) {
    await sendSubGate(chatId, CHANNEL_ID, TOKEN);
    return;
  }

  const botUsername = await getBotUsername(TOKEN);

  // ===== 2. Shaxsiy havola: /start ask_ID =====
  if (text.startsWith('/start ask_')) {
    const raw = text.replace('/start ask_', '').trim();
    if (!/^\d+$/.test(raw)) {
      await api('sendMessage', {
        chat_id: chatId,
        text: '<b>❌ Havola noto\'g\'ri.</b>',
        parse_mode: 'HTML'
      }, TOKEN);
      return;
    }
    const targetUserId = parseInt(raw, 10);

    if (targetUserId === userId) {
      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>Bu sizning shaxsiy havolangiz. Uni do'stlaringiz va obunachilaringizga ulashing!</b>",
        parse_mode: 'HTML',
        reply_markup: getMainMenu(GITHUB_REPO)
      }, TOKEN);
      return;
    }

    await api('sendMessage', {
      chat_id: chatId,
      text: `<b>💬 Anonim Xabar Yuborish</b>\n\nSavol, fikr yoki taklifingizni yuboring (Matn, rasm yoki ovozli xabar).\n\n<i>Ushbu xabarga 'Reply' qilib yozing. Target_ID: <code>${targetUserId}</code></i>`,
      parse_mode: 'HTML',
      reply_markup: { force_reply: true }
    }, TOKEN);
    return;
  }

  // ===== 3. Reply oqimlari =====
  if (msg.reply_to_message) {
    const replyText = msg.reply_to_message.text || msg.reply_to_message.caption || '';

    // 3A) Foydalanuvchi anonim xabar yubormoqda (promptga reply)
    if (replyText.includes('Anonim Xabar Yuborish') && replyText.includes('Target_ID:')) {
      const targetUserId = extractId(replyText, 'Target_ID') || String(ADMIN_ID);
      await deliverAnon(msg, targetUserId, userId, ADMIN_ID, TOKEN, GITHUB_REPO);
      return;
    }

    // 3B) Qabul qiluvchi anonim xabarga javob qaytarmoqda
    // (xabar matnida Sender_ID saqlangan — ikki tomonlama anonim chat)
    if (replyText.includes('📩') && replyText.includes('Sender_ID:')) {
      const senderId = extractId(replyText, 'Sender_ID');
      if (senderId) {
        const safeReplyText = escapeHtml(msg.text || msg.caption || '[Media javob]');
        const caption = `<b>💬 Anonim xabaringizga javob keldi:</b>\n\n<i>"${safeReplyText}"</i>`;
        const res = await forwardMediaOrText(senderId, msg, caption, TOKEN);
        if (!res.ok) {
          await api('sendMessage', {
            chat_id: chatId,
            text: '<b>❌ Javob yetkazilmadi. Qabul qiluvchi botni bloklagan bo\'lishi mumkin.</b>',
            parse_mode: 'HTML'
          }, TOKEN);
        } else {
          await api('sendMessage', {
            chat_id: chatId,
            text: '<b>✅ Javobingiz anonim ravishda yetkazildi!</b>',
            parse_mode: 'HTML'
          }, TOKEN);
        }
        // Adminga monitoring
        await forwardMediaOrText(ADMIN_ID, msg,
          `<b>🕵️ [JAVOB MONITORINGI]</b>\n👤 <b>Kimdan:</b> <code>${userId}</code> (Target: <code>${senderId}</code>)`,
          TOKEN);
        return;
      }
    }

    // 3C) Admin monitoring xabariga javob yozmoqda
    if (userId === ADMIN_ID && (replyText.includes('Sender_ID:') || replyText.includes('Target_ID:'))) {
      const targetUserId = extractId(replyText, 'Sender_ID') || extractId(replyText, 'Target_ID');
      if (targetUserId) {
        const safeReplyText = escapeHtml(msg.text || msg.caption || '[Media javob]');
        const caption = `<b>💬 Admin javobi:</b>\n\n<i>"${safeReplyText}"</i>`;
        const res = await forwardMediaOrText(targetUserId, msg, caption, TOKEN);
        await api('sendMessage', {
          chat_id: ADMIN_ID,
          text: res.ok
            ? '<b>✅ Javobingiz foydalanuvchiga yetkazildi!</b>'
            : '<b>❌ Javob yetkazilmadi. Foydalanuvchi botni bloklagan bo\'lishi mumkin.</b>',
          parse_mode: 'HTML'
        }, TOKEN);
        return;
      }
    }
  }

  // ===== 4. /start =====
  if (text === '/start') {
    if (userId === ADMIN_ID) {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(personalLink)}&text=${encodeURIComponent('Menga anonim savol yoki fikringizni yuboring! 👇')}`;
      await api('sendMessage', {
        chat_id: chatId,
        text: `<b>Xush kelibsiz, Admin!</b> Akademiyani ochish uchun pastdagi tugmani bosing.\n\n🔗 <b>Sizning shaxsiy anonim havolangiz:</b>\n<code>${personalLink}</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: "📤 Do'stlarga ulashish", url: shareUrl }]]
        }
      }, TOKEN);
    } else {
      await api('sendMessage', {
        chat_id: chatId,
        text: "<b>Xush kelibsiz!</b> Huququstoz akademiyasidan foydalanish uchun pastdagi tugmani bosing.",
        parse_mode: 'HTML'
      }, TOKEN);
    }
    await api('sendMessage', {
      chat_id: chatId,
      text: '<b>Asosiy menyu:</b>',
      parse_mode: 'HTML',
      reply_markup: getMainMenu(GITHUB_REPO)
    }, TOKEN);
    return;
  }

  // ===== 5. "💬 Anonim savol" tugmasi =====
  if (text === '💬 Anonim savol') {
    if (userId === ADMIN_ID) {
      const personalLink = `https://t.me/${botUsername}?start=ask_${userId}`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(personalLink)}&text=${encodeURIComponent('Menga anonim savol yoki fikringizni yuboring! 👇')}`;
      await api('sendMessage', {
        chat_id: chatId,
        text: `<b>💬 Sizning Shaxsiy Anonim Havolangiz:</b>\n\n<code>${personalLink}</code>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: "📤 Do'stlarga ulashish", url: shareUrl }]]
        },
        link_preview_options: { is_disabled: true }
      }, TOKEN);
    } else {
      await api('sendMessage', {
        chat_id: chatId,
        text: '<b>Bu xizmat faqat adminlar uchun faol.</b>',
        parse_mode: 'HTML'
      }, TOKEN);
    }
    return;
  }

  // ===== 6. "🔔 Eslatma" tugmasi =====
  if (text === '🔔 Eslatma') {
    await api('sendMessage', {
      chat_id: chatId,
      text: '<b>🔔 Kunlik test eslatmalari faollashtirildi!</b>',
      parse_mode: 'HTML'
    }, TOKEN);
    return;
  }

  // ===== 7. Noma\'lum matnga fallback (bekor qilingan replylar uchun ham) =====
  if (msg.text) {
    await api('sendMessage', {
      chat_id: chatId,
      text: '🤖 Buyruqni tushunmadim. Iltimos, asosiy menyudan foydalaning.',
      parse_mode: 'HTML',
      reply_markup: getMainMenu(GITHUB_REPO)
    }, TOKEN);
  }
}

// Anonim xabarni qabul qiluvchiga + adminga yuborish, tasdiq berish
async function deliverAnon(msg, targetUserId, senderUserId, ADMIN_ID, TOKEN, GITHUB_REPO) {
  const chatId = msg.chat.id;
  const safeContent = escapeHtml(msg.text || msg.caption || '[Media xabar]');
  const senderName = escapeHtml(sanitizeText(msg.from.first_name));
  const senderUsername = msg.from.username ? `@${escapeHtml(msg.from.username)}` : "Username yo'q";

  // Qabul qiluvchiga: javob qaytarishi uchun Sender_ID ko'milgan (lekin ko'rinmaydi)
  const anonCaption = `📩 <b>Sizga yangi anonim xabar keldi:</b>\n\n<i>"${safeContent}"</i>\n\n<i>Javob berish uchun ushbu xabarga Reply qiling. Ref: <code>Sender_ID:${senderUserId}</code></i>`;
  const sendResult = await forwardMediaOrText(targetUserId, msg, anonCaption, TOKEN);

  if (!sendResult.ok) {
    await api('sendMessage', {
      chat_id: chatId,
      text: "<b>❌ Xabar yetkazilmadi. Qabul qiluvchi botni bloklagan bo'lishi mumkin.</b>",
      parse_mode: 'HTML'
    }, TOKEN);
    return;
  }

  // Adminga monitoring
  const adminCaption = `<b>🕵️ [ANONIM XABAR MONITORINGI]</b>\n\n👤 <b>Kimdan:</b> ${senderName} (${senderUsername})\n🆔 <b>Sender_ID:</b> <code>${senderUserId}</code>\n🎯 <b>Target_ID:</b> <code>${targetUserId}</code>\n\n💬 <b>Xabar:</b>\n<i>"${safeContent}"</i>`;
  await forwardMediaOrText(ADMIN_ID, msg, adminCaption, TOKEN);

  await api('sendMessage', {
    chat_id: chatId,
    text: '<b>✅ Xabaringiz muvaffaqiyatli yetkazildi!</b>',
    parse_mode: 'HTML',
    reply_markup: getMainMenu(GITHUB_REPO)
  }, TOKEN);
}
