// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// Supabase bazasi bilan to'liq ulangan & Debugging
// ==========================================

const tg = window.Telegram.WebApp;
try { tg.expand(); } catch (e) {}

let allTests = [];           
let currentTopicTests = [];  
let currentTestIndex = 0;    
let userScore = 0;           
let isAnswered = false;      
let currentCategory = null;  
let mixedTimer = null;       
let timeLeft = 0;            

const ADMIN_PASSWORD = "z123z1"; 

// Supabase obyektini xavfsiz olish funksiyasi (To'g'rilangan)
function getSupabaseClient() {
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function' && window.SUPABASE_URL && window.SUPABASE_KEY) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    return window.supabaseClient;
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    const userNameEl = document.getElementById('user-name');
    const certNameEl = document.getElementById('cert-user-name');
    if (userNameEl) userNameEl.textContent = fullName;
    if (certNameEl) certNameEl.textContent = fullName;

    // Foydalanuvchini bazaga sinxronlash
    syncUserToSupabase(tgUser);
  }

  const certDateEl = document.getElementById('cert-date');
  if (certDateEl) {
    const today = new Date();
    certDateEl.textContent = today.toLocaleDateString();
  }

  fetchLaws();
  loadTestsData();
  setupTabs();
  updateStreak();
  updateUserStatsUI();

  // 1. Shaxsiy statistika
  const btnMyStats = document.getElementById('btn-my-stats');
  if (btnMyStats) btnMyStats.addEventListener('click', showMyStatsModal);

  // 2. Umumiy reyting
  const btnGlobalRating = document.getElementById('btn-global-rating');
  if (btnGlobalRating) btnGlobalRating.addEventListener('click', showGlobalRatingModal);

  // 3. Eslatma tugmasi
  const btnDailyReminder = document.getElementById('btn-daily-reminder');
  if (btnDailyReminder) {
    btnDailyReminder.addEventListener('click', () => {
      if (tg.showPopup) {
        tg.showPopup({
          title: "Kunlik Eslatma 🔔",
          message: "Har kuni huquqiy testlarni ishlab, streakingizni saqlab qoling va imtihonlarga tayyorgarlikni kuchaytiring!",
          buttons: [{type: "ok", text: "Tushunarli 👍"}]
        });
      } else {
        alert("Har kuni huquqiy testlarni ishlab, streakingizni saqlab qoling!");
      }
    });
  }

  // 4. Admin Panel
  const btnAdminStats = document.getElementById('btn-admin-stats');
  if (btnAdminStats) {
    btnAdminStats.addEventListener('click', () => {
      let pass = prompt("Admin parolini kiriting:");
      if (pass === ADMIN_PASSWORD) {
        showAdminPanelModal();
      } else if (pass !== null) {
        alert("Noto'g'ri parol!");
      }
    });
  }

  const btnBackTopics = document.getElementById('btn-back-topics');
  if (btnBackTopics) btnBackTopics.addEventListener('click', showTopicsView);

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) btnNext.addEventListener('click', nextQuestion);

  if (tg.BackButton) {
    tg.BackButton.onClick(() => {
      const quizView = document.getElementById('quiz-view');
      if (quizView && !quizView.classList.contains('hidden')) {
        showTopicsView();
      } else {
        tg.close();
      }
    });
  }
});

// --- SUPABASE BILAN SINXRONLASH ---
async function syncUserToSupabase(tgUser) {
  const client = getSupabaseClient();
  if (!tgUser || !client) {
    console.warn("Supabase ulanishi topilmadi yoki Telegram user mavjud emas");
    return;
  }
  
  let stats = getUserStats();

  try {
    const payload = {
      telegram_id: tgUser.id,
      full_name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
      username: tgUser.username || '',
      total_correct: stats.totalCorrect,
      total_answered: stats.totalAnswered,
      completed_quizzes: stats.completedQuizzes,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('users').upsert(payload);
    if (error) {
      console.error("Supabase upsert xatosi:", error);
    }
  } catch (err) {
    console.error("Supabase error:", err);
  }
}

function getUserStats() {
  return JSON.parse(localStorage.getItem('huquqUstozStats')) || {
    totalAnswered: 0,
    totalCorrect: 0,
    completedQuizzes: 0
  };
}

function recordAnswerStats(isCorrect) {
  let stats = getUserStats();
  stats.totalAnswered += 1;
  if (isCorrect) stats.totalCorrect += 1;
  localStorage.setItem('huquqUstozStats', JSON.stringify(stats));
  updateUserStatsUI();

  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    syncUserToSupabase(tgUser);
  }
}

function updateUserStatsUI() {
  const stats = getUserStats();
  const statCorrectEl = document.getElementById('stat-correct');
  const certCorrectEl = document.getElementById('cert-correct');

  if (statCorrectEl) statCorrectEl.textContent = stats.totalCorrect;
  if (certCorrectEl) certCorrectEl.textContent = stats.totalCorrect;
}

// 1. Shaxsiy statistika modali
function showMyStatsModal() {
  const topicsListContainer = document.getElementById('topics-list');
  const tabTestsBtn = document.querySelector('.nav-item[data-tab="tab-tests"]');
  if (tabTestsBtn) tabTestsBtn.click();

  const stats = getUserStats();
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

  if (topicsListContainer) {
    topicsListContainer.innerHTML = `
      <div class="glass-card" style="padding: 24px; border-radius: 20px; background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 32px;">📊</span>
          <h3 style="margin-top: 8px; font-family: 'Cinzel', serif; color: var(--text-main); font-size: 20px;">Shaxsiy Statistika</h3>
          <p style="color: var(--text-sub); font-size: 13px; margin-top: 4px;">Sizning shaxsiy ko'rsatkichlaringiz tahlili</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div class="glass-card" style="padding: 16px; text-align: center; border-radius: 14px; background: rgba(255,255,255,0.05);">
            <div style="font-size: 24px; font-weight: 800; color: var(--accent);">${stats.totalCorrect}</div>
            <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">To'g'ri Javoblar</div>
          </div>
          <div class="glass-card" style="padding: 16px; text-align: center; border-radius: 14px; background: rgba(255,255,255,0.05);">
            <div style="font-size: 24px; font-weight: 800; color: #28a745;">${accuracy}%</div>
            <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">Aniqlik Darajasi</div>
          </div>
        </div>
        <button id="btn-back-to-topics" class="btn btn-secondary" style="width: 100%; padding: 14px; cursor: pointer; background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 600;">← Mavzularga qaytish</button>
      </div>
    `;
    document.getElementById('btn-back-to-topics').addEventListener('click', renderTopicsList);
  }
}

// 2. UMUMIY REYTING MODALI
async function showGlobalRatingModal() {
  const topicsListContainer = document.getElementById('topics-list');
  const tabTestsBtn = document.querySelector('.nav-item[data-tab="tab-tests"]');
  if (tabTestsBtn) tabTestsBtn.click();

  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-sub);">Reyting yuklanmoqda... ⏳</div>';

  const client = getSupabaseClient();
  let htmlList = '';

  if (!client) {
    htmlList = '<p style="text-align: center; color: #ff6b6b; padding: 20px;">Supabase ulanishida xatolik! `config.js` tekshiring.</p>';
  } else {
    try {
      const { data: users, error } = await client
        .from('users')
