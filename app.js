// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

let allTests = [];          // Barcha yuklangan testlar
let currentTopicTests = []; // Tanlangan mavzudagi testlar
let currentTestIndex = 0;   // Hozirgi savol indeksi
let userScore = 0;          // To'g'ri javoblar soni

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

  // 2. Qonunlar va Testlarni yuklash
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
});

// --- QONUNLARNI XAVFSIZ CHIQARISH (textContent orqali) ---
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
      link.style.cssText = 'text-decoration: none; color: var(--text-main); padding: 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 10px; border-radius: 12px;';

      const iconSpan = document.createElement('span');
      iconSpan.style.fontSize = '24px';
      iconSpan.textContent = '📜';

      const textSpan = document.createElement('span');

      const smallSub = document.createElement('small');
      smallSub.style.color = 'var(--text-sub)';
      smallSub.textContent = `Hujjat №${law.n}`;

      const br = document.createElement('br');

      const strongTitle = document.createElement('strong');
      strongTitle.textContent = law.title;

      textSpan.appendChild(smallSub);
      textSpan.appendChild(br);
      textSpan.appendChild(strongTitle);

      link.appendChild(iconSpan);
      link.appendChild(textSpan);
      container.appendChild(link);
    });
  } catch (error) {
    console.error(error);
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding: 10px; color: var(--text-sub);';
    errDiv.textContent = 'Qonunlarni yuklab bo\'lmadi.';
    container.innerHTML = '';
    container.appendChild(errDiv);
  }
}

// --- TESTLARNI YUKLASH ---
async function loadTestsData() {
  try {
    const response = await fetch('./namuna.json');
    if (!response.ok) throw new Error('Testlarni yuklab bo\'lmadi');
    
    allTests = await response.json();
    renderTopicsList();
  } catch (error) {
    console.error(error);
    const topicsList = document.getElementById('topics-list');
    if (topicsList) {
      topicsList.textContent = 'Testlar tez orada qo\'shiladi.';
      topicsList.style.cssText = 'color: var(--text-sub); padding: 10px;';
    }
  }
}

// --- MAVZULAR MUNDARIJASINI XAVFSIZ CHIQARISH ---
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
    
    const infoDiv = document.createElement('div');

    const titleStrong = document.createElement('strong');
    titleStrong.style.cssText = 'font-size: 16px; color: var(--text-main); display: block;';
    titleStrong.textContent = topicName;

    const countDiv = document.createElement('div');
    countDiv.style.cssText = 'font-size: 13px; color: var(--text-sub); margin-top: 4px;';
    countDiv.textContent = `Savollar soni: ${testsInTopic.length} ta`;

    infoDiv.appendChild(titleStrong);
    infoDiv.appendChild(countDiv);

    const arrowSpan = document.createElement('span');
    arrowSpan.style.cssText = 'font-size: 18px; color: var(--accent);';
    arrowSpan.textContent = '▶';

    card.appendChild(infoDiv);
    card.appendChild(arrowSpan);

    card.addEventListener('click', () => {
      startQuizForTopic(testsInTopic);
    });

    topicsListContainer.appendChild(card);
  });
}

