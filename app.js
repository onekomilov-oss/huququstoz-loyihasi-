// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// Supabase bazasi bilan to'liq ulangan
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

let allTests = [];           
let currentTopicTests = [];  
let currentTestIndex = 0;    
let userScore = 0;           
let isAnswered = false;      
let currentCategory = null;  
let mixedTimer = null;       
let timeLeft = 0;            

const ADMIN_PASSWORD = "777"; 

document.addEventListener('DOMContentLoaded', () => {
  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    const userNameEl = document.getElementById('user-name');
    const certNameEl = document.getElementById('cert-user-name');
    if (userNameEl) userNameEl.textContent = fullName;
    if (certNameEl) certNameEl.textContent = fullName;

    // Foydalanuvchini bazaga ro'yxatdan o'tkazish
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

  // 2. Umumiy reyting (Supabase'dan olinadi)
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

  // 4. Admin Panel (Supabase statistikasi bilan)
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
  if (!tgUser || typeof supabase === 'undefined') return;
  let stats = getUserStats();

  try {
    await supabase.from('users').upsert({
      telegram_id: tgUser.id,
      full_name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
      username: tgUser.username || '',
      total_correct: stats.totalCorrect,
      total_answered: stats.totalAnswered,
      completed_quizzes: stats.completedQuizzes,
      updated_at: new Date()
    });
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
  if (tgUser) syncUserToSupabase(tgUser);
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

// 2. UMUMIY REYTING MODALI (Supabase'dan real-time yuklanadi)
async function showGlobalRatingModal() {
  const topicsListContainer = document.getElementById('topics-list');
  const tabTestsBtn = document.querySelector('.nav-item[data-tab="tab-tests"]');
  if (tabTestsBtn) tabTestsBtn.click();

  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-sub);">Reyting yuklanmoqda... ⏳</div>';

  let htmlList = '';
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('total_correct', { ascending: false })
      .limit(30);

    if (error || !users || users.length === 0) {
      htmlList = '<p style="text-align: center; color: var(--text-sub); padding: 20px;">Hozircha reytingda o\'quvchilar yo\'q.</p>';
    } else {
      users.forEach((u, index) => {
        let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        htmlList += `
          <div class="glass-card" style="padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px; background: rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 18px; font-weight: 800; width: 24px; text-align: center;">${medal}</span>
              <div>
                <strong style="font-size: 14px; color: var(--text-main); display: block;">${u.full_name || 'O\'quvchi'}</strong>
                <small style="color: var(--text-sub); font-size: 11px;">${u.username ? '@' + u.username : 'ID: ' + u.telegram_id}</small>
              </div>
            </div>
            <div style="text-align: right;">
              <strong style="color: var(--accent); font-size: 15px;">${u.total_correct} ball</strong>
            </div>
          </div>
        `;
      });
    }
  } catch (err) {
    htmlList = '<p style="text-align: center; color: var(--text-sub); padding: 20px;">Reytingni yuklashda xatolik yuz berdi.</p>';
  }

  topicsListContainer.innerHTML = `
    <div class="glass-card" style="padding: 20px; border-radius: 20px; background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08);">
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="font-size: 32px;">🏆</span>
        <h3 style="margin-top: 8px; font-family: 'Cinzel', serif; color: var(--text-main); font-size: 20px;">Umumiy Reyting</h3>
        <p style="color: var(--text-sub); font-size: 13px; margin-top: 4px;">Akademiyaning eng ilg'or o'quvchilari</p>
      </div>
      <div style="max-height: 350px; overflow-y: auto; margin-bottom: 16px;">
        ${htmlList}
      </div>
      <button id="btn-back-to-topics" class="btn btn-secondary" style="width: 100%; padding: 14px; cursor: pointer; background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 600;">← Mavzularga qaytish</button>
    </div>
  `;
  document.getElementById('btn-back-to-topics').addEventListener('click', renderTopicsList);
}

// 3. ADMIN PANEL MODALI (Supabase'dan haqiqiy statistika olinadi)
async function showAdminPanelModal() {
  const topicsListContainer = document.getElementById('topics-list');
  const tabTestsBtn = document.querySelector('.nav-item[data-tab="tab-tests"]');
  if (tabTestsBtn) tabTestsBtn.click();

  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-sub);">Admin Ma\'lumotlari yuklanmoqda... ⏳</div>';

  let totalUsers = 0;
  let totalCorrectAnswers = 0;

  try {
    const { data: users, count, error } = await supabase.from('users').select('*', { count: 'exact' });
    if (users) {
      totalUsers = count || users.length;
      totalCorrectAnswers = users.reduce((acc, u) => acc + (u.total_correct || 0), 0);
    }
  } catch (err) {}

  topicsListContainer.innerHTML = `
    <div class="glass-card" style="padding: 24px; border-radius: 20px; background: rgba(220, 53, 69, 0.05); border: 1px solid rgba(220, 53, 69, 0.3);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 32px;">🛡️</span>
        <h3 style="margin-top: 8px; font-family: 'Cinzel', serif; color: #ff6b6b; font-size: 20px;">Admin Panel</h3>
        <p style="color: var(--text-sub); font-size: 13px; margin-top: 4px;">Real-time Supabase Bazasi Statistikalari</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div class="glass-card" style="padding: 16px; text-align: center; border-radius: 14px; background: rgba(255,255,255,0.05);">
          <div style="font-size: 24px; font-weight: 800; color: #ff6b6b;">${totalUsers} ta</div>
          <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">Jami O'quvchilar</div>
        </div>
        <div class="glass-card" style="padding: 16px; text-align: center; border-radius: 14px; background: rgba(255,255,255,0.05);">
          <div style="font-size: 24px; font-weight: 800; color: var(--accent);">${totalCorrectAnswers}</div>
          <div style="font-size: 12px; color: var(--text-sub); margin-top: 4px;">Jami To'g'ri Javob</div>
        </div>
      </div>

      <button id="btn-create-announcement" class="btn btn-primary" style="width: 100%; padding: 14px; margin-bottom: 12px; border-radius: 12px; font-weight: 700; background: linear-gradient(135deg, #ff9900, #ff5500);">
        📢 E'lon Yuborish / Ulashish
      </button>

      <div class="glass-card" style="padding: 16px; border-radius: 14px; margin-bottom: 20px; background: rgba(255,255,255,0.05);">
        <div style="font-size: 13px; color: var(--text-main); margin-bottom: 6px;">🟢 Bazadagi jami testlar: <strong>${allTests.length} ta</strong></div>
        <div style="font-size: 13px; color: var(--text-main);">📌 Muallif brendi: <strong>@huququstoz</strong></div>
      </div>

      <button id="btn-back-to-topics" class="btn btn-secondary" style="width: 100%; padding: 14px; cursor: pointer; background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; font-weight: 600;">← Mavzularga qaytish</button>
    </div>
  `;

  document.getElementById('btn-create-announcement').addEventListener('click', () => {
    let msg = prompt("E'lon matnini kiriting:", "📢 @huququstoz Akademiyasida yangi testlar va imtihon materiallari joylandi! Hoziroq bilimlaringizni sinab ko'ring.");
    if (msg) {
      let shareUrl = `https://t.me/share/url?url=https://t.me/huququstoz&text=${encodeURIComponent(msg)}`;
      if (tg.openLink) tg.openLink(shareUrl);
      else window.open(shareUrl, '_blank');
    }
  });

  document.getElementById('btn-back-to-topics').addEventListener('click', renderTopicsList);
}

