(function () {
  const tg = window.Telegram ? window.Telegram.WebApp : null;
  const cfg = window.HUQUQUSTOZ_CONFIG || { 
    owner: "onekomilov-oss", 
    repo: "huququstoz-loyihasi-",
    botUsername: "huquqmindBot"
  };

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

  const currentHour = new Date().getHours();
  if (currentHour >= 6 && currentHour < 20) {
    document.documentElement.setAttribute("data-tone", "day");
  } else {
    document.documentElement.setAttribute("data-tone", "night");
  }

  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    appState.user = tg.initDataUnsafe.user;
  }

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
    if (uNameEl) uNameEl.textContent = nameStr;

    const uRankEl = document.getElementById("user-rank");
    if (uRankEl) uRankEl.textContent = rankStr;

    animateCounter("stat-correct", appState.totalCorrect);
    animateCounter("stat-streak", appState.streak);

    const streakCountEl = document.getElementById("streak-count");
    if (streakCountEl) streakCountEl.textContent = appState.streak;

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

  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      haptic("click");
      document.querySelectorAll(".bottom-nav .nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      const tabEl = document.getElementById(targetTab);
      if (tabEl) tabEl.classList.add("active");

      if (targetTab === "tab-laws") fetchLaws();
    });
  });

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

  async function fetchLaws() {
    const listEl = document.getElementById("laws-list");
    if (!listEl) return;
    try {
      const res = await fetch("laws.json");
      const laws = await res.json();
      listEl.innerHTML = "";
      laws.forEach(l => {
        const btn = document.createElement("button");
        btn.className = "list-item-btn";
        btn.style.width = "100%";
        btn.style.marginBottom = "8px";
        btn.innerHTML = `<span>⚖️ ${l.n}. ${l.title}</span> <span style="font-size:12px; opacity:0.7;">Lex.uz ↗</span>`;
        btn.onclick = () => {
          haptic("click");
          if (tg && tg.openLink) tg.openLink(l.url);
          else window.open(l.url, "_blank");
        };
        listEl.appendChild(btn);
      });
    } catch (e) {
      listEl.innerHTML = "<div>Qonunlar ro'yxatini yuklab bo'lmadi.</div>";
    }
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

  function renderQuestion() {
    const q = appState.currentQuiz[appState.currentQIndex];
    document.getElementById("quiz-progress").textContent = `${appState.currentQIndex + 1} / ${appState.blockTotal}`;
    document.getElementById("quiz-progress-bar").style.width = `${((appState.currentQIndex + 1) / appState.blockTotal) * 100}%`;
    document.getElementById("analysis-panel").classList.add("hidden");

    document.getElementById("question-text").textContent = q.q;
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
    document.getElementById("analysis-text").textContent = question.why || "Tahlil mavjud emas.";

    const lexBtn = document.getElementById("btn-lex-link");
    if (question.lex && question.lex.doc) {
      lexBtn.classList.remove("hidden");
      lexBtn.onclick = () => {
        const docClean = question.lex.doc.replace(/[^0-9-]/g, "");
        const anchorClean = question.lex.anchor ? question.lex.anchor.replace(/[^0-9-]/g, "") : "";
        let url = "https://lex.uz/docs/" + docClean;
        if (anchorClean) url += "#" + anchorClean;

        if (tg && tg.openLink) tg.openLink(url);
        else window.open(url, "_blank");
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
    alert(`Blok yakunlandi!\nNatija: ${appState.blockCorrect} / ${appState.blockTotal}\nSizning unvoningiz: ${currentRank}`);

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
    if (testTab) testTab.classList.add("active");
  };

  initApp();
})();
