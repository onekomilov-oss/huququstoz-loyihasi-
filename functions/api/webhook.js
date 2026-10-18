async function api(method, params, token) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function isSubscribed(userId, channelId, token) {
  try {
    const res = await api('getChatMember', { chat_id: channelId, user_id: userId }, token);
    if (res.ok && ['creator', 'administrator', 'member'].includes(res.result.status)) {
      return true;
    }
  } catch (e) {}
  return false;
}

async function sendSubGate(chatId, token) {
  await api('sendMessage', {
    chat_id: chatId,
    text: "<b>Avval rasmiy kanalimizga a'zo bo'ling:</b>",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📢 Kanalga a'zo bo'lish", url: "https://t.me/huququstoz" }],
        [{ text: "✅ Tekshirish", callback_data: "check_sub" }]
      ]
    }
  }, token);
}

function getMainMenu(githubRepo) {
  const repoParts = (githubRepo || "onekomilov-oss/huququstoz-loyihasi-").split('/');
  const webAppUrl = `https://${repoParts[0]}.github.io/${repoParts[1]}/`;
  return {
    keyboard: [
      [{ text: "🎓 Akademiyani ochish", web_app: { url: webAppUrl } }],
      [{ text: "🔔 Kunlik eslatma" }]
    ],
    resize_keyboard: true
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('HuquqUstoz Bot Active', { status: 200 });
    }

    const TOKEN = env.BOT_TOKEN;
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

        const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
        if (!subbed) {
          await sendSubGate(chatId, TOKEN);
          return new Response('OK');
        }

        if (text === '/start') {
          await api('sendMessage', {
            chat_id: chatId,
            text: "<b>Xush kelibsiz!</b> Huququstoz akademiyasida test yechish uchun pastdagi tugmani bosing.",
            parse_mode: "HTML",
            reply_markup: getMainMenu(GITHUB_REPO)
          }, TOKEN);
          return new Response('OK');
        }

        if (text === "🔔 Kunlik eslatma") {
          await api('sendMessage', {
            chat_id: chatId,
            text: "<b>🔔 Kunlik test va streak eslatmalari faollashtirildi!</b>",
            parse_mode: "HTML"
          }, TOKEN);
          return new Response('OK');
        }
      }

      if (update.callback_query) {
        const cb = update.callback_query;
        const userId = cb.from.id;

        if (cb.data === "check_sub") {
          const subbed = await isSubscribed(userId, CHANNEL_ID, TOKEN);
          if (subbed) {
            await api('answerCallbackQuery', { callback_query_id: cb.id, text: "A'zolik tasdiqlandi!" }, TOKEN);
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
      return new Response('OK', { status: 200 });
    }
  }
};
