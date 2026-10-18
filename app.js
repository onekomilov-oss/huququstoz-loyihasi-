// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// To'liq va Yangilangan Versiya (15 ta Bosqich)
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

let allTests = [];           // Barcha yuklangan testlar
let currentTopicTests = [];  // Tanlangan mavzudagi testlar
let currentTestIndex = 0;    // Hozirgi savol indeksi
let userScore = 0;           // Joriy mavzudagi to'g'ri javoblar soni
let isAnswered = false;      // Joriy savolga javob berilganini belgilash

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

  // 2. Qonunlar va Barcha 15 ta Test fayllarini yuklash
  fetchLaws();
  loadTestsData();

  // 3. Menyular va Streak
  setupTabs();
  updateStreak();

  // 4. Test interfeysi tugmalari
  const btnBackTopics = document.getElementById('btn-back-topics');
  if (btnBackTopics) {
    btnBackTopics.addEventListener('click', showTopicsView);
  }

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) {
    btnNext.addEventListener('click', nextQuestion);
  }

  // 5. Telegram "Ortga" tugmasi (telefon brauzeri tugmasi)
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

// --- QONUNLARNI YUKLASH ---
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

      // Havolani Telegram brauzerida to'g'ri ochish uchun
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (tg.openLink) {
          tg.openLink(law.url);
        } else {
          window.open(law.url, '_blank');
        }
      });

      container.appendChild(link);
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div style="padding: 10px; color: var(--text-sub);">Qonunlarni yuklab bo\'lmadi.</div>';
  }
}

// --- BARCHA 15 TA TEST FAYLLARINI AVTOMATIK YUKLASH ---
async function loadTestsData() {
  try {
    allTests = [];
    
    // Jinoyat (1-10) va Konstitutsiya (1-5) bosqichlari fayllari ro'yxati
    const fileNames = [
      'tests/jinoyat_1-bosqich.json',
      'tests/jinoyat_2-bosqich.json',
      'tests/jinoyat_3-bosqich.json',
      'tests/jinoyat_4-bosqich.json',
      'tests/jinoyat_5-bosqich.json',
      'tests/jinoyat_6-bosqich.json',
      'tests/jinoyat_7-bosqich.json',
      'tests/jinoyat_8-bosqich.json',
      'tests/jinoyat_9-bosqich.json',
      'tests/jinoyat_10-bosqich.json',
      'tests/konstitutsiya_1-bosqich.json',
      'tests/konstitutsiya_2-bosqich.json',
      'tests/konstitutsiya_3-bosqich.json',
      'tests/konstitutsiya_4-bosqich.json',
      'tests/konstitutsiya_5-bosqich.json'
    ];

    for (const filePath of fileNames) {
      try {
        const response = await fetch(`./${filePath}`);
        if (response.ok) {
          const fileData = await response.json();
          if (Array.isArray(fileData)) {
            allTests = allTests.concat(fileData);
          }
        }
      } catch (err) {
        console.warn(`${filePath} topilmadi yoki bo'sh.`);
      }
    }

    // Agar hech qaysi fayldan topilmasa, namuna.json dan o'qish (zaxira)
    if (allTests.length === 0) {
      const response = await fetch('./namuna.json');
      if (response.ok) {
        allTests = await response.json();
      }
    }

    renderTopicsList();
  } catch (error) {
    console.error(error);
    const topicsList = document.getElementById('topics-list');
    if (topicsList) {
      topicsList.innerHTML = '<div style="color: var(--text-sub); padding: 10px;">Testlar tez orada qo\'shiladi.</div>';
    }
  }
}

// Mavzular mundarijasini chizish
function renderTopicsList() {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;

  const topicsMap = {};
  allTests.forEach(test => {
    const topic = test.topic || "Umumiy huquqiy testlar";
    if (!topicsMap[topic]) {
      topicsMap[topic] = [];
    }
    topicsMap[topic].push(test);
  });

  topicsListContainer.innerHTML = '';

  Object.keys(topicsMap).forEach(topicName => {
    const testsInTopic = topicsMap[topicName];
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cssText = 'padding: 16px; margin-bottom: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 12px;';

    card.innerHTML = `
      <div>
        <strong style="font-size: 16px; color: var(--text-main);">${topicName}</strong>
        <div style="font-size: 13px; color: var(--text-sub); margin-top: 4px;">Savollar soni: ${testsInTopic.length} ta</div>
      </div>
      <span style="font-size: 18px; color: var(--accent);">▶</span>
    `;

    card.addEventListener('click', () => {
      startQuizForTopic(testsInTopic);
    });

    topicsListContainer.appendChild(card);
  });
}

function startQuizForTopic(tests) {
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
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');

  if (tg.BackButton) tg.BackButton.hide();
}

