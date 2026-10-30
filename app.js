// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// 2 Bosqichli Menyu va Aralash Imtihon Rejimi Versiyasi
// ==========================================

const tg = window.Telegram.WebApp;
tg.expand();

let allTests = [];           // Barcha yuklangan testlar
let currentTopicTests = [];  // Tanlangan mavzudagi testlar
let currentTestIndex = 0;    // Hozirgi savol indeksi
let userScore = 0;           // Joriy mavzudagi to'g'ri javoblar soni
let isAnswered = false;      // Joriy savolga javob berilganini belgilash
let currentCategory = null;  // Hozir tanlangan asosiy fan
let mixedTimer = null;       // Aralash test taymeri
let timeLeft = 0;            // Qolgan vaqt (sekundda)

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

  // Guvohnoma sanasini chiqarish
  const certDateEl = document.getElementById('cert-date');
  if (certDateEl) {
    const today = new Date();
    certDateEl.textContent = today.toLocaleDateString();
  }

  // 2. Qonunlar va Barcha Test fayllarini yuklash
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

  // 5. Telegram "Ortga" tugmasi
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

// --- BARCHA TEST FAYLLARINI AVTOMATIK YUKLASH ---
async function loadTestsData() {
  try {
    allTests = [];
    
    const fileNames = [
      // Davlat ramzlari va siyosiy partiyalar
      'tests/davlat_bayrogisi.json',
      'tests/davlat_gerbi.json',
      'tests/davlat_madhiyasi.json',
      'tests/siyosiy_partiyalar.json',

      // Fuqarolik huquqi (1-4)
      'tests/fuqarolik_1-bosqich.json',
      'tests/fuqarolik_2-bosqich.json',
      'tests/fuqarolik_3-bosqich.json',
      'tests/fuqarolik_4-bosqich.json',
      
      // Jinoyat huquqi (1-10)
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
      
      // Konstitutsiya (1-5)
      'tests/konstitutsiya_1-bosqich.json',
      'tests/konstitutsiya_2-bosqich.json',
      'tests/konstitutsiya_3-bosqich.json',
      'tests/konstitutsiya_4-bosqich.json',
      'tests/konstitutsiya_5-bosqich.json',

      // Mehnat huquqi (1-10)
      'tests/mehnat_1-bosqich.json',
      'tests/mehnat_2-bosqich.json',
      'tests/mehnat_3-bosqich.json',
      'tests/mehnat_4-bosqich.json',
      'tests/mehnat_5-bosqich.json',
      'tests/mehnat_6-bosqich.json',
      'tests/mehnat_7-bosqich.json',
      'tests/mehnat_8-bosqich.json',
      'tests/mehnat_9-bosqich.json',
      'tests/mehnat_10-bosqich.json',

      // Oila huquqi (1-8)
      'tests/oila_1-bosqich.json',
      'tests/oila_2-bosqich.json',
      'tests/oila_3-bosqich.json',
      'tests/oila_4-bosqich.json',
      'tests/oila_5-bosqich.json',
      'tests/oila_6-bosqich.json',
      'tests/oila_7-bosqich.json',
      'tests/oila_8-bosqich.json'
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

// --- 2 BOSQICHLI MENYU VA ARALASH TEST ---
function renderTopicsList() {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = '';

  if (currentCategory) {
    renderSubTopicsList(currentCategory);
    return;
  }

  // 1. Aralash Test tugmasi
  const mixedCard = document.createElement('div');
  mixedCard.className = 'glass-card';
  mixedCard.style.cssText = 'padding: 18px; margin-bottom: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 14px; background: linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(255,255,255,0.05)); border: 1px solid var(--accent);';
  mixedCard.innerHTML = `
    <div>
      <strong style="font-size: 17px; color: var(--accent); display: block;">⚡ Aralash Test (Imtihon rejimi)</strong>
      <div style="font-size: 13px; color: var(--text-sub); margin-top: 4px;">Barcha bazadan savollar | Miqdor va vaqtni o'zingiz belgilang</div>
    </div>
    <span style="font-size: 18px; color: var(--accent);">▶</span>
  `;
  mixedCard.addEventListener('click', () => {
    showMixedQuizSetup();
  });
  topicsListContainer.appendChild(mixedCard);

  // 2. Asosiy fanlar guruhlari
  const categoriesMap = {};
  allTests.forEach(test => {
    let rawTopic = test.topic || "Umumiy huquqiy testlar";
    let categoryName = rawTopic.split(':')[0].trim();
    
    if (!categoriesMap[categoryName]) {
      categoriesMap[categoryName] = [];
    }
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

// --- ARALASH TEST SOZLAMALARI ---
function showMixedQuizSetup() {
  const topicsListContainer = document.getElementById('topics-list');
  if (!topicsListContainer) return;

  topicsListContainer.innerHTML = `
    <div class="glass-card" style="padding: 20px; border-radius: 14px;">
      <h3 style="margin-bottom: 15px; color: var(--text-main); text-align: center;">⚡ Aralash Imtihon Rejimi</h3>
      <p style="color: var(--text-sub); font-size: 13px; margin-bottom: 20px; text-align: center;">Barcha bazadagi fanlardan tasodifiy savollar tanlanadi.</p>
      
      <label style="display: block; font-size: 14px; color: var(--text-main); margin-bottom: 6px;">Savollar sonini tanlang:</label>
      <select id="mixed-count" class="glass-card" style="width: 100%; padding: 12px; margin-bottom: 16px; border-radius: 10px; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1);">
        <option value="15">15 ta savol</option>
        <option value="30" selected>30 ta savol</option>
        <option value="45">45 ta savol</option>
        <option value="60">60 ta savol</option>
        <option value="80">80 ta savol</option>
        <option value="100">100 ta savol</option>
      </select>

      <label style="display: block; font-size: 14px; color: var(--text-main); margin-bottom: 6px;">Vaqtni belgilang (minutda):</label>
      <input type="number" id="mixed-minutes" value="30" min="1" max="180" class="glass-card" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 10px; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1);">

      <button id="btn-start-mixed" class="btn btn-primary btn-lg" style="width: 100%; padding: 14px; margin-bottom: 10px; cursor: pointer;">Testni boshlash 🚀</button>
      <button id="btn-back-from-mixed" class="btn btn-secondary" style="width: 100%; padding: 12px; cursor: pointer; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;">← Orqaga qaytish</button>
    </div>
  `;

  document.getElementById('btn-start-mixed').addEventListener('click', () => {
    const count = parseInt(document.getElementById('mixed-count').value);
    const minutes = parseInt(document.getElementById('mixed-minutes').value) || 30;
    startMixedQuizProcess(count, minutes);
  });

  document.getElementById('btn-back-from-mixed').addEventListener('click', () => {
    renderTopicsList();
  });
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
  backCatBtn.style.cssText = 'margin-bottom: 14px; width: 100%; text-align: left; padding: 12px 16px; border-radius: 10px; cursor: pointer; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1);';
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
      if (!subTopicsMap[rawTopic]) {
        subTopicsMap[rawTopic] = [];
      }
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

    card.addEventListener('click', () => {
      startQuizForTopic(testsInSub);
    });

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
  const quizView = document.getElementById('quiz-view');

  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished(false);
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

  if (lexBtn) {
    lexBtn.style.display = 'block';
    lexBtn.onclick = () => {
      const lawUrl = "https://lex.uz";
      if (tg.openLink) tg.openLink(lawUrl);
      else window.open(lawUrl, '_blank');
    };
  }

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
        <button id="btn-lex-link" class="btn btn-secondary btn-lg" style="margin-bottom: 8px; width: 100%;">📖 Lex.uz da Ochish</button>
        <button id="btn-next-question" class="btn btn-primary btn-lg" style="width: 100%;">Keyingi Savol →</button>
      </div>
    </div>
  `;

  const btnBack = document.getElementById('btn-back-topics');
  if (btnBack) btnBack.addEventListener('click', showTopicsView);

  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) btnNext.addEventListener('click', nextQuestion);
}

function showQuizFinished(isTimeOut = false) {
  if (mixedTimer) clearInterval(mixedTimer);
  ensureQuizViewStructure();

  const quizBody = document.getElementById('quiz-body');
  const finishedPanel = document.getElementById('quiz-finished');

  if (!quizBody || !finishedPanel) return;

  quizBody.classList.add('hidden');
  finishedPanel.classList.remove('hidden');

  let titleText = isTimeOut ? "⏰ Vaqt tugadi!" : "🎉 Test yakunlandi!";
  let subText = isTimeOut ? "Belgilangan vaqt tugagani uchun test avtomatik to'xtatildi." : "Siz ushbu testdagi barcha savolarga javob berdingiz.";

  const tgUser = tg.initDataUnsafe?.user;
  const userName = tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : 'O\'quvchi';
  const adminUsername = "huququstoz"; 

  const reportText = `📊 Test Natijasi!\n\n👤 Ism: ${userName}\n✅ To'g'ri javoblar: ${userScore} / ${currentTopicTests.length}`;
  const encodedText = encodeURIComponent(reportText);
  const telegramShareURL = `https://t.me/${adminUsername}?text=${encodedText}`;

  finishedPanel.innerHTML = `
    <div style="text-align: center; padding: 30px;" class="glass-card">
      <h3 style="margin-bottom: 10px; font-family: 'Cinzel', serif;">${titleText}</h3>
      <p style="color: var(--text-sub); margin-bottom: 15px;">${subText}</p>
      <p style="font-size: 18px; margin-bottom: 20px;">To'plagan ballingiz: <strong>${userScore} / ${currentTopicTests.length}</strong></p>
      
      <a href="${telegramShareURL}" target="_blank" id="btn-send-result" class="btn btn-primary btn-lg" style="display: block; margin-bottom: 12px; text-decoration: none; text-align: center; padding: 14px;">
        Natijani ustozga yuborish 📤
      </a>

      <button id="btn-back-menu" class="btn btn-secondary btn-lg" style="width: 100%; padding: 14px; background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer;">Mavzularga qaytish 🔄</button>
    </div>
  `;

  document.getElementById('btn-send-result').addEventListener('click', (e) => {
    e.preventDefault();
    if (tg.openTelegramLink) {
      tg.openTelegramLink(telegramShareURL);
    } else {
      window.open(telegramShareURL, '_blank');
    }
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
