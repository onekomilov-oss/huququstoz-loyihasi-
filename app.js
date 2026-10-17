(function () {
  const tg = window.Telegram ? window.Telegram.WebApp : null;
  const cfg = window.HUQUQUSTOZ_CONFIG || { owner: "onekomilov-oss", repo: "huququstoz-loyihasi-" };
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
    document.getElementById("external-warning").classList.remove("hidden");
    return;
  }

  document.getElementById("app").classList.remove("hidden");
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

    document.getElementById("user-name").textContent = nameStr;
    document.getElementById("user-rank").textContent = rankStr;
    document.getElementById("stat-correct").textContent = appState.totalCorrect;
    document.getElementById("stat-streak").textContent = appState.streak;
    document.getElementById("streak-count").textContent = appState.streak;

    const streakIcon = document.getElementById("streak-icon");
    if (appState.streak > 0) {
      streakIcon.classList.remove("off");
    } else {
      streakIcon.classList.add("off");
    }

    // Guvohnoma
    document.getElementById("cert-user-name").textContent = nameStr;
    document.getElementById("cert-user-rank").textContent = rankStr;
    document.getElementById("cert-correct").textContent = appState.totalCorrect;
    document.getElementById("cert-streak").textContent = appState.streak + " kun";
    document.getElementById("cert-date").textContent = new Date().toLocaleDateString("uz-UZ");
  }

  // Navigatsiya
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      haptic("click");
      document.querySelectorAll(".bottom-nav .nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");

      if (targetTab === "tab-leaderboard") fetchLeaderboard();
      if (targetTab === "tab-library") fetchLibrary();
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
      
      // Maksimal 30 ta savolni tanlash
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

    const qTextEl = document.getElementById("question-text");
    qTextEl.textContent = q.q;

    const optsContainer = document.getElementById("options-container");
    optsContainer.innerHTML = "";

    // Indekslarni saqlab aralashtirish
    const optsWithIndex = q.o.map((opt, idx) => ({ text: opt, originalIndex: idx }));
    optsWithIndex.sort(() => 0.5 - Math.random());

    optsWithIndex.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = item.text;
      btn.onclick = () => selectAnswer(btn, item.originalIndex, q);
      optsContainer.appendChild(btn);
    });
  }

  function selectAnswer(btnEl, selectedIndex, question) {
    const allBtns = document.querySelectorAll(".option-btn");
    allBtns.forEach(b => b.disabled = true);

    if (selectedIndex === question.a) {
      haptic("success");
      btnEl.classList.add("correct");
      appState.totalCorrect++;
      appState.blockCorrect++;
    } else {
      haptic("error");
      btnEl.classList.add("wrong");
      // To'g'ri javobni ko'rsatish
      allBtns.forEach(b => {
        if (b.textContent === question.o[question.a]) {
          b.classList.add("correct");
        }
      });
    }

    // Tahlil panelini ko'rsatish
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
    // Daily Streak yangilash
    const today = new Date().toISOString().split("T")[0];
    if (appState.lastStreakDate !== today) {
      appState.streak++;
      appState.lastStreakDate = today;
    }
    saveUserData();
    updateUI();

    let certMsg = "";
    const currentRank = getRankTitle(appState.totalCorrect);
    certMsg = `Blok yakunlandi!\nNatija: ${appState.blockCorrect} / ${appState.blockTotal}\nSizning unvoningiz: ${currentRank}`;

    alert(certMsg);

    // Reytingga yuborish
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
    document.querySelector('[data-tab="tab-tests"]').classList.add("active");
    document.getElementById("tab-tests").classList.add("active");
  };

  // Reytingni yuklash
  async function fetchLeaderboard() {
    const listEl = document.getElementById("leaderboard-list");
    listEl.innerHTML = "<li>Yuklanmoqda...</li>";
    try {
      const res = await fetch(RAW_BASE + "leaderboard.json");
      if (!res.ok) throw new Error();
      const data = await res.json();
      listEl.innerHTML = "";
      if (data.length === 0) {
        listEl.innerHTML = "<li>Hozircha reyting ma'lumotlari yo'q</li>";
        return;
      }
      data.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "leaderboard-item";
        li.innerHTML = `<span>#${index + 1} ${item.name}</span> <strong>${item.score} ball</strong>`;
        listEl.appendChild(li);
      });
    } catch (e) {
      listEl.innerHTML = "<li>Reyting ma'lumotlarini yuklab bo'lmadi.</li>";
    }
  }

  // Kutubxona va 52 Hujjat
  async function fetchLibrary() {
    const docsListEl = document.getElementById("library-docs-list");
    docsListEl.innerHTML = "Yuklanmoqda...";
    try {
      const res = await fetch(RAW_BASE + "library.json");
      if (!res.ok) throw new Error();
      const docs = await res.json();
      docsListEl.innerHTML = "";
      docs.forEach(d => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
          <div>
            <strong>${d.t}</strong>
            <div style="font-size:11px; color:var(--text-sub);">${d.s || ""}</div>
          </div>
          <button class="btn btn-secondary" style="padding:6px 10px; font-size:12px;">Ochish</button>
        `;
        item.querySelector("button").onclick = () => {
          const url = `https://t.me/${cfg.botUsername}?start=lib_${d.id}`;
          if (tg && tg.openTelegramLink) {
            tg.openTelegramLink(url);
          } else {
            window.open(url, "_blank");
          }
        };
        docsListEl.appendChild(item);
      });
    } catch (e) {
      docsListEl.innerHTML = "Darsliklar mavjud emas.";
    }

    // 52 Hujjat
    try {
      const resLaws = await fetch("laws.json");
      const laws = await resLaws.json();
      const lawsListEl = document.getElementById("library-laws-list");
      lawsListEl.innerHTML = "";
      laws.forEach(l => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
          <div>
            <strong>${l.n}. ${l.title}</strong>
          </div>
          <button class="btn btn-secondary" style="padding:6px 10px; font-size:12px;">Lex.uz</button>
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
    } catch (e) {}
  }

  document.getElementById("btn-sub-docs").onclick = function () {
    this.classList.add("active");
    document.getElementById("btn-sub-laws").classList.remove("active");
    document.getElementById("library-docs-list").classList.remove("hidden");
    document.getElementById("library-laws-list").classList.add("hidden");
  };

  document.getElementById("btn-sub-laws").onclick = function () {
    this.classList.add("active");
    document.getElementById("btn-sub-docs").classList.remove("active");
    document.getElementById("library-laws-list").classList.remove("hidden");
    document.getElementById("library-docs-list").classList.add("hidden");
  };

  initApp();
})();
