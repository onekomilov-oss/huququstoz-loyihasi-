// ==========================================
// HUQUQUSTOZ AKADEMIYASI - ASOSIY MANTIQ (app.js)
// ==========================================

// 1. Telegram API ni ulash
const tg = window.Telegram.WebApp;
tg.expand(); // Ilovani darhol to'liq ekranda ochish

// 2. Sahifa yuklanganda avtomat ishga tushadigan jarayonlar
document.addEventListener('DOMContentLoaded', () => {
  
  // --- A) Telegramdan foydalanuvchi ismini olish ---
  const tgUser = tg.initDataUnsafe?.user;
  
  if (tgUser) {
    const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    
    const userNameEl = document.getElementById('user-name');
    const certNameEl = document.getElementById('cert-user-name');
    
    if (userNameEl) userNameEl.textContent = fullName;
    if (certNameEl) certNameEl.textContent = fullName;
  }

  // --- B) Qonunlar ro'yxatini laws.json dan o'qib ekranga chizish ---
  fetchLawsList();

  // --- C) Pastki menyu (Tab) larni ishlashini ta'minlash ---
  setupTabs();

  // --- D) Kunlik olovchalar (Streak) ni hisoblash ---
  updateStreak();
});

// 3. laws.json faylini o'qib, qonunlarni ekranga chiqaruvchi funksiya
async function fetchLawsList() {
  const lawsContainer = document.getElementById('laws-list');
  if (!lawsContainer) return;
  
  try {
    // laws.json faylidan ma'lumotlarni tortib olish
    const response = await fetch('laws.json');
    if (!response.ok) {
      throw new Error('laws.json faylini o\'qib bo\'lmadi');
    }
    
    const lawsData = await response.json();
    lawsContainer.innerHTML = ''; // "Yuklanmoqda..." ni tozalash
    
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

      // Qonun qutisining ichki dizayni
      link.innerHTML = `
        <span style="font-size: 24px;">📜</span>
        <span>
          <small style="color: var(--text-sub);">Hujjat №${law.n}</small><br>
          <strong>${law.title}</strong>
        </span>
      `;
      
      lawsContainer.appendChild(link);
    });

  } catch (error) {
    console.error(error);
    lawsContainer.innerHTML = '<div>Ma\'lumotlarni yuklashda xatolik yuz berdi. laws.json faylini tekshiring.</div>';
  }
}

// 4. Pastki menyudagi sahifalarni almashtirish funksiyasi
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
      if (activeTab) {
        activeTab.classList.add('active');
      }
    });
  });

  const btnStartQuick = document.getElementById('btn-start-quick');
  if (btnStartQuick) {
    btnStartQuick.addEventListener('click', () => {
      document.querySelector('.nav-item[data-tab="tab-tests"]').click();
    });
  }
}

// 5. Olovchalar (Streak) tizimi
function updateStreak() {
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('lastVisit');
  let streak = parseInt(localStorage.getItem('streakCount')) || 0;

  if (lastVisit !== today) {
    if (lastVisit) {
      const lastDate = new Date(lastVisit);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak += 1;
      } else {
        streak = 1;
      }
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
