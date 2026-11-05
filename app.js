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
      'tests/fuqarolik_3-bosqich.json', 'tests/fuqarolik_4-bosqich.json', 'tests/jinoyat_1-bosqich.json',
      'tests/jinoyat_2-bosqich.json', 'tests/jinoyat_3-bosqich.json', 'tests/jinoyat_4-bosqich.json',
      'tests/jinoyat_5-bosqich.json', 'tests/jinoyat_6-bosqich.json', 'tests/jinoyat_7-bosqich.json',
      'tests/jinoyat_8-bosqich.json', 'tests/jinoyat_9-bosqich.json', 'tests/jinoyat_10-bosqich.json',
      'tests/konstitutsiya_1-bosqich.json', 'tests/konstitutsiya_2-bosqich.json', 'tests/konstitutsiya_3-bosqich.json',
      'tests/konstitutsiya_4-bosqich.json', 'tests/konstitutsiya_5-bosqich.json', 'tests/mehnat_1-bosqich.json',
      'tests/mehnat_2-bosqich.json', 'tests/mehnat_3-bosqich.json', 'tests/mehnat_4-bosqich.json',
      'tests/mehnat_5-bosqich.json', 'tests/mehnat_6-bosqich.json', 'tests/mehnat_7-bosqich.json',
      'tests/mehnat_8-bosqich.json', 'tests/mehnat_9-bosqich.json', 'tests/mehnat_10-bosqich.json',
      'tests/oila_1-bosqich.json', 'tests/oila_2-bosqich.json', 'tests/oila_3-bosqich.json',
      'tests/oila_4-bosqich.json', 'tests/oila_5-bosqich.json', 'tests/oila_6-bosqich.json',
      'tests/oila_7-bosqich.json', 'tests/oila_8-bosqich.json'
    ];
    for (const filePath of fileNames) {
      try {
        const response = await fetch(`./${filePath}`);
        if (response.ok) {
          const fileData = await response.json();
          if (Array.isArray(fileData)) allTests = allTests.concat(fileData);
        }
      } catch (err) {}
    }
    if (allTests.length === 0) {
      const response = await fetch('./namuna.json');
      if (response.ok) allTests = await response.json();
    }
    renderTopicsList();
  } catch (error) {}
}

function renderTopicsList() {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;
  topicsListContainer.innerHTML = '';

  if (currentCategory) {
    renderSubTopicsList(currentCategory);
    return;
  }

  const mixedCard = document.createElement('div');
  mixedCard.className = 'glass-card';
  mixedCard.style.cssText = 'padding: 20px; margin-bottom: 18px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 16px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 255, 255, 0.03)); border: 1.5px solid var(--accent);';
  mixedCard.innerHTML = `
    <div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 20px;">⚡</span>
        <strong style="font-size: 17px; color: var(--accent); font-family: 'Cinzel', serif;">Aralash Imtihon Rejimi</strong>
      </div>
      <div style="font-size: 13px; color: var(--text-sub);">Barcha bazadan savollar to'plami | Savol va vaqtni o'zingiz tanlang</div>
    </div>
    <span style="font-size: 20px; color: var(--accent);">➔</span>
  `;
  mixedCard.addEventListener('click', showMixedQuizSetup);
  topicsListContainer.appendChild(mixedCard);

  const categoriesMap = {};
  allTests.forEach(test => {
    let rawTopic = test.topic || "Umumiy huquqiy testlar";
    let categoryName = rawTopic.split(':')[0].trim();
    if (!categoriesMap[categoryName]) categoriesMap[categoryName] = [];
    categoriesMap[categoryName].push(test);
  });

  Object.keys(categoriesMap).forEach(catName => {
    const testsInCat = categoriesMap[catName];
    const subTopicsSet = new Set();
    testsInCat.forEach(t => subTopicsSet.add(t.topic));

    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cssText = 'padding: 18px; margin-bottom: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 14px;';
    card.innerHTML = `
      <div>
        <strong style="font-size: 17px; color: var(--text-main); display: block;">⚖️ ${catName}</strong>
        <div style="font-size: 13px; color: var(--text-sub); margin-top: 4px;">Bo'limlar: ${subTopicsSet.size} ta | Jami savollar: ${testsInCat.length} ta</div>
      </div>
      <span style="font-size: 18px; color: var(--accent);">▶</span>
    `;
    card.addEventListener('click', () => {
      currentCategory = catName;
      renderTopicsList();
    });
    topicsListContainer.appendChild(card);
  });
}