// Savolni ekranga chiqarish
function renderQuestion() {
  const quizView = document.getElementById('quiz-view');

  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished();
    return;
  }

  ensureQuizViewStructure();

  const q = currentTopicTests[currentTestIndex];
  isAnswered = false;

  const percent = (currentTestIndex / currentTopicTests.length) * 100;

  const progressEl = document.getElementById('quiz-progress');
  const progressBarEl = document.getElementById('quiz-progress-bar');
  if (progressEl) progressEl.textContent = `${currentTestIndex + 1} / ${currentTopicTests.length}`;
  if (progressBarEl) progressBarEl.style.width = `${percent}%`;

  document.getElementById('question-text').textContent = q.q;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  const optionsList = q.o || [];
  optionsList.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'glass-card option-btn';
    btn.style.cssText = 'width: 100%; text-align: left; padding: 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer;';
    btn.textContent = opt;
    btn.addEventListener('click', () => selectAnswer(idx, q.a, q));
    optionsContainer.appendChild(btn);
  });

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) {
    btnNext.textContent = (currentTestIndex === currentTopicTests.length - 1)
      ? 'Yakunlash ✅'
      : 'Keyingi Savol →';
  }

  document.getElementById('analysis-panel').classList.add('hidden');
}

// Javobni tekshirish
function selectAnswer(selectedIndex, correctIndex, q) {
  if (isAnswered) return;
  isAnswered = true;

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

  if (selectedIndex === correctIndex) {
    userScore++;
    updateGlobalStats();
  }

  const percent = ((currentTestIndex + 1) / currentTopicTests.length) * 100;
  const progressBarEl = document.getElementById('quiz-progress-bar');
  if (progressBarEl) progressBarEl.style.width = `${percent}%`;

  const analysisPanel = document.getElementById('analysis-panel');
  const analysisText = document.getElementById('analysis-text');
  const lexBtn = document.getElementById('btn-lex-link');

  if (lexBtn) lexBtn.style.display = 'none';

  analysisText.textContent = q.why || "To'g'ri javob belgilandi.";
  analysisPanel.classList.remove('hidden');
}

function nextQuestion() {
  currentTestIndex++;
  renderQuestion();
}

function ensureQuizViewStructure() {
  const quizView = document.getElementById('quiz-view');
  if (!quizView) return;
  if (document.getElementById('question-text')) return;

  quizView.innerHTML = `
    <div id="quiz-finished" class="hidden"></div>
    <div id="quiz-body">
      <div class="quiz-top-nav">
        <button id="btn-back-topics" class="btn-back">← Ortga</button>
        <div id="quiz-progress" class="quiz-badge">1 / 30</div>
      </div>
      <div class="progress-track">
        <div id="quiz-progress-bar" class="progress-fill"></div>
      </div>
      <div id="question-card" class="glass-card quiz-card">
        <div id="question-text" class="question-text">Savol yuklanmoqda...</div>
        <div id="options-container" class="options-grid"></div>
      </div>
      <div id="analysis-panel" class="glass-card analysis-card hidden">
        <div class="analysis-header">
          <span>📖</span>
          <h3>Huquqiy Tahlil</h3>
        </div>
        <p id="analysis-text" class="analysis-body"></p>
        <button id="btn-next-question" class="btn btn-primary btn-lg" style="margin-top:12px;">Keyingi Savol →</button>
      </div>
    </div>
  `;

  const btnBack = document.getElementById('btn-back-topics');
  if (btnBack) btnBack.addEventListener('click', showTopicsView);

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) btnNext.addEventListener('click', nextQuestion);
}

function showQuizFinished() {
  ensureQuizViewStructure();

  const quizBody = document.getElementById('quiz-body');
  const finishedPanel = document.getElementById('quiz-finished');

  if (!quizBody || !finishedPanel) return;

  quizBody.classList.add('hidden');
  finishedPanel.classList.remove('hidden');
  finishedPanel.innerHTML = `
    <div style="text-align: center; padding: 30px;" class="glass-card">
      <h3 style="margin-bottom: 10px; font-family: 'Cinzel', serif;">🎉 Mavzu yakunlandi!</h3>
      <p style="color: var(--text-sub); margin-bottom: 15px;">Siz ushbu mavzodagi barcha testlarni muvaffaqiyatli tugatdingiz.</p>
      <p style="font-size: 18px; margin-bottom: 20px;">To'plagan ballingiz: <strong>${userScore} / ${currentTopicTests.length}</strong></p>
      <button id="btn-back-menu" class="btn btn-primary btn-lg">Mavzularga qaytish 🔄</button>
    </div>
  `;

  const btnBackMenu = document.getElementById('btn-back-menu');
  if (btnBackMenu) btnBackMenu.addEventListener('click', backToMenu);
}

function backToMenu() {
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

  renderTopicsList();
}

function updateGlobalStats() {
  const statCorrect = document.getElementById('stat-correct');
  const certCorrect = document.getElementById('cert-correct');
  if (statCorrect) statCorrect.textContent = userScore;
  if (certCorrect) certCorrect.textContent = userScore;
}

// --- MENYULAR VA STREAK ---
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
