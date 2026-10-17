# Huququstoz — Gamifikatsiyalangan Raqamli Akademiya

Ushbu loyiha To'liq GitHub infratuzilmasida (GitHub Pages + GitHub Actions) ishlaydigan Telegram Mini App va Bot tizimidir.

## SOZLASH YO'RIQNOMASI

### 1. GitHub Repository va Pages
1. Repozitoriya nomi: `huququstoz-loyihasi-` (PUBLIC bo'lishi kerak).
2. **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main`, folder: `/(root)`
   - Save tugmasini bosing.

### 2. Actions Ruxsatlari
1. **Settings → Actions → General**:
   - Workflow permissions: **Read and write permissions** ni tanlang va saqlang.

### 3. GitHub Secrets
1. **Settings → Secrets and variables → Actions**:
   - `BOT_TOKEN`: BotFather bergan bot tokenini kiriting.

### 4. BotFather va Telegram Sozlamalari
1. BotFather'ga kiring, botingizni tanlang.
2. `/setmenubutton` buyrug'i orqali menyu tugmasini bosing, Web App havolasiga: `https://onekomilov-oss.github.io/huququstoz-loyihasi-/` kiritasiz.
3. Botni `@huququstoz` kanaliga **ADMINISTRATOR** qilib qo'shing.

### 5. Ishga tushirish
1. **Actions** bo'limiga o'ting, "Huququstoz Telegram Bot Runner" workflow'ini tanlang va **Run workflow** tugmasini bosing.