function showMixedQuizSetup() {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = `
    <div class="glass-card" style="padding: 24px; border-radius: 20px; background: rgba(255, 255, 255, 0.04);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 32px;">⚡</span>
        <h3 style="margin-top: 8px; font-family: 'Cinzel', serif; color: var(--text-main); font-size: 20px;">Imtihonni Sozlash</h3>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-sub); margin-bottom: 8px;">Savollar miqdori</label>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;" id="count-selector">
          <button type="button" class="count-btn glass-card" data-val="15" style="padding: 12px; text-align: center; border-radius: 10px; color: var(--text-main); background: rgba(255,255,255,0.05); font-weight: 700;">15 ta</button>
          <button type="button" class="count-btn glass-card active-count" data-val="30" style="padding: 12px; text-align: center; border-radius: 10px; color: var(--accent); border: 1px solid var(--accent); background: rgba(212,175,55,0.15); font-weight: 700;">30 ta</button>
          <button type="button" class="count-btn glass-card" data-val="45" style="padding: 12px; text-align: center; border-radius: 10px; color: var(--text-main); background: rgba(255,255,255,0.05); font-weight: 700;">45 ta</button>
        </div>
        <input type="hidden" id="selected-count" value="30">
      </div>
      <div style="margin-bottom: 24px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-sub); margin-bottom: 8px;">Ajratilgan vaqt (minut)</label>
        <input type="number" id="mixed-minutes" value="30" min="1" max="180" class="glass-card" style="width: 100%; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.06); color: var(--text-main); font-size: 16px; font-weight: 600; outline: none;">
      </div>
      <button id="btn-start-mixed" class="btn btn-primary btn-lg" style="width: 100%; padding: 16px; margin-bottom: 10px; font-weight: 700;">Testni Boshlash 🚀</button>
      <button id="btn-back-from-mixed" class="btn btn-secondary" style="width: 100%; padding: 14px; background: rgba(255,255,255,0.05); color: var(--text-main); border-radius: 12px; font-weight: 600;">← Ortga qaytish</button>
    </div>
  `;

  const countBtns = document.querySelectorAll('.count-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      countBtns.forEach(b => {
        b.style.borderColor = 'rgba(255,255,255,0.1)';
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = 'var(--text-main)';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'rgba(212,175,55,0.15)';
      btn.style.color = 'var(--accent)';
      document.getElementById('selected-count').value = btn.getAttribute('data-val');
    });
  });

  document.getElementById('btn-start-mixed').addEventListener('click', () => {
    const count = parseInt(document.getElementById('selected-count').value);
    const minutes = parseInt(document.getElementById('mixed-minutes').value) || 30;
    startMixedQuizProcess(count, minutes);
  });

  document.getElementById('btn-back-from-mixed').addEventListener('click', renderTopicsList);
}

function startMixedQuizProcess(count, minutes) {
  if (!allTests || allTests.length === 0) {
    alert("Hozircha testlar yuklanmagan!");
    return;
  }
  let shuffled = [...allTests].sort(() => 0.5 - Math.random());
  currentTopicTests = shuffled.slice(0, Math.min(count, shuffled.length));
  currentTestIndex = 0;
  userScore = 0;
  isAnswered = false;
  timeLeft = minutes * 60;

  ensureQuizViewStructure();
  document.getElementById('topic-select-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  if (tg.BackButton) tg.BackButton.show();

  startTimer();
  updateGlobalStats();
  renderQuestion();
}

function startTimer() {
  if (mixedTimer) clearInterval(mixedTimer);
  const progressTopNav = document.querySelector('.quiz-top-nav');
  let timerBadge = document.getElementById('quiz-timer-badge');
  if (!timerBadge) {
    timerBadge = document.createElement('div');
    timerBadge.id = 'quiz-timer-badge';
    timerBadge.className = 'quiz-badge';
    timerBadge.style.cssText = 'background: rgba(220, 53, 69, 0.2); color: #ff6b6b; border: 1px solid #ff6b6b; padding: 4px 10px; border-radius: 8px; font-weight: bold;';
    progressTopNav.appendChild(timerBadge);
  }

  mixedTimer = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(mixedTimer);
      showQuizFinished(true);
      return;
    }
    timeLeft--;
    let min = Math.floor(timeLeft / 60);
    let sec = timeLeft % 60;
    timerBadge.textContent = `⏳ ${min}:${sec < 10 ? '0' : ''}${sec}`;
  }, 1000);
}

