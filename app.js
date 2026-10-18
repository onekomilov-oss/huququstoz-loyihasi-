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
    container.innerHTML = '<div style="padding: 10px; color: var(--text-sub);">Qonunlarni yuklab bo\'lmadi.</div>';
  }
}

// --- TESTLARNI YUKLASH VA MAVZULARGA BO'LISH ---
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
  
  document.getElementById('topic-select-view').classList.add('hidden');
  document.getElementById('quiz-view').classList.remove('hidden');
  
  renderQuestion();
}

function showTopicsView() {
  document.getElementById('quiz-view').classList.add('hidden');
  document.getElementById('topic-select-view').classList.remove('hidden');
}

// Savolni ekranga chiqarish (q, o formatiga moslangan)
function renderQuestion() {
  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished();
    return;
  }

  const q = currentTopicTests[currentTestIndex];
  
  document.getElementById('quiz-progress').textContent = `${currentTestIndex + 1} / ${currentTopicTests.length}`;
  const percent = ((currentTestIndex + 1) / currentTopicTests.length) * 100;
  document.getElementById('quiz-progress-bar').style.width = `${percent}%`;

  // Savol (q)
  document.getElementById('question-text').textContent = q.q;

  // Variantlar (o)
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  
  const optionsList = q.o || [];
  optionsList.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'glass-card option-btn';
    btn.style.cssText = 'width: 100%; text-align: left; padding: 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: var(--text-main); cursor: pointer;';
    btn.textContent = opt;
    // To'g'ri javob indeksi (a)
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

  // Izoh va tahlilni ko'rsatish (why)
  const analysisPanel = document.getElementById('analysis-panel');
  const analysisText = document.getElementById('analysis-text');
  const lexBtn = document.getElementById('btn-lex-link');

  if (lexBtn) lexBtn.style.display = 'none'; // Lex tugmasi yashirildi

  analysisText.textContent = q.why || "To'g'ri javob belgilandi.";
  analysisPanel.classList.remove('hidden');
}

function nextQuestion() {
  currentTestIndex++;
  renderQuestion();
}

function showQuizFinished() {
  const quizView = document.getElementById('quiz-view');
  quizView.innerHTML = `
    <div style="text-align: center; padding: 30px;" class="glass-card">
      <h3 style="margin-bottom: 10px; font-family: 'Cinzel', serif;">🎉 Mavzu yakunlandi!</h3>
      <p style="color: var(--text-sub); margin-bottom: 15px;">Siz ushbu mavzodagi barcha testlarni muvaffaqiyatli tugatdingiz.</p>
      <p style="font-size: 18px; margin-bottom: 20px;">To'plagan ballingiz: <strong>${userScore}</strong></p>
      <button onclick="location.reload()" class="btn btn-primary btn-lg">Mavzularga qaytish 🔄</button>
    </div>
  `;
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
