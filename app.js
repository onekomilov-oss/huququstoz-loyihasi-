// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

document.addEventListener('DOMContentLoaded', () => {
  // 1. Telegram ismini chiqarish
  const tgUser = tg.initDataUnsafe?.user;
  if (tgUser) {
    const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    const userNameEl = document.getElementById('user-name');
    const certNameEl = document.getElementById('cert-user-name');
    if (userNameEl) userNameEl.textContent = fullName;
    if (certNameEl) certNameEl.textContent = fullName;
  }

  // 2. Qonunlarni laws.json dan olish
  fetchLaws();

  // 3. Testlarni namuna.json dan olish
  fetchTests();

  // 4. Menyular va Streak
  setupTabs();
  updateStreak();
});

// laws.json ni o'qish funksiyasi
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
      link.target = '_blank';
      link.className = 'glass-card';
      link.style.textDecoration = 'none';
      link.style.color = 'var(--text-main)';
      link.style.padding = '16px';
      link.style.display = 'flex';
      link.style.alignItems = 'center';
      link.style.gap = '12px';
      link.style.marginBottom = '10px';

      link.innerHTML = `
        <span style="font-size: 24px;">📜</span>
        <span>
          <small style="color: var(--text-sub);">Hujjat №${law.n}</small><br>
          <strong>${law.title}</strong>
        </span>
      `;
      container.appendChild(link);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div style="padding: 10px; color: var(--text-sub);">Qonunlarni yuklab bo\'lmadi. laws.json faylini tekshiring.</div>';
  }
}

// ==========================================
// TESTLAR TIZIMI MANTIQI
// ==========================================

let currentTests = [];
let currentTestIndex = 0;
let userScore = 0;

async function fetchTests() {
  const container = document.getElementById('tests-container');
  if (!container) return;

  try {
    const response = await fetch('./namuna.json');
    if (!response.ok) throw new Error('Testlarni yuklab bo\'lmadi');
    
    currentTests = await response.json();
    renderQuestion();
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-sub);">Testlar tez orada yuklanadi.</div>';
  }
}

function renderQuestion() {
  const container = document.getElementById('tests-container');
  if (!container) return;

  if (currentTests.length === 0 || currentTestIndex >= currentTests.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <h3 style="margin-bottom: 10px;">🎉 Tabriklaymiz!</h3>
        <p style="color: var(--text-sub); margin-bottom: 15px;">Siz barcha testlarni muvaffaqiyatli yakunladingiz.</p>
        <p style="font-size: 18px; margin-bottom: 20px;">To'plagan ballingiz: <strong>${userScore} / ${currentTests.length}</strong></p>
        <button onclick="restartTests()" class="glass-card" style="padding: 12px 24px; background: var(--accent); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">Qaytadan boshlash 🔄</button>
      </div>
    `;
    return;
  }

  const q = currentTests[currentTestIndex];
  let optionsHTML = '';
  const optionsList = q.options || q.variants || [];
  
  optionsList.forEach((opt, idx) => {
    optionsHTML += `
      <button onclick="checkAnswer(${idx}, ${q.correct !== undefined ? q.correct : q.answer})" class="glass-card option-btn" style="width: 100%; text-align: left; padding: 14px 16px; margin-bottom: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer; font-size: 15px; transition: 0.2s;">
        ${opt}
      </button>
    `;
  });

  container.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 13px; color: var(--text-sub); display: flex; justify-content: space-between;">
      <span>Mavzu: ${q.topic || 'Huquqiy test'}</span>
      <span>${currentTestIndex + 1} / ${currentTests.length}</span>
    </div>
    <div style="font-size: 17px; font-weight: 600; margin-bottom: 16px; line-height: 1.4;">${q.question}</div>
    <div class="options-list">${optionsHTML}</div>
    <div id="explanation-box" style="margin-top: 15px; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.08); font-size: 14px; display: none;"></div>
  `;
}

function checkAnswer(selectedIndex, correctIndex) {
  const options = document.querySelectorAll('.option-btn');
  options.forEach((btn, idx) => {
    btn.disabled = true; 
    if (idx === correctIndex) {
      btn.style.background = 'rgba(40, 167, 69, 0.25)';
      btn.style.borderColor = '#28a745';
    } else if (idx === selectedIndex) {
      btn.style.background = 'rgba(220, 53, 69, 0.25)';
      btn.style.borderColor = '#dc3545';
    }
  });

  const q = currentTests[currentTestIndex];
  const expBox = document.getElementById('explanation-box');
  if (expBox && q.explanation) {
    expBox.style.display = 'block';
    expBox.innerHTML = `<strong>💡 Izoh:</strong> ${q.explanation}<br><br>
      <button onclick="nextQuestion()" style="padding: 10px 20px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Keyingi savol ➡️</button>
    `;
  } else {
    setTimeout(nextQuestion, 1200);
  }

  if (selectedIndex === correctIndex) {
    userScore++;
  }
}

function nextQuestion() {
  currentTestIndex++;
  renderQuestion();
}

function restartTests() {
  currentTestIndex = 0;
  userScore = 0;
  renderQuestion();
}

// ==========================================
// MENYULAR VA STREAK MANTIQI
// ==========================================

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
      document.querySelector('.nav-item[data-tab="tab-tests"]').click();
    });
  }
}

function updateStreak() {
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('lastVisit');
  let streak = parseInt(localStorage.getItem('streakCount')) || 0;

  if (lastVisit !== today) {
    if (lastVisit) {
      const lastDate = new Date(lastVisit);
      const currentDate = new Date(today);
      const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));
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