function renderSubTopicsList(catName) {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;
  topicsListContainer.innerHTML = '';

  const backCatBtn = document.createElement('button');
  backCatBtn.className = 'btn btn-secondary';
  backCatBtn.style.cssText = 'margin-bottom: 14px; width: 100%; text-align: left; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.08); color: var(--text-main);';
  backCatBtn.textContent = '← Fanlar ro\'yxatiga qaytish';
  backCatBtn.addEventListener('click', () => {
    currentCategory = null;
    renderTopicsList();
  });
  topicsListContainer.appendChild(backCatBtn);

  const subTopicsMap = {};
  allTests.forEach(test => {
    let rawTopic = test.topic || "Umumiy huquqiy testlar";
    let categoryName = rawTopic.split(':')[0].trim();
    if (categoryName === catName) {
      if (!subTopicsMap[rawTopic]) subTopicsMap[rawTopic] = [];
      subTopicsMap[rawTopic].push(test);
    }
  });

  Object.keys(subTopicsMap).forEach(subTopicName => {
    const testsInSub = subTopicsMap[subTopicName];
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cssText = 'padding: 16px; margin-bottom: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 12px;';
    card.innerHTML = `
      <div>
        <strong style="font-size: 15px; color: var(--text-main); display: block;">📌 ${subTopicName}</strong>
        <div style="font-size: 13px; color: var(--text-sub); margin-top: 4px;">Savollar soni: ${testsInSub.length} ta</div>
      </div>
      <span style="font-size: 18px; color: var(--accent);">▶</span>
    `;
    card.addEventListener('click', () => startQuizForTopic(testsInSub));
    topicsListContainer.appendChild(card);
  });
}

function startQuizForTopic(tests) {
  if (mixedTimer) clearInterval(mixedTimer);
  const timerBadge = document.getElementById('quiz-timer-badge');
  if (timerBadge) timerBadge.remove();

  currentTopicTests = tests;
  currentTestIndex = 0;
  userScore = 0;
  isAnswered = false;

  ensureQuizViewStructure();
  document.getElementById('topic-select-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  if (tg.BackButton) tg.BackButton.show();

  updateGlobalStats();
  renderQuestion();
}

function showTopicsView() {
  if (mixedTimer) clearInterval(mixedTimer);
  const timerBadge = document.getElementById('quiz-timer-badge');
  if (timerBadge) timerBadge.remove();

  currentTestIndex = 0;
  userScore = 0;
  isAnswered = false;

  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');
  if (tg.BackButton) tg.BackButton.hide();
  renderTopicsList();
}

function renderQuestion() {
  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished(false);
    return;
  }
  ensureQuizViewStructure();

  const q = currentTopicTests[currentTestIndex];
  isAnswered = false;
  const percent = (currentTestIndex / currentTopicTests.length) * 100;

  document.getElementById('quiz-progress').textContent = `${currentTestIndex + 1} / ${currentTopicTests.length}`;
  document.getElementById('quiz-progress-bar').style.width = `${percent}%`;
  document.getElementById('question-text').textContent = q.q;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  (q.o || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'glass-card option-btn';
    btn.style.cssText = 'width: 100%; text-align: left; padding: 14px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer;';
    btn.textContent = opt;
    btn.addEventListener('click', () => selectAnswer(idx, q.a, q));
    optionsContainer.appendChild(btn);
  });

  document.getElementById('btn-next-question').textContent = (currentTestIndex === currentTopicTests.length - 1) ? 'Yakunlash ✅' : 'Keyingi Savol →';
  document.getElementById('analysis-panel').classList.add('hidden');
}