// --- 1. MAVZUNI NOLDAN BOSHLASH ---
function startQuizForTopic(tests) {
  currentTopicTests = tests;
  currentTestIndex = 0;
  userScore = 0; // Har safar yangi mavzu 0 balldan boshlanadi

  updateGlobalStats();

  document.getElementById('topic-select-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  
  renderQuestion();
}

// --- 2. ORTGA QAYTISH VA HOLATNI TOZALASH ---
function showTopicsView() {
  currentTestIndex = 0;
  userScore = 0; // Ortga qaytganda ham ball tozalanadi

  updateGlobalStats();

  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');
}

// --- SAVOLNI XAVFSIZ CHIQARISH ---
function renderQuestion() {
  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished();
    return;
  }

  const q = currentTopicTests[currentTestIndex];
  
  document.getElementById('quiz-progress').textContent = `${currentTestIndex + 1} / ${currentTopicTests.length}`;
  const percent = ((currentTestIndex + 1) / currentTopicTests.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = `${percent}%`;

  // Savol matnini xavfsiz chiqarish
  document.getElementById('question-textミュニ' === undefined ? '' : '') // Placeholder
  const qTextEl = document.getElementById('question-text');
  if (qTextEl) qTextEl.textContent = q.q;

  // Variantlar
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  
  const optionsList = q.o || [];
  optionsList.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'glass-card option-btn';
    btn.style.cssText = 'width: 100%; text-align: left; padding: 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer;';
    btn.textContent = opt; // Xavfsiz chiqdi
    btn.addEventListener('click', () => selectAnswer(idx, q.a, q));
    optionsContainer.appendChild(btn);
  });

  document.getElementById('analysis-panel').classList.add('hidden');
}

// Javobni tekshirish
function selectAnswer(selectedIndex, correctIndex, q) {
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

  // Izoh va tahlilni xavfsiz chiqarish
  const analysisPanel = document.getElementById('analysis-panel');
  const analysisText = document.getElementById('analysis-text');
  const lexBtn = document.getElementById('btn-lex-link');

  if (lexBtn) lexBtn.style.display = 'none';

  if (analysisText) {
    analysisText.textContent = q.why || "To'g'ri javob belgilandi.";
  }
  analysisPanel.classList.remove('hidden');
}

function nextQuestion() {
  currentTestIndex++;
  renderQuestion();
}

// --- 3. TEST YAKUNIDA TO'G'RI BALL VA FOIZNI KO'RSATISH ---
function showQuizFinished() {
  const total = currentTopicTests.length;
  const percent = total > 0 ? Math.round((userScore / total) * 100) : 0;

  const quizView = document.getElementById('quiz-view');
  
  // Asosiy elementlarni yaratish orqali xavfsiz va toza qurish
  quizView.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'glass-card';
  card.style.cssText = 'text-align: center; padding: 30px; border-radius: 16px;';

  const h3 = document.createElement('h3');
  h3.style.cssText = 'margin-bottom: 10px; font-family: "Cinzel", serif; color: var(--text-main);';
  h3.textContent = '🎉 Mavzu yakunlandi!';

  const p1 = document.createElement('p');
  p1.style.cssText = 'color: var(--text-sub); margin-bottom: 10px;';
  p1.textContent = 'Siz ushbu mavzodagi barcha testlarni muvaffaqiyatli tugatdingiz.';

  const p2 = document.createElement('p');
  p2.style.cssText = 'font-size: 16px; margin-bottom: 6px; color: var(--text-main);';
  p2.textContent = `To'g'ri javoblar: ${userScore} / ${total}`;

  const p3 = document.createElement('p');
  p3.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 20px; color: var(--accent);';
  p3.textContent = `Natija: ${percent}%`;

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-lg';
  btn.textContent = 'Mavzularga qaytish 🔄';
  btn.addEventListener('click', backToMenu);

  card.appendChild(h3);
  card.appendChild(p1);
  card.appendChild(p2);
  card.appendChild(p3);
  card.appendChild(btn);

  quizView.appendChild(card);
}

// Qaytish tugmasi bosilganda oynalarni to'g'ri almashtirish
function backToMenu() {
  currentTestIndex = 0;
  userScore = 0;
  updateGlobalStats();
  
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');
  
  renderTopicsList();
  
  // Quiz view HTML tuzilishini asliga qaytaramiz
  const quizView = document.getElementById('quiz-view');
  quizView.innerHTML = `
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
  `;

  const btnBack = document.getElementById('btn-back-topics');
  if (btnBack) btnBack.addEventListener('click', showTopicsView);

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) btnNext.addEventListener('click', nextQuestion);
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
