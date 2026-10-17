// HuquqUstoz Telegram Bot - Enterprise Edition

// Maxfiy belgilarni escape qilish (Telegram HTML Parse Mode uchun)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeText(str) {
  if (!str) return 'Noma\'lum';
  return str.replace(/[\r\n\t]/g, ' ').trim().substring(0, 30);
}

// Telegram API so'rov yuborish
async function api(method, params, token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API Xatosi [${method}]:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Bot o'z username'ini dinamik olish
async function getBotUsername(token) {
  const me = await api('getMe', {}, token);
  if (me.ok && me.result && me.result.username) {
    return me.result.username;
  }
  return "huquqmindBot";
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

// Kanalga a'zo bo'lish darvozasi (SubGate)
async function sendSubGate(chatId, token) {
  await api('sendMessage', {
    chat_id: chatId,
    text: "⚠️ <b>Botdan foydalanish uchun rasmiy kanalimizga a'zo bo'ling:</b>",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Kanalga a'zo bo'lish", url: "https://t.me/huququstoz" }],
        [{ text: "✅ A'zolikni tekshirish", callback_data: "check_sub" }]
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

// Xabarni turiga qarab uzatish (Matn, Rasm, Voice va h.k.)
async function forwardMediaOrText(targetChatId, msg, captionText, token) {
  if (msg.text) {
    return await api('sendMessage', {
      chat_id: targetChatId,
      text: captionText,
      parse_mode: "HTML"
    }, token);
  } else if (msg.photo) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    return await api('sendPhoto', {
      chat_id: targetChatId,
      photo: fileId,
      caption: captionText,
      parse_mode: "HTML"
    }, token);
  } else if (msg.voice) {
    return await api('sendVoice', {
      chat_id: targetChatId,
      voice: msg.voice.file_id,
      caption: captionText,
      parse_mode: "HTML"
    }, token);
  } else if (msg.document) {
    return await api('sendDocument', {
      chat_id: targetChatId,
      document: msg.document.file_id,
      caption: captionText,
      parse_mode: "HTML"
    }, token);
  } else if (msg.sticker) {
    await api('sendMessage', { chat_id: targetChatId, text: captionText, parse_mode: "HTML" }, token);
    return await api('sendSticker', { chat_id: targetChatId, sticker: msg.sticker.file_id }, token);
  }
  return { ok: false };
}

// Cloudflare / Serverless Webhook Handler
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('HuquqUstoz Bot Server Active', { status: 200 });
    }

    const TOKEN = env.BOT_TOKEN;
    const ADMIN_ID = parseInt(env.ADMIN_ID || "6345301727", 10);
    const CHANNEL_ID = env.CHANNEL_ID || "-1002606641183";
    const GITHUB_REPO = env.GITHUB_REPOSITORY || "onekomilov-oss/huququstoz-loyihasi-";

    if (!TOKEN) {
      return new Response('BOT_TOKEN missing in environment variables', { status: 500 });
    }

    try {
      const update = await request.json();

      if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text || '';

        // 1. Kanal Obunasini Tekshirish (Majburiy)
        const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
        if (!subbed) {
          await sendSubGate(chatId, TOKEN);
          return new Response('OK');
        }

        const botUsername = await getBotUsername(TOKEN);

        // 2. Shaxsiy anonim link orqali kirganda (/start ask_ID)
        if (text.startsWith('/start ask_')) {
          const targetUserId = text.replace('/start ask_', '').trim();

          if (parseInt(targetUserId, 10) === userId) {
            await api('sendMessage', {
              chat_id: chatId,
              text: "<b>Bu sizning shaxsiy havolangiz. Uni do'stlaringiz va obunachilaringizga ulashing!</b>",
              parse_mode: "HTML",
              reply_markup: getMainMenu(GITHUB_REPO)
            }, TOKEN);
            return new Response('OK');
          }

          await api('sendMessage', {
            chat_id: chatId,
            text: `<b>💬 Anonim Xabar Yuborish</b>\n\nSavol, fikr yoki taklifingizni yuboring (Matn, rasm yoki ovozli xabar).\n\n<i>[ Target_ID: <code>${targetUserId}</code> ] — Ushbu xabarga 'Reply' qilib yozing!</i>`,
            parse_mode: "HTML",
            reply_markup: { force_reply: true }
          }, TOKEN);
          return new Response('OK');
        }

        // 3. Anonim xabarga reply qilib javob yuborilganda
        if (msg.reply_to_message) {
          const replyText = msg.reply_to_message.text || msg.reply_to_message.caption || '';

          // A) Foydalanuvchi anonim savol yubormoqda
          if (replyText.includes("Anonim Xabar Yuborish") && replyText.includes("Target_ID:")) {
            const matchTarget = replyText.match(/Target_ID:\s*(\d+)/);
            const targetUserId = matchTarget ? matchTarget[1] : ADMIN_ID;

            const safeContent = escapeHtml(text || msg.caption || "[Media Xabar]");
            const senderName = escapeHtml(sanitizeText(msg.from.first_name));
            const senderUsername = msg.from.username ? `@${msg.from.username}` : "Username yo'q";

            // HAVOLA EGASIGA BORADIGAN ANONIM XABAR
            const anonCaption = `<b>📩 Sizga yangi anonim xabar keldi:</b>\n\n<i>"${safeContent}"</i>`;
            const sendResult = await forwardMediaOrText(targetUserId, msg, anonCaption, TOKEN);

            if (!sendResult.ok) {
              await api('sendMessage', {
                chat_id: chatId,
                text: "<b>❌ Xabar yetkazilmadi. Qabul qiluvchi botni bloklagan bo'lishi mumkin.</b>",
                parse_mode: "HTML"
              }, TOKEN);
              return new Response('OK');
            }

            // ADMINGA BORADIGAN MONITORING
            if (ADMIN_ID) {
              const adminCaption = `<b>🕵️ [ANONIM XABAR MONITORINGI]</b>\n\n👤 <b>Kimdan:</b> ${senderName} (${senderUsername})\n🆔 <b>Sender_ID:</b> <code>${userId}</code>\n🎯 <b>Target_ID:</b> <code>${targetUserId}</code>\n\n💬 <b>Xabar:</b>\n<i>"${safeContent}"</i>`;
              await forwardMediaOrText(ADMIN_ID, msg, adminCaption, TOKEN);
            }

            // YUBORGAN SHAXSGA TASDIQ
            await api('sendMessage', {
              chat_id: chatId,
              text: "<b>✅ Xabaringiz muvaffaqiyatli yetkazildi!</b>",
              parse_mode: "HTML",
              reply_markup: getMainMenu(GITHUB_REPO)
            }, TOKEN);
            return new Response('OK');
          }

          // B) Admin javob yozayotganda
          if (userId === ADMIN_ID && (replyText.includes("Sender_ID:") || replyText.includes("Target_ID:"))) {
            const matchUser = replyText.match(/Sender_ID:\s*(\d+)/) || replyText.match(/Target_ID:\s*(\d+)/);

            if (matchUser) {
              const targetUserId = matchUser[1];
              const safeReplyText = escapeHtml(text || msg.caption || "[Media Javob]");
              const replyCaption = `<b>💬 Anonim xabaringizga javob keldi:</b>\n\n<i>"${safeReplyText}"</i>`;

              const replyRes = await forwardMediaOrText(targetUserId, msg, replyCaption, TOKEN);

              if (replyRes.ok) {
                await api('sendMessage', {
                  chat_id: ADMIN_ID,
                  text: "<b>✅ Javobingiz foydalanuvchiga yetkazildi!</b>",
                  parse_mode: "HTML"
                }, TOKEN);
              } else {
                await api('sendMessage', {
                  chat_id: ADMIN_ID,
                  text: "<b>❌ Javob yetkazilmadi. Foydalanuvchi botni bloklagan bo'lishi mumkin.</b>",
                  parse_mode: "HTML"
                }, TOKEN);
              }
              return new Response('OK');
            }
          }
        }

        // 4. Standard Buyruqlar (/start)
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
              text: "<b>Xush kelibsiz!</b> Huququstoz akademiyasidan foydalanish uchun pastdagi tugmani bosing.",
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

        // 5. "💬 Anonim savol" tugmasi
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
              text: "<b>Bu xizmat faqat adminlar uchun faol.</b>",
              parse_mode: "HTML"
            }, TOKEN);
          }
          return new Response('OK');
        }

        // 6. "🔔 Eslatma" tugmasi
        if (text === "🔔 Eslatma") {
          await api('sendMessage', {
            chat_id: chatId,
            text: "<b>🔔 Kunlik test eslatmalari faollashtirildi!</b>",
            parse_mode: "HTML"
          }, TOKEN);
          return new Response('OK');
        }
      }

      // Inline Callback Tugmalar
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
      }

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Webhook ishlov berishda xato:', err);
      return new Response('OK', { status: 200 }); // Telegram qayta-qayta takrorlamasligi uchun 200 qaytariladi
    }
  }
};
