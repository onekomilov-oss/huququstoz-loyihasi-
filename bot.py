import os
import time
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from supabase import create_client, Client

# --- SOZLAMALAR ---
BOT_TOKEN = "SIZNING_BOT_TOKENINGIZ"  # @BotFather'dan olingan token
ADMIN_ID = 123456789                  # O'zingizning Telegram ID raqamingiz

# Vercel va Supabase ulanishlari
WEB_APP_URL = "https://huququstoz-loyihasi.vercel.app"  # Vercel havolangiz
SUPABASE_URL = "https://upqwfzcecilwwqjdhkki.supabase.co"
SUPABASE_KEY = "sb_publishable_VwXMlxwStOTTqRauO5kKIg_6FzbVjXJ"

bot = telebot.TeleBot(BOT_TOKEN)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- START KOMANDASI (INLINE TUGMA ULAB CHIQARISH) ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup()
    
    # Inline Web App tugmasi
    web_app_btn = InlineKeyboardButton(
        text="🚀 Huququstoz Akademiyasiga Kirish", 
        web_app=WebAppInfo(url=WEB_APP_URL)
    )
    # Kanalga o'tish tugmasi
    channel_btn = InlineKeyboardButton(
        text="📢 Rasmiy Kanal (@huququstoz)", 
        url="https://t.me/huququstoz"
    )
    
    markup.add(web_app_btn)
    markup.add(channel_btn)

    welcome_text = (
        f"Salom, **{message.from_user.first_name}**!\n\n"
        "⚖️ **Huququstoz Akademiyasi** rasmiy botiga xush kelibsiz.\n"
        "Interaktiv testlarni ishlash, umumiy reytingni ko'rish va guvohnoma olish uchun pastdagi tugmani bosing:"
    )
    
    bot.send_message(message.chat.id, welcome_text, parse_mode="Markdown", reply_markup=markup)

# --- ADMIN OMAVIY XABAR YUBORISH (/send komandasi) ---
@bot.message_handler(commands=['send'])
def broadcast_message(message):
    # Faqat siz (admin) ishlatishingiz uchun tekshiruv
    if message.from_user.id != ADMIN_ID:
        bot.reply_to(message, "⚠️ Siz admin emassiz!")
        return

    # Xabar matnini ajratib olish (/send Xabar matni)
    msg_text = message.text.replace('/send', '').strip()
    if not msg_text:
        bot.reply_to(message, "⚠️ Xabar matnini kiriting!\nMisol: `/send Salom o'quvchilar, yangi testlar qo'shildi!`", parse_mode="Markdown")
        return

    bot.reply_to(message, "⏳ Supabase bazasidagi barcha foydalanuvchilarga xabar yuborilmoqda...")

    try:
        # Supabase'dan barcha foydalanuvchilarning Telegram ID'larini olish
        response = supabase.table('users').select('telegram_id').execute()
        users = response.data

        success_count = 0
        fail_count = 0

        for u in users:
            try:
                bot.send_message(u['telegram_id'], msg_text, parse_mode="Markdown")
                success_count += 1
                time.sleep(0.04)  # Telegram spam chekloviga tushmaslik uchun pauza
            except Exception:
                fail_count += 1

        bot.send_message(
            message.chat.id,
            f"✅ **E'lon yuborish yakunlandi!**\n\n"
            f"📥 Yetib bordi: **{success_count} ta** foydalanuvchiga\n"
            f"🚫 Yetib bormadi (botni bloklaganlar): **{fail_count} ta**",
            parse_mode="Markdown"
        )
    except Exception as e:
        bot.reply_to(message, f"❌ Xatolik yuz berdi: {e}")

# Botni uzluksiz yurgizish
if __name__ == "__main__":
    print("Bot muvaffaqiyatli ishga tushdi...")
    bot.infinity_polling()
