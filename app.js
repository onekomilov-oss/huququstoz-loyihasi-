
 // HUQUQUSTOZ AKADEMIYASI — tuzatilgan app.js

const tg = window.Telegram?.WebApp ?? null;

if (tg) {
  try {
    tg.ready();
    tg.expand();
  } catch (error) {
    console.warn("Telegram WebApp xatosi:", error);
  }
}

let allTests = [];
let currentTopicTests = [];
let currentTestIndex = 0;
let userScore = 0;
let answerSelected = false;
let quizViewTemplate = "";

document.addEventListener("DOMContentLoaded", () => {
  const tgUser = tg?.initDataUnsafe?.user;

  if (tgUser) {
    const fullName = [
      tgUser.first_name,
      tgUser.last_name
    ].filter(Boolean).join(" ");

    setText("user-name", fullName);
    setText("cert-user-name", fullName);
  }

  const quizView = getElement("quiz-view");
  if (quizView) quizViewTemplate = quizView.innerHTML;

  fetchLaws();
  loadTestsData();
  setupTabs();
  updateStreak();
  bindQuizButtons();
  updateGlobalStats();
});

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value ?? "";
}

function bindQuizButtons() {
  const back = getElement("btn-back-topics");
  const next = getElement("btn-next-question");

  if (back) back.addEventListener("click", showTopicsView);
  if (next) next.addEventListener("click", nextQuestion);
}

function showMessage(container, message) {
  container.replaceChildren();
  const div = document.createElement("div");
  div.style.padding = "10px";
  div.textContent = message;
  container.appendChild(div);
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value, window.location.href);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

// QONUNLARNI YUKLASH
async function fetchLaws() {
  const container = getElement("laws-list");
  if (!container) return;

  try {
    const response = await fetch("./laws.json");
    if (!response.ok) throw new Error("laws.json yuklanmadi");

    const laws = await response.json();
    if (!Array.isArray(laws)) throw new Error("JSON formati noto‘g‘ri");

    container.replaceChildren();

    laws.forEach(law => {
      if (!law || typeof law !== "object") return;

      const url = safeHttpUrl(law.url);
      if (!url) return;

      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "glass-card";
      link.style.cssText =
        "display:flex;gap:12px;padding:16px;margin-bottom:10px;" +
        "align-items:center;text-decoration:none;color:var(--text-main)";

      const icon = document.createElement("span");
      icon.style.fontSize = "24px";
      icon.textContent = "📜";

      const details = document.createElement("span");
      const number = document.createElement("small");
      number.style.color = "var(--text-sub)";
      number.textContent = `Hujjat №${law.n ?? "—"}`;

      const title = document.createElement("strong");
      title.textContent = String(law.title ?? "Nomsiz hujjat");

      details.append(number, document.createElement("br"), title);
      link.append(icon, details);
      container.appendChild(link);
    });

    if (!container.childElementCount) {
      showMessage(container, "Hozircha qonunlar mavjud emas.");
    }
  } catch (error) {
    console.error(error);
    showMessage(container, "Qonunlarni yuklab bo‘lmadi.");
  }
}

// TESTLARNI YUKLASH
async function loadTestsData() {
  const container = getElement("topics-list");

  try {
    const response = await fetch("./namuna.json");
    if (!response.ok) throw new Error("namuna.json yuklanmadi");

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Test JSON formati noto‘g‘ri");

    allTests = data.filter(test => {
      const valid = test &&
        typeof test.q === "string" &&
        Array.isArray(test.o) &&
        test.o.length > 1 &&
        Number.isInteger(test.a) &&
        test.a >= 0 &&
        test.a < test.o.length &&
        test.o.every(option => typeof option === "string");

      if (!valid) console.warn("Noto‘g‘ri test:", test);
      return valid;
    });

    renderTopicsList();

    if (!allTests.length && container) {
      showMessage(container, "Hozircha yaroqli testlar mavjud emas.");
    }
  } catch (error) {
    console.error(error);
    if (container) {
      showMessage(container, "Testlarni yuklab bo‘lmadi. namuna.json faylini tekshiring.");
    }
  }
}