function selectAnswer(selectedIndex, correctIndex, q) {
  if (isAnswered) return;
  isAnswered = true;

  const isCorrect = (selectedIndex === correctIndex);
  recordAnswerStats(isCorrect);

  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach((btn, idx) => {
    btn.style.pointerEvents = 'none';
    if (idx === correctIndex) {
      btn.style.background = 'rgba(40, 167, 69, 0.3)';
      btn.style.borderColor = '#28a745';
    } else if (idx === selectedIndex) {
      btn.style.background = 'rgba(220, 53, 69, 0.3)';
      btn.style.borderColor = '#dc3545';
    }
  });

  if (isCorrect) {
    userScore++;
    updateGlobalStats();
  }

  const percent = ((currentTestIndex + 1) / currentTopicTests.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = `${percent}%`;

  document.getElementById('analysis-text').textContent = q.why || "To'g'ri javob belgilandi.";
  document.getElementById('analysis-panel').classList.remove('hidden');
}

function nextQuestion() {
  currentTestIndex++;
  renderQuestion();
}

function ensureQuizViewStructure() {
  const quizView = document.getElementById('quiz-view');
  if (!quizView || document.getElementById('question-text')) return;

  quizView.innerHTML = `
    <div id="quiz-finished" class="hidden"></div>
    <div id="quiz-body">
      <div class="quiz-top-nav" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <button id="btn-back-topics" class="btn-back">← Ortga</button>
        <div id="quiz-progress" class="quiz-badge">1 / 30</div>
      </div>
      <div class="progress-track" style="margin-bottom: 14px;">
        <div id="quiz-progress-bar" class="progress-fill"></div>
      </div>
      <div id="question-card" class="glass-card quiz-card">
        <div id="question-text" class="question-text">Savol yuklanmoqda...</div>
        <div id="options-container" class="options-grid"></div>
      </div>
      <div id="analysis-panel" class="glass-card analysis-card hidden" style="margin-top: 14px;">
        <div class="analysis-header">
          <span>📖</span>
          <h3>Huquqiy Tahlil</h3>
        </div>
        <p id="analysis-text" class="analysis-body"></p>
        <button id="btn-next-question" class="btn btn-primary btn-lg" style="width: 100%; margin-top: 12px;">Keyingi Savol →</button>
      </div>
    </div>
  `;

  document.getElementById('btn-back-topics').addEventListener('click', showTopicsView);
  document.getElementById('btn-next-question').addEventListener('click', nextQuestion);
}

function showQuizFinished(isTimeOut = false) {
  if (mixedTimer) clearInterval(mixedTimer);

  let stats = getUserStats();
  stats.completedQuizzes += 1;
  localStorage.setItem('huquqUstozStats', JSON.stringify(stats));

  ensureQuizViewStructure();
  const quizBody = document.getElementById('quiz-body');
  const finishedPanel = document.getElementById('quiz-finished');

  if (!quizBody || !finishedPanel) return;
  quizBody.classList.add('hidden');
  finishedPanel.classList.remove('hidden');

  let titleText = isTimeOut ? "⏰ Vaqt tugadi!" : "🎉 Test yakunlandi!";
  let subText = isTimeOut ? "Belgilangan vaqt tugagani uchun test avtomatik to'xtatildi." : "Siz ushbu testdagi barcha savolarga javob berdingiz.";
  let tgUser = tg.initDataUnsafe?.user;
  let userName = tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : 'O\'quvchi';
  let activeTopicName = currentTopicTests.length > 0 && currentTopicTests[0].topic ? currentTopicTests[0].topic : "Test natijasi";

  const reportText = `📊 Huququstoz - Test Natijasi!\n\n👤 Ism: ${userName}\n📚 Mavzu/Rejim: ${activeTopicName}\n✅ Natija: ${userScore} / ${currentTopicTests.length}\n\n🎯 Siz ham bilimlaringizni sinab ko'ring!`;
  const encodedText = encodeURIComponent(reportText);
  const telegramShareURL = `https://t.me/share/url?url=https://t.me/huququstoz&text=${encodedText}`;

  finishedPanel.innerHTML = `
    <div style="text-align: center; padding: 30px;" class="glass-card">
      <h3 style="margin-bottom: 10px; font-family: 'Cinzel', serif;">${titleText}</h3>
      <p style="color: var(--text-sub); margin-bottom: 15px;">${subText}</p>
      <p style="font-size: 18px; margin-bottom: 20px;">To'plagan ballingiz: <strong>${userScore} / ${currentTopicTests.length}</strong></p>
      <a href="${telegramShareURL}" target="_blank" id="btn-share-result" class="btn btn-primary btn-lg" style="display: block; margin-bottom: 12px; text-decoration: none; text-align: center; padding: 14px; border-radius: 12px; font-weight: 700;">
        Natijani ulashish 📤
      </a>
      <button id="btn-back-menu" class="btn btn-secondary btn-lg" style="width: 100%; padding: 14px; background: rgba(255,255,255,0.05); color: var(--text-main); border-radius: 12px; font-weight: 600;">Mavzularga qaytish 🔄</button>
    </div>
  `;

  document.getElementById('btn-share-result').addEventListener('click', (e) => {
    e.preventDefault();
    if (tg.openLink) tg.openLink(telegramShareURL);
    else window.open(telegramShareURL, '_blank');
  });

  document.getElementById('btn-back-menu').addEventListener('click', backToMenu);
}

function backToMenu() {
  if (mixedTimer) clearInterval(mixedTimer);
  const timerBadge = document.getElementById('quiz-timer-badge');
  if (timerBadge) timerBadge.remove();

  currentTestIndex = 0;
  userScore = 0;
  isAnswered = false;

  const finishedPanel = document.getElementById('quiz-finished');
  const quizBody = document.getElementById('quiz-body');
  if (finishedPanel) {
    finishedPanel.classList.add('hidden');
    finishedPanel.innerHTML = '';
  }
  if (quizBody) quizBody.classList.remove('hidden');

  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');
  if (tg.BackButton) tg.BackButton.hide();

  currentCategory = null;
  renderTopicsList();
}

function updateGlobalStats() {
  const statCorrect = document.getElementById('stat-correct');
  const certCorrect = document.getElementById('cert-correct');
  if (statCorrect) statCorrect.textContent = userScore;
  if (certCorrect) certCorrect.textContent = userScore;
}

function setupTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      tabPages.forEach(tab => tab.classList.remove('active'));
      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      const activeTab = document.getElementById(tabId);
      if (activeTab) activeTab.classList.add('active');
    });
  });

  const btnStartQuick = document.getElementById('btn-start-quick');
  if (btnStartQuick) {
    btnStartQuick.addEventListener('click', () => {
      const tabBtn = document.querySelector('.nav-item[data-tab="tab-tests"]');
      if (tabBtn) tabBtn.click();
    });
  }
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const lastVisit = localStorage.getItem('lastVisit');
  let streak = parseInt(localStorage.getItem('streakCount')) || 0;

  if (lastVisit !== today) {
    if (lastVisit) {
      const lastDate = new Date(lastVisit + 'T00:00:00');
      const currentDate = new Date(today + 'T00:00:00');
      const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
      streak = (diffDays === 1) ? streak + 1 : 1;
    } else {
      streak = 1;
    }
    localStorage.setItem('lastVisit', today);
    localStorage.setItem('streakCount', streak);
  }

  const topStreakEl = document.getElementById('streak-count');
  const mainStreakEl = document.getElementById('stat-streak');
  const certStreakEl = document.getElementById('cert-streak');

  if (topStreakEl) topStreakEl.textContent = streak;
  if (mainStreakEl) mainStreakEl.textContent = streak;
  if (certStreakEl) certStreakEl.textContent = streak + ' kun';
}
