export default async function handler(req, res) {
  // Brauzerdan kirib tekshirganda shu yozuv chiqadi
  if (req.method !== 'POST') {
    return res.status(200).send('Huququstoz Boti Faol!');
  }

  // O'zgaruvchilarni olish (Token Vercel'dan avtomatik olinadi)
  const TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = "-1002606641183";
  const GITHUB_REPO = "onekomilov-oss/huququstoz-loyihasi-";

  if (!TOKEN) {
    return res.status(500).send('Token topilmadi');
  }

  const update = req.body;

  // Telegram API'ga so'rov yuborish funksiyasi
  async function api(method, params) {
    const url = `https://api.telegram.org/bot${TOKEN}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await response.json();
  }

  // Obunani tekshirish funksiyasi
  async function isSubscribed(userId) {
    try {
      const res = await api('getChatMember', { chat_id: CHANNEL_ID, user_id: userId });
      if (res.ok && res.result && ['creator', 'administrator', 'member'].includes(res.result.status)) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Asosiy menyu (Mini App va Eslatma)
  function getMainMenu() {
    const repoParts = GITHUB_REPO.split('/');
    const webAppUrl = `https://${repoParts[0]}.github.io/${repoParts[1]}/`;
    return {
      keyboard: [
        [{ text: "🎓 Akademiyani ochish", web_app: { url: webAppUrl } }],
        [{ text: "🔔 Kunlik eslatma" }]
      ],
      resize_keyboard: true
    };
  }

  // Majburiy obuna (SubGate) oynasi
  async function sendSubGate(chatId) {
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
    });
  }

  try {
    // Matnli xabarlar kelganda
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text || '';

      const subbed = await isSubscribed(userId);
      if (!subbed) {
        await sendSubGate(chatId);
        return res.status(200).send('OK');
      }

      if (text === '/start') {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>Xush kelibsiz!</b> Huququstoz akademiyasida test yechish uchun pastdagi tugmani bosing.",
          parse_mode: "HTML",
          reply_markup: getMainMenu()
        });
        return res.status(200).send('OK');
      }

      if (text === "🔔 Kunlik eslatma") {
        await api('sendMessage', {
          chat_id: chatId,
          text: "<b>🔔 Kunlik test va streak eslatmalari faollashtirildi!</b>",
          parse_mode: "HTML"
        });
        return res.status(200).send('OK');
      }
    }

    // Callback tugmalar (A'zolikni tekshirish tugmasi bosilganda)
    if (update.callback_query) {
      const cb = update.callback_query;
      const userId = cb.from.id;

      if (cb.data === "check_sub") {
        const subbed = await isSubscribed(userId);
        if (subbed) {
          await api('answerCallbackQuery', { callback_query_id: cb.id, text: "A'zolik tasdiqlandi!" });
          await api('sendMessage', {
            chat_id: cb.message.chat.id,
            text: "<b>Xush kelibsiz!</b> Akademiyani ochish uchun quyidagi tugmani bosing.",
            parse_mode: "HTML",
            reply_markup: getMainMenu()
          });
        } else {
          await api('answerCallbackQuery', { callback_query_id: cb.id, text: "Hali kanalga a'zo bo'lmadingiz!", show_alert: true });
        }
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    return res.status(200).send('OK');
  }
}
