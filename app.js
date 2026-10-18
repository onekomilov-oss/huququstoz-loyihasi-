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
    // Ism va familiyani birlashtirish
    const fullName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    
    // Asosiy profil va Guvohnoma qismlariga ismni yozish
    const userNameEl = document.getElementById('user-name');
    const certNameEl = document.getElementById('cert-user-name');
    
    if (userNameEl) userNameEl.textContent = fullName;
    if (certNameEl) certNameEl.textContent = fullName;
  }

  // --- B) Qonunlar ro'yxatini ekranga chizish ---
  renderLawsList();

  // --- C) Pastki menyu (Tab) larni ishlashini ta'minlash ---
  setupTabs();
});


// 3. Qonunlarni ekranga chiqaruvchi funksiya
function renderLawsList() {
  const lawsContainer = document.getElementById('laws-list');
  if (!lawsContainer) return;
  
  // config.js dagi lawsData borligini tekshirish
  if (typeof lawsData === 'undefined') {
    lawsContainer.innerHTML = '<div>Ma\'lumotlar yuklanmadi. config.js faylini tekshiring.</div>';
    return;
  }
  
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
}


// 4. Pastki menyudagi sahifalarni almashtirish funksiyasi
function setupTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Barcha tugma va sahifalardan 'active' klassini olib tashlash
      navItems.forEach(nav => nav.classList.remove('active'));
      tabPages.forEach(tab => tab.classList.remove('active'));
      
      // Bosilgan tugmaga 'active' klassini qo'shish
      item.classList.add('active');
      
      // Kerakli sahifani topib, unga ham 'active' klassini qo'shish
      const tabId = item.getAttribute('data-tab');
      const activeTab = document.getElementById(tabId);
      if (activeTab) {
        activeTab.classList.add('active');
      }
    });
  });

  // "Testlarni Boshlash" tugmasi bosilganda "Testlar" bo'limiga o'tkazish
  const btnStartQuick = document.getElementById('btn-start-quick');
  if (btnStartQuick) {
    btnStartQuick.addEventListener('click', () => {
      document.querySelector('.nav-item[data-tab="tab-tests"]').click();
    });
  }
}
