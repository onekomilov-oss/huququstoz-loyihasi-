(function () {
  const tg = window.Telegram ? window.Telegram.WebApp : null;
  const cfg = window.HUQUQUSTOZ_CONFIG || { 
    owner: "onekomilov-oss", 
    repo: "huququstoz-loyihasi-",
    botUsername: "huquqmindBot" // Fix 1: Bot username qo'shildi
  };
  const RAW_BASE = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/data/`;

  let appState = {
    user: { id: 0, first_name: "Foydalanuvchi" },
    totalCorrect: 0,
    streak: 0,
    lastStreakDate: "",
    levels: [],
    manifest: [],
    currentQuiz: [],
    currentQIndex: 0,
    blockCorrect: 0,
    blockTotal: 0
  };

  // Telegram muhitini tekshirish
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get("preview") === "1";

  if (!tg || (!tg.initData && !isPreview)) {
    const extWarn = document.getElementById("external-warning");
    if (extWarn) extWarn.classList.remove("hidden");
    return;
  }

  const appEl = document.getElementById("app");
  if (appEl) appEl.classList.remove("hidden");
  if (tg) tg.ready();

  // Moslashuvchan vaqt foni
  const currentHour = new Date().getHours();
  if (currentHour >= 6 && currentHour < 20) {
    document.documentElement.setAttribute("data-tone", "day");
  } else {
    document.documentElement.setAttribute("data-tone", "night");
  }

  // Foydalanuvchi ma'lumotlarini yuklash
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    appState.user = tg.initDataUnsafe.user;
  }

  // 1. Top-Bar Scroll Listener
  const mainContent = document.querySelector('.main-content');
  const topBar = document.querySelector('.top-bar');

  if (mainContent && topBar) {
    mainContent.addEventListener('scroll', () => {
      if (mainContent.scrollTop > 15) {
        topBar.classList.add('scrolled');
      } else {
        topBar.classList.remove('scrolled');
      }
    });
  }

  // 2. Sheen Ripple Effekti (JS Class Trigger)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-primary');
    if (btn) {
      btn.classList.remove('ripple-active');
      void btn.offsetWidth; // Force Reflow
      btn.classList.add('ripple-active');
    }
  });

  // 3. Counter Animatsiyasi (0 -> value)
  function animateCounter(elementId, targetValue, duration = 800) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    let startTimestamp = null;
    const startValue = 0;
    const target = parseInt(targetValue, 10) || 0;

    function step(timestamp) {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(easedProgress * (target - startValue) + startValue);
      el.textContent = currentValue;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }
    window.requestAnimationFrame(step);
  }

  // CloudStorage / LocalStorage
  function loadUserData() {
    if (tg && tg.CloudStorage) {
      tg.CloudStorage.getItems(["correct", "streak", "lastDate"], (err, res) => {
        if (!err && res) {
          appState.totalCorrect = parseInt(res.correct || "0", 10);
          appState.streak = parseInt(res.streak || "0", 10);
          appState.lastStreakDate = res.lastDate || "";
        }
        updateUI();
      });
    } else {
      appState.totalCorrect = parseInt(localStorage.getItem("hq_correct") || "0", 10);
      appState.streak = parseInt(localStorage.getItem("hq_streak") || "0", 10);
      appState.lastStreakDate = localStorage.getItem("hq_lastDate") || "";
      updateUI();
    }
  }

  function saveUserData() {
    if (tg && tg.CloudStorage) {
      tg.CloudStorage.setItem("correct", appState.totalCorrect.toString());
      tg.CloudStorage.setItem("streak", appState.streak.toString());
      tg.CloudStorage.setItem("lastDate", appState.lastStreakDate);
    }
    localStorage.setItem("hq_correct", appState.totalCorrect.toString());
    localStorage.setItem("hq_streak", appState.streak.toString());
    localStorage.setItem("hq_lastDate", appState.lastStreakDate);
  }

  function haptic(type) {
    if (tg && tg.HapticFeedback) {
      if (type === "success" || type === "error") {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred("light");
      }
    }
  }

  function getRankTitle(score) {
    let title = "1-kurs talabasi";
    for (let lvl of appState.levels) {
      if (score >= lvl.threshold) {
        title = lvl.title;
      }
    }
    return title;
  }

  function updateUI() {
    const nameStr = appState.user.first_name || "Foydalanuvchi";
    const rankStr = getRankTitle(appState.totalCorrect);

    const uNameEl = document.getElementById("user-name");
    if (uNameEl) {
      uNameEl.textContent = nameStr;
      uNameEl.classList.remove("loading");
    }

    const uRankEl = document.getElementById("user-rank");
    if (uRankEl) uRankEl.textContent = rankStr;

    // Statistika counter animatsiyasi
    animateCounter("stat-correct", appState.totalCorrect);
    animateCounter("stat-streak", appState.streak);

    const streakCountEl = document.getElementById("streak-count");
    if (streakCountEl) streakCountEl.textContent = appState.streak;

    const streakBadge = document.getElementById("streak-badge");
    const streakIcon = document.getElementById("streak-icon");
    if (appState.streak > 0) {
      if (streakIcon) streakIcon.classList.remove("off");
      if (appState.streak >= 3 && streakBadge) {
        streakBadge.classList.add("active-streak");
      }
    } else {
      if (streakIcon) streakIcon.classList.add("off");
      if (streakBadge) streakBadge.classList.remove("active-streak");
    }

    // Guvohnoma
    const cName = document.getElementById("cert-user-name");
    if (cName) cName.textContent = nameStr;

    const cRank = document.getElementById("cert-user-rank");
    if (cRank) cRank.textContent = rankStr;

    const cCorr = document.getElementById("cert-correct");
    if (cCorr) cCorr.textContent = appState.totalCorrect;

    const cStr = document.getElementById("cert-streak");
    if (cStr) cStr.textContent = appState.streak + " kun";

    const cDate = document.getElementById("cert-date");
    if (cDate) cDate.textContent = new Date().toLocaleDateString("uz-UZ");
  }

  // 4. Guvohnoma Ochilganda Stamp Effekti
  function triggerCertStamp() {
    const stamp = document.querySelector('.cert-stamp');
    if (stamp) {
      stamp.classList.remove('stamp-anim');
      void stamp.offsetWidth; // Reflow
      stamp.classList.add('stamp-anim');
    }
    haptic('success');
  }

  // Navigatsiya
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      haptic("click");
      document.querySelectorAll(".bottom-nav .nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      const tabEl = document.getElementById(targetTab);
      if (tabEl) {
        tabEl.classList.add("active");
        tabEl.classList.remove("slide-active");
        void tabEl.offsetWidth; // Reflow
        tabEl.classList.add("slide-active");
      }

      if (targetTab === "tab-leaderboard") fetchLeaderboard();
      if (targetTab === "tab-library") fetchLibrary();
      if (targetTab === "tab-cert") triggerCertStamp();
    });
  });

  // Level va Manifest ma'lumotlarini o'qish
  async function initApp() {
    try {
      const resLvl = await fetch("levels.json");
      appState.levels = await resLvl.json();

      const resMan = await fetch("manifest.json");
      appState.manifest = await resMan.json();

      renderTopics();
      loadUserData();
    } catch (e) {
      console.error("Initsializatsiya xatosi:", e);
    }
  }

  function renderTopics() {
    const listEl = document.getElementById("topics-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    appState.manifest.forEach(m => {
      const btn = document.createElement("button");
      btn.className = "list-item-btn";
      btn.style.width = "100%";
      btn.innerHTML = `<span>📖 ${m.title}</span> <span>→</span>`;
      btn.onclick = () => {
        haptic("click");
        startQuiz(m.file);
      };
      listEl.appendChild(btn);
    });
  }

  async function startQuiz(file) {
    try {
      const res = await fetch(file);
      const rawQuestions = await res.json();
      
      const shuffled = [...rawQuestions].sort(() => 0.5 - Math.random());
      appState.currentQuiz = shuffled.slice(0, 30);
      appState.currentQIndex = 0;
      appState.blockCorrect = 0;
      appState.blockTotal = appState.currentQuiz.length;

      document.getElementById("topic-select-view").classList.add("hidden");
      document.getElementById("quiz-view").classList.remove("hidden");
      renderQuestion();
    } catch (e) {
      alert("Test savollarini yuklab bo'lmadi.");
    }
  }

  function triggerQuizSlide() {
    const card = document.getElementById('question-card');
    if (card) {
      card.classList.remove('slide-active');
      void card.offsetWidth; // Reflow
      card.classList.add('slide-active');
    }
  }

  function renderQuestion() {
    triggerQuizSlide();

    const q = appState.currentQuiz[appState.currentQIndex];
    document.getElementById("quiz-progress").textContent = `${appState.currentQIndex + 1} / ${appState.blockTotal}`;
    document.getElementById("quiz-progress-bar").style.width = `${((appState.currentQIndex + 1) / appState.blockTotal) * 100}%`;
    document.getElementById("analysis-panel").classList.add("hidden");

    const qTextEl = document.getElementById("question-text");
    qTextEl.textContent = q.q;

    const optsContainer = document.getElementById("options-container");
    optsContainer.innerHTML = "";

    const optsWithIndex = q.o.map((opt, idx) => ({ text: opt, originalIndex: idx }));
    optsWithIndex.sort(() => 0.5 - Math.random());

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    optsWithIndex.forEach((item, displayIdx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";

      const letterBadge = document.createElement("span");
      letterBadge.className = "option-letter";
      letterBadge.textContent = letters[displayIdx] || (displayIdx + 1);

      const textSpan = document.createElement("span");
      textSpan.textContent = item.text;

      btn.appendChild(letterBadge);
      btn.appendChild(textSpan);

      btn.onclick = () => selectAnswer(btn, item.originalIndex, q, letterBadge);
      optsContainer.appendChild(btn);
    });
  }

  function selectAnswer(btnEl, selectedIndex, question, letterBadge) {
    const allBtns = document.querySelectorAll(".option-btn");
    allBtns.forEach(b => b.disabled = true);

    if (selectedIndex === question.a) {
      haptic("success");
      btnEl.classList.add("correct");
      if (letterBadge) letterBadge.textContent = "✓";
      appState.totalCorrect++;
      appState.blockCorrect++;
    } else {
      haptic("error");
      btnEl.classList.add("wrong");
      if (letterBadge) letterBadge.textContent = "✕";

      allBtns.forEach(b => {
        const spanText = b.querySelector("span:not(.option-letter)");
        if (spanText && spanText.textContent === question.o[question.a]) {
          b.classList.add("correct");
          const lBadge = b.querySelector(".option-letter");
          if (lBadge) lBadge.textContent = "✓";
        }
      });
    }

    const analysisPanel = document.getElementById("analysis-panel");
    const analysisText = document.getElementById("analysis-text");
    analysisText.textContent = question.why || "Tahlil mavjud emas.";

    const lexBtn = document.getElementById("btn-lex-link");
    if (question.lex && question.lex.doc) {
      lexBtn.classList.remove("hidden");
      lexBtn.onclick = () => {
        const docClean = question.lex.doc.replace(/[^0-9-]/g, "");
        const anchorClean = question.lex.anchor ? question.lex.anchor.replace(/[^0-9-]/g, "") : "";
        let url = "https://lex.uz/docs/" + docClean;
        if (anchorClean) url += "#" + anchorClean;

        if (tg && tg.openLink) {
          tg.openLink(url);
        } else {
          window.open(url, "_blank");
        }
      };
    } else {
      lexBtn.classList.add("hidden");
    }

    analysisPanel.classList.remove("hidden");
  }

  document.getElementById("btn-next-question").onclick = () => {
    haptic("click");
    appState.currentQIndex++;
    if (appState.currentQIndex < appState.blockTotal) {
      renderQuestion();
    } else {
      finishQuizBlock();
    }
  };

  function finishQuizBlock() {
    const today = new Date().toISOString().split("T")[0];
    if (appState.lastStreakDate !== today) {
      appState.streak++;
      appState.lastStreakDate = today;
    }
    saveUserData();
    updateUI();

    const currentRank = getRankTitle(appState.totalCorrect);
    const certMsg = `Blok yakunlandi!\nNatija: ${appState.blockCorrect} / ${appState.blockTotal}\nSizning unvoningiz: ${currentRank}`;

    alert(certMsg);

    if (tg && tg.sendData) {
      if (confirm("Natijangizni haftalik TOP-10 reytingiga yuborasizmi?")) {
        tg.sendData(JSON.stringify({
          v: 1,
          t: "score",
          c: appState.blockCorrect,
          n: appState.blockTotal
        }));
      }
    }

    document.getElementById("quiz-view").classList.add("hidden");
    document.getElementById("topic-select-view").classList.remove("hidden");
  }

  document.getElementById("btn-back-topics").onclick = () => {
    haptic("click");
    document.getElementById("quiz-view").classList.add("hidden");
    document.getElementById("topic-select-view").classList.remove("hidden");
  };

  document.getElementById("btn-start-quick").onclick = () => {
    haptic("click");
    document.querySelectorAll(".bottom-nav .nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    
    const testNavItem = document.querySelector('[data-tab="tab-tests"]');
    if (testNavItem) testNavItem.classList.add("active");

    const testTab = document.getElementById("tab-tests");
    if (testTab) {
      testTab.classList.add("active");
      testTab.classList.remove("slide-active");
      void testTab.offsetWidth;
      testTab.classList.add("slide-active");
    }
  };

  async function fetchLeaderboard() {
    const listEl = document.getElementById("leaderboard-list");
    if (!listEl) return;
    listEl.innerHTML = "<li>Yuklanmoqda...</li>";
    try {
      const res = await fetch(RAW_BASE + "leaderboard.json?v=" + Date.now());
      if (!res.ok) throw new Error();
      const data = await res.json();
      listEl.innerHTML = "";
      if (data.length === 0) {
        listEl.innerHTML = "<li>Hozircha reyting ma'lumotlari yo'q</li>";
        return;
      }

      const maxScore = data[0] ? data[0].score : 1;

      data.forEach((item, index) => {
        const li = document.createElement("li");
        let rankClass = "";
        let medal = `#${index + 1}`;

        if (index === 0) { rankClass = "rank-1"; medal = "🥇"; }
        else if (index === 1) { rankClass = "rank-2"; medal = "🥈"; }
        else if (index === 2) { rankClass = "rank-3"; medal = "🥉"; }

        li.className = `leaderboard-item ${rankClass}`;
        const percent = Math.min(Math.round((item.score / maxScore) * 100), 100);

        li.innerHTML = `
          <div class="leaderboard-item-row">
            <span>${medal} ${item.name}</span>
            <span class="score-pill">${item.score} ball</span>
          </div>
          <div class="leaderboard-bar-track">
            <div class="leaderboard-bar-fill" style="width: ${percent}%;"></div>
          </div>
        `;
        listEl.appendChild(li);
      });
    } catch (e) {
      listEl.innerHTML = "<li>Reyting ma'lumotlarini yuklab bo'lmadi.</li>";
    }
  }

  async function fetchLibrary() {
    const docsListEl = document.getElementById("library-docs-list");
    if (docsListEl) docsListEl.innerHTML = "Yuklanmoqda...";
    try {
      const res = await fetch(RAW_BASE + "library.json?v=" + Date.now());
      if (!res.ok) throw new Error();
      const docs = await res.json();
      if (docsListEl) {
        docsListEl.innerHTML = "";
        docs.forEach(d => {
          const item = document.createElement("div");
          item.className = "list-item";
          item.innerHTML = `
            <div>
              <strong>${d.t}</strong>
              <div style="font-size:11px; color:var(--text-sub);">${d.s || ""}</div>
            </div>
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px; width:auto;">Ochish</button>
          `;
          item.querySelector("button").onclick = () => {
            const url = `https://t.me/${cfg.botUsername || "huquqmindBot"}?start=lib_${d.id}`;
            if (tg && tg.openTelegramLink) {
              tg.openTelegramLink(url);
            } else {
              window.open(url, "_blank");
            }
          };
          docsListEl.appendChild(item);
        });
      }
    } catch (e) {
      if (docsListEl) docsListEl.innerHTML = "Darsliklar mavjud emas.";
    }

    try {
      const resLaws = await fetch("laws.json");
      const laws = await resLaws.json();
      const lawsListEl = document.getElementById("library-laws-list");
      if (lawsListEl) {
        lawsListEl.innerHTML = "";
        laws.forEach(l => {
          const item = document.createElement("div");
          item.className = "list-item";
          item.innerHTML = `
            <div>
              <strong>${l.n}. ${l.title}</strong>
            </div>
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px; width:auto;">Lex.uz</button>
          `;
          item.querySelector("button").onclick = () => {
            if (tg && tg.openLink) {
              tg.openLink(l.url);
            } else {
              window.open(l.url, "_blank");
            }
          };
          lawsListEl.appendChild(item);
        });
      }
    } catch (e) {}
  }

  const subDocsBtn = document.getElementById("btn-sub-docs");
  if (subDocsBtn) {
    subDocsBtn.onclick = function () {
      this.classList.add("active");
      document.getElementById("btn-sub-laws").classList.remove("active");
      document.getElementById("library-docs-list").classList.remove("hidden");
      document.getElementById("library-laws-list").classList.add("hidden");
    };
  }

  // Fix 2: 52 Hujjat tugmasi bosilganda to'g'ri ro'yxatni ko'rsatish
  const subLawsBtn = document.getElementById("btn-sub-laws");
  if (subLawsBtn) {
    subLawsBtn.onclick = function () {
      this.classList.add("active");
      document.getElementById("btn-sub-docs").classList.remove("active");
      document.getElementById("library-docs-list").classList.add("hidden");
      document.getElementById("library-laws-list").classList.remove("hidden");
    };
  }

  initApp();
})();