// MAVZULAR RO‘YXATI
function renderTopicsList() {
  const container = getElement("topics-list");
  if (!container) return;

  const topics = new Map();

  allTests.forEach(test => {
    const name = typeof test.topic === "string" && test.topic.trim()
      ? test.topic.trim()
      : "Umumiy huquqiy testlar";

    if (!topics.has(name)) topics.set(name, []);
    topics.get(name).push(test);
  });

  container.replaceChildren();

  topics.forEach((tests, name) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "glass-card";
    card.style.cssText =
      "width:100%;text-align:left;padding:16px;margin-bottom:12px;" +
      "cursor:pointer;display:flex;justify-content:space-between;" +
      "align-items:center;border-radius:12px;color:var(--text-main)";

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = name;

    const count = document.createElement("div");
    count.style.cssText =
      "font-size:13px;color:var(--text-sub);margin-top:4px";
    count.textContent = `Savollar soni: ${tests.length} ta`;

    const arrow = document.createElement("span");
    arrow.style.color = "var(--accent)";
    arrow.textContent = "▶";

    details.append(title, count);
    card.append(details, arrow);
    card.addEventListener("click", () => startQuizForTopic(tests));
    container.appendChild(card);
  });
}

// TESTNI BOSHLASH
function startQuizForTopic(tests) {
  if (!Array.isArray(tests) || !tests.length) return;

  currentTopicTests = tests;
  currentTestIndex = 0;
  userScore = 0;
  answerSelected = false;

  updateGlobalStats();

  const topicsView = getElement("topic-select-view");
  const quizView = getElement("quiz-view");

  if (!topicsView || !quizView) {
    console.error("Test oynasi topilmadi.");
    return;
  }

  topicsView.classList.add("hidden");
  quizView.classList.remove("hidden");

  renderQuestion();
}

// MAVZULARGA QAYTISH
function showTopicsView() {
  currentTestIndex = 0;
  userScore = 0;
  answerSelected = false;
  currentTopicTests = [];

  updateGlobalStats();

  const quizView = getElement("quiz-view");
  const topicsView = getElement("topic-select-view");

  if (quizView) quizView.classList.add("hidden");
  if (topicsView) topicsView.classList.remove("hidden");

  restoreQuizView();
}

function restoreQuizView() {
  const quizView = getElement("quiz-view");
  if (!quizView) return;

  if (quizViewTemplate) {
    quizView.innerHTML = quizViewTemplate;
  }

  bindQuizButtons();
}

// SAVOLNI CHIQARISH
function renderQuestion() {
  if (currentTestIndex >= currentTopicTests.length) {
    showQuizFinished();
    return;
  }

  const question = currentTopicTests[currentTestIndex];
  if (!question) return;

  answerSelected = false;

  setText(
    "quiz-progress",
    `${currentTestIndex + 1} / ${currentTopicTests.length}`
  );

  const progress = getElement("quiz-progress-bar");
  if (progress) {
    progress.style.width =
      `${((currentTestIndex + 1) / currentTopicTests.length) * 100}%`;
  }

  setText("question-text", question.q);

  const options = getElement("options-container");
  if (!options) return;

  options.replaceChildren();

  question.o.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "glass-card option-btn";
    button.style.cssText =
      "width:100%;text-align:left;padding:14px;margin-bottom:8px;" +
      "border-radius:10px;color:var(--text-main);cursor:pointer";

    button.textContent = option;
    button.addEventListener("click", () => {
      selectAnswer(index, question.a, question);
    });

    options.appendChild(button);
  });

  const panel = getElement("analysis-panel");
  if (panel) panel.classList.add("hidden");

  const next = getElement("btn-next-question");
  if (next) next.disabled = true;
}