async function fetchLaws() {
  const container = document.getElementById('laws-list');
  if (!container) return;
  try {
    const response = await fetch('./laws.json');
    if (!response.ok) throw new Error('Fayl topilmadi');
    const lawsData = await response.json();
    container.innerHTML = '';
    lawsData.forEach(law => {
      const link = document.createElement('a');
      link.href = law.url;
      link.className = 'glass-card';
      link.style.cssText = 'text-decoration:none; color:var(--text-main); padding:16px; display:flex; align-items:center; gap:12px; margin-bottom:10px;';
      link.innerHTML = `<span style="font-size: 24px;">📜</span><span><small style="color:var(--text-sub);">Hujjat №${law.n}</small><br><strong>${law.title}</strong></span>`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (tg.openLink) tg.openLink(law.url);
        else window.open(law.url, '_blank');
      });
      container.appendChild(link);
    });
  } catch (error) {
    container.innerHTML = '<div style="padding: 10px; color: var(--text-sub);">Qonunlarni yuklab bo\'lmadi.</div>';
  }
}

async function loadTestsData() {
  try {
    allTests = [];
    const fileNames = [
      'tests/davlat_bayrogisi.json', 'tests/davlat_gerbi.json', 'tests/davlat_madhiyasi.json',
      'tests/siyosiy_partiyalar.json', 'tests/fuqarolik_1-bosqich.json', 'tests/fuqarolik_2-bosqich.json',
      'tests/fuqarolik_3-bosqich.json', 'tests/fuqarolik_4-bosqich.json', 'tests/jinoyat_1-bosqich.