// JAVOBNI TEKSHIRISH
function selectAnswer(selectedIndex, correctIndex, question) {
  if (answerSelected) return;
  answerSelected = true;

  const buttons = document.querySelectorAll(
    "#options-container .option-btn"
  );

  buttons.forEach((button, index) => {
    button.disabled = true;

    if (index === correctIndex) {
      button.style.background = "rgba(40,167,69,0.3)";
      button.style.borderColor = "#28a745";
    } else if (index === selectedIndex) {
      button.style.background = "rgba(220,53,69,0.3)";
      button.style.borderColor = "#dc3545";
    }
  });

  if (selectedIndex === correctIndex) {
    userScore++;
    updateGlobalStats();
  }

  const analysis = getElement("analysis-panel");
  const text = getElement("analysis-text");
  const lex = getElement("btn-lex-link");

  if (lex) lex.style.display = "none";

  if (text) {
    text.textContent = question.why ||
      (selectedIndex === correctIndex
        ? "To‘g‘ri javob!"
        : "Noto‘g‘ri javob. To‘g‘ri javob yashil rangda ko‘rsatilgan.");
  }

  if (analysis) analysis.classList.remove("hidden");

  const next = getElement("btn-next-question");
  if (next) next.disabled = false;
}

// KEYINGI SAVOL
function nextQuestion() {
  if (!answerSelected) return;

  currentTestIndex++;
  renderQuestion();
}

// TEST YAKUNI
function showQuizFinished() {
  const view = getElement("quiz-view");
  if (!view) return;

  const total = currentTopicTests.length;
  const percent = total ? Math.round(userScore / total * 100) : 0;

  view.replaceChildren();

  const card = document.createElement("div");
  card.className = "glass-card";
  card.style.cssText = "text-align:center;padding:30px";

  const heading = document.createElement("h3");
  heading.textContent = "Mavzu yakunlandi!";

  const score = document.createElement("p");
  score.textContent = `To‘g‘ri javoblar: ${userScore} / ${total}`;

  const result = document.createElement("p");
  result.textContent = `Natija: ${percent}%`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-primary btn-lg";
  button.textContent = "Mavzularga qaytish";
  button.addEventListener("click", backToMenu);

  card.append(heading, score, result, button);
  view.appendChild(card);
}

function backToMenu() {
  currentTestIndex = 0;
  userScore = 0;
  answerSelected = false;
  currentTopicTests = [];

  updateGlobalStats();

  const view = getElement("quiz-view");
  const topics = getElement("topic-select-view");

  if (view) view.classList.add("hidden");
  if (topics) topics.classList.remove("hidden");

  restoreQuizView();
  renderTopicsList();
}

function updateGlobalStats() {
  setText("stat-correct", userScore);
  setText("cert-correct", userScore);
}

// MENYULAR
function setupTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".tab-page");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(nav => nav.classList.remove("active"));
      pages.forEach(page => page.classList.remove("active"));

      item.classList.add("active");

      const tab = getElement(item.getAttribute("data-tab"));
      if (tab) tab.classList.add("active");
    });
  });

  const quick = getElement("btn-start-quick");
  if (quick) {
    quick.addEventListener("click", () => {
      const tab = document.querySelector(
        '.nav-item[data-tab="tab-tests"]'
      );
      if (tab) tab.click();
    });
  }
}

// STREAK
function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn("Streak saqlanmadi:", error);
  }
}

function updateStreak() {
  const today = localDateKey();
  const last = safeStorageGet("lastVisit");
  let streak = parseInt(safeStorageGet("streakCount") || "0", 10);

  if (!Number.isFinite(streak) || streak < 0) streak = 0;

  if (last !== today) {
    if (last && /^\d{4}-\d{2}-\d{2}$/.test(last)) {
      const [y, m, d] = last.split("-").map(Number);
      const previous = new Date(y, m - 1, d);
      const current = new Date();
      previous.setHours(0, 0, 0, 0);
      current.setHours(0, 0, 0, 0);

      const days = Math.round((current - previous) / 86400000);
      streak = days === 1 ? streak + 1 : 1;
    } else {
      streak = 1;
    }

    safeStorageSet("lastVisit", today);
    safeStorageSet("streakCount", streak);
  }

  setText("streak-count", streak);
  setText("stat-streak", streak);
  setText("cert-streak", `${streak} kun`);
}
