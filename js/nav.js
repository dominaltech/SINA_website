// SINA Admin - Navigation Shell, Fixed Taskbar, Top Header & Real-time Alert System
(function() {
  // Zero-Cache Enforcement: Purge any lingering caches immediately on startup
  if (typeof caches !== 'undefined' && caches.keys) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    }).catch(() => {});
  }

  function getActivePage() {
    const p = (window.location.pathname || '').toLowerCase();
    const h = (window.location.href || '').toLowerCase();
    
    if (p.endsWith('receipts.html') || h.includes('receipts.html')) return 'receipts';
    if (p.endsWith('bank-accounts.html') || h.includes('bank-accounts.html')) return 'bank-accounts';
    if (p.endsWith('purchasing-firms.html') || h.includes('purchasing-firms.html')) return 'purchasing-firms';
    if (p.endsWith('sources.html') || h.includes('sources.html')) return 'sources';
    if (p.endsWith('subtypes.html') || h.includes('subtypes.html')) return 'subtypes';
    if (p.endsWith('approvals.html') || h.includes('approvals.html')) return 'approvals';
    if (p.endsWith('representatives.html') || h.includes('representatives.html')) return 'representatives';
    if (p.endsWith('rep-detail.html') || h.includes('rep-detail.html')) return 'representatives';
    if (p.endsWith('locations.html') || h.includes('locations.html')) return 'locations';
    if (p.endsWith('history.html') || h.includes('history.html')) return 'history';
    if (p.endsWith('catalog.html') || h.includes('catalog.html')) return 'catalog';
    if (p.endsWith('firms.html') || h.includes('firms.html')) return 'firms';
    if (p.endsWith('godowns.html') || h.includes('godowns.html')) return 'godowns';
    if (p.endsWith('analytics.html') || h.includes('analytics.html')) return 'analytics';
    if (p.endsWith('login.html') || h.includes('login.html')) return 'login';
    return 'home';
  }

  function renderAdminNav() {
    const activePage = getActivePage();
    if (activePage === 'login') return;

    const admin = window.sinaAdminAuth ? window.sinaAdminAuth.getCurrentAdmin() : null;

    // 1. TOP HEADER TASKBAR
    let topHeader = document.getElementById('sina-admin-header');
    if (!topHeader) {
      topHeader = document.createElement('header');
      topHeader.id = 'sina-admin-header';
      topHeader.className = 'admin-top-bar';
      if (document.body) document.body.prepend(topHeader);
    }
    const currentLangCode = (localStorage.getItem('sina_app_language') || 'en').toLowerCase();
    topHeader.innerHTML = `
      <div class="top-bar-left">
        <button id="admin-drawer-toggle-btn" class="icon-btn" aria-label="Open menu" type="button">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="admin-branding" style="display: flex; align-items: center; gap: 8px;">
          <img src="assets/logo.png" alt="SINA" style="width: 32px; height: 32px; object-fit: contain; border-radius: 6px; border: 1px solid var(--brand-green-border);">
          <span class="brand-name" style="color: var(--brand-green-dark); font-weight: 900;">SINA</span>
          <span class="admin-tag" style="background: var(--brand-orange); color: #FFFFFF; font-weight: 800; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">ADMIN</span>
        </div>
      </div>
      <div class="top-bar-right">
        <!-- Language Selector Dropdown Toggle -->
        <div class="lang-selector-wrap" id="lang-selector-container" style="position: relative; display: inline-flex; align-items: center;">
          <button type="button" id="lang-menu-btn" class="lang-pill-btn" aria-label="Select Language" style="display: inline-flex; align-items: center; gap: 5px; background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 9999px; padding: 4px 10px; font-size: 0.78rem; font-weight: 800; color: #1E293B; cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span id="current-lang-label">${currentLangCode.toUpperCase()}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="lang-dropdown-menu" id="lang-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 6px); right: 0; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 12px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18); min-width: 175px; z-index: 99999; flex-direction: column; padding: 6px; gap: 4px; box-sizing: border-box;">
            <div class="lang-option ${currentLangCode === 'en' ? 'active' : ''}" data-lang="en">
              <span class="lang-name">English</span>
              <span class="lang-code">EN</span>
            </div>
            <div class="lang-option ${currentLangCode === 'hi' ? 'active' : ''}" data-lang="hi">
              <span class="lang-name">हिन्दी (Hindi)</span>
              <span class="lang-code">HI</span>
            </div>
            <div class="lang-option ${currentLangCode === 'mr' ? 'active' : ''}" data-lang="mr">
              <span class="lang-name">मराठी (Marathi)</span>
              <span class="lang-code">MR</span>
            </div>
          </div>
        </div>

        <!-- 1. Refresh Button (Immediate left of notifications) -->
        <button id="admin-refresh-btn" class="icon-btn refresh-btn" title="Instant Refresh Data" aria-label="Refresh" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>

        <!-- 2. Live Alerts & Notifications Bell Button -->
        <button id="admin-notif-btn" class="icon-btn notif-bell-btn" title="Live Alerts & Requests" type="button" style="position: relative; display: inline-flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span id="admin-header-notif-badge" class="notif-counter" style="display: none; position: absolute; top: -2px; right: -2px; background: #DC2626; color: #FFFFFF; border-radius: 9999px; font-size: 0.65rem; font-weight: 800; padding: 1px 5px; min-width: 16px; text-align: center; border: 1.5px solid #FFFFFF; line-height: 1;">0</span>
        </button>
      </div>
    `;
    if (document.body && !topHeader.parentElement) {
      document.body.prepend(topHeader);
    }

    // 2. FIXED BOTTOM TASKBAR (5 Primary Tabs)
    let bottomNav = document.getElementById('admin-bottom-nav');
    if (!bottomNav) {
      bottomNav = document.createElement('nav');
      bottomNav.id = 'admin-bottom-nav';
      bottomNav.className = 'admin-bottom-nav';
      document.body.appendChild(bottomNav);
    }
    bottomNav.innerHTML = `
      <a href="index.html" class="admin-nav-item ${activePage === 'home' ? 'active' : ''}" id="admin-nav-home">
        <span class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </span>
        <span class="nav-text-label">Dashboard</span>
      </a>
      <a href="approvals.html" class="admin-nav-item ${activePage === 'approvals' ? 'active' : ''}" id="admin-nav-approvals">
        <span class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span id="admin-approvals-badge" class="admin-nav-badge"></span>
        </span>
        <span class="nav-text-label">Approvals</span>
      </a>
      <a href="representatives.html" class="admin-nav-item ${activePage === 'representatives' ? 'active' : ''}" id="admin-nav-reps">
        <span class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <span class="nav-text-label">Reps</span>
      </a>
      <a href="firms.html" class="admin-nav-item ${activePage === 'firms' ? 'active' : ''}" id="admin-nav-firms">
        <span class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </span>
        <span class="nav-text-label">Firms</span>
      </a>
      <a href="history.html" class="admin-nav-item ${activePage === 'history' ? 'active' : ''}" id="admin-nav-history">
        <span class="nav-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
        <span class="nav-text-label">History</span>
      </a>
    `;

    // 3. SLIDE-OUT DRAWER NAVIGATION
    let drawer = document.getElementById('sina-admin-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'sina-admin-drawer';
      drawer.className = 'sina-drawer';
      if (document.body) document.body.appendChild(drawer);
    }
    drawer.innerHTML = `
      <div class="drawer-backdrop" id="admin-drawer-backdrop"></div>
      <div class="drawer-panel">
        <div class="drawer-header admin-grad-header">
          <div class="rep-avatar-box">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="rep-info">
            <h4 class="rep-name" id="drawer-admin-name">${admin ? admin.name : 'Operations Admin'}</h4>
            <span class="rep-phone" id="drawer-admin-email">${admin ? admin.email : 'admin@sina.com'}</span>
            <span class="rep-route-pill">Super Admin</span>
          </div>
          <button class="icon-btn close-drawer-btn" id="close-admin-drawer-btn" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Drawer Language Switcher -->
        <div class="drawer-lang-section" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary);">
          <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Language / भाषा
          </span>
          <div style="display: flex; gap: 6px;" id="drawer-lang-group">
            <button type="button" class="drawer-lang-btn ${currentLangCode === 'en' ? 'active' : ''}" data-lang="en">EN</button>
            <button type="button" class="drawer-lang-btn ${currentLangCode === 'hi' ? 'active' : ''}" data-lang="hi">हिन्दी</button>
            <button type="button" class="drawer-lang-btn ${currentLangCode === 'mr' ? 'active' : ''}" data-lang="mr">मराठी</button>
          </div>
        </div>

        <nav class="drawer-nav">
          <a href="index.html" class="drawer-link" id="drawer-link-home">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
            <span class="nav-label">Operations Dashboard</span>
          </a>
          <a href="representatives.html" class="drawer-link" id="drawer-link-reps">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <span class="nav-label">Representatives & Passwords</span>
          </a>
          <a href="history.html" class="drawer-link" id="drawer-link-history">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <span class="nav-label">Purchase History</span>
          </a>
          <a href="receipts.html" class="drawer-link" id="drawer-link-receipts">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
            <span class="nav-label">Receipts & Vouchers</span>
          </a>
          <a href="bank-accounts.html" class="drawer-link" id="drawer-link-banks">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 22 7 12 2"/><rect x="4" y="10" width="2" height="9"/><rect x="9" y="10" width="2" height="9"/><rect x="14" y="10" width="2" height="9"/><rect x="19" y="10" width="2" height="9"/><line x1="2" y1="19" x2="22" y2="19"/></svg></span>
            <span class="nav-label">Company Bank Accounts</span>
          </a>
          <a href="purchasing-firms.html" class="drawer-link" id="drawer-link-purchasing-firms">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span>
            <span class="nav-label">Our Purchasing Firms</span>
          </a>
          <a href="sources.html" class="drawer-link" id="drawer-link-sources">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>
            <span class="nav-label">Procurement Sources</span>
          </a>
          <a href="catalog.html" class="drawer-link" id="drawer-link-catalog">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
            <span class="nav-label">Commodities & Product Master</span>
          </a>
          <a href="firms.html" class="drawer-link" id="drawer-link-firms">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
            <span class="nav-label">Firms Directory</span>
          </a>
          <a href="godowns.html" class="drawer-link" id="drawer-link-godowns">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
            <span class="nav-label">Godowns & Warehouses</span>
          </a>
          <a href="approvals.html" class="drawer-link" id="drawer-link-approvals">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
            <span class="nav-label">Payment Approvals</span>
          </a>
          <a href="analytics.html" class="drawer-link" id="drawer-link-analytics">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
            <span class="nav-label">Operational Analytics</span>
          </a>
          <a href="locations.html" class="drawer-link" id="drawer-link-locations">
            <span class="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
            <span class="nav-label">Field Rep GPS Tracking</span>
          </a>
        </nav>

        <div class="drawer-footer">
          <button type="button" class="btn btn-outline-green btn-block" style="margin-bottom: 8px;" onclick="window.openSettingsModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            App Policies & Settings
          </button>
          <button type="button" class="btn btn-outline-green btn-block" style="color: var(--danger-color); border-color: rgba(220,38,38,0.4); margin-bottom: 8px;" onclick="window.triggerSystemReset()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Reset All Data
          </button>
          <button type="button" class="btn btn-logout btn-block" onclick="window.sinaAdminAuth ? window.sinaAdminAuth.logout() : (window.location.href='login.html')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </div>
    `;
    if (document.body && !document.getElementById('sina-admin-drawer')) {
      document.body.appendChild(drawer);
    }

    // Set Active State on Drawer Links
    const drawerLinks = drawer.querySelectorAll('.drawer-link');
    drawerLinks.forEach(el => el.classList.remove('active'));
    if (activePage === 'home') document.getElementById('drawer-link-home')?.classList.add('active');
    else if (activePage === 'representatives') document.getElementById('drawer-link-reps')?.classList.add('active');
    else if (activePage === 'history') document.getElementById('drawer-link-history')?.classList.add('active');
    else if (activePage === 'receipts') document.getElementById('drawer-link-receipts')?.classList.add('active');
    else if (activePage === 'bank-accounts') document.getElementById('drawer-link-banks')?.classList.add('active');
    else if (activePage === 'purchasing-firms') document.getElementById('drawer-link-purchasing-firms')?.classList.add('active');
    else if (activePage === 'sources') document.getElementById('drawer-link-sources')?.classList.add('active');
    else if (activePage === 'catalog') document.getElementById('drawer-link-catalog')?.classList.add('active');
    else if (activePage === 'firms') document.getElementById('drawer-link-firms')?.classList.add('active');
    else if (activePage === 'approvals') document.getElementById('drawer-link-approvals')?.classList.add('active');
    else if (activePage === 'analytics') document.getElementById('drawer-link-analytics')?.classList.add('active');
    else if (activePage === 'locations') document.getElementById('drawer-link-locations')?.classList.add('active');
    else if (activePage === 'godowns') document.getElementById('drawer-link-godowns')?.classList.add('active');

    // Drawer Event Listeners
    const drawerToggleBtn = document.getElementById('admin-drawer-toggle-btn');
    const closeDrawerBtn = document.getElementById('close-admin-drawer-btn');
    const backdrop = document.getElementById('admin-drawer-backdrop');

    function toggleAdminDrawer(open) {
      if (drawer) {
        if (open) drawer.classList.add('open');
        else drawer.classList.remove('open');
      }
    }

    if (drawerToggleBtn) drawerToggleBtn.onclick = () => toggleAdminDrawer(true);
    if (closeDrawerBtn) closeDrawerBtn.onclick = () => toggleAdminDrawer(false);
    if (backdrop) backdrop.onclick = () => toggleAdminDrawer(false);

    // Setup Language Selector Events (Top Header Dropdown & Drawer Buttons)
    function syncActiveLangUI(lang) {
      const label = document.getElementById('current-lang-label');
      if (label) label.textContent = lang.toUpperCase();

      document.querySelectorAll('.lang-option').forEach(opt => {
        if (opt.getAttribute('data-lang') === lang) opt.classList.add('active');
        else opt.classList.remove('active');
      });

      document.querySelectorAll('.drawer-lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === lang) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    const initialLang = (localStorage.getItem('sina_app_language') || 'en').toLowerCase();
    syncActiveLangUI(initialLang);

    const langBtn = document.getElementById('lang-menu-btn');
    const langMenu = document.getElementById('lang-dropdown-menu');
    if (langBtn && langMenu) {
      langBtn.onclick = (e) => {
        e.stopPropagation();
        const willOpen = !langMenu.classList.contains('active');
        if (willOpen) {
          langMenu.classList.add('active');
          langMenu.style.display = 'flex';
        } else {
          langMenu.classList.remove('active');
          langMenu.style.display = 'none';
        }
      };
      document.addEventListener('click', (e) => {
        if (!langMenu.contains(e.target) && e.target !== langBtn && !langBtn.contains(e.target)) {
          langMenu.classList.remove('active');
          langMenu.style.display = 'none';
        }
      });
    }

    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const lang = opt.getAttribute('data-lang');
        if (lang) {
          localStorage.setItem('sina_app_language', lang);
          syncActiveLangUI(lang);
          if (langMenu) {
            langMenu.classList.remove('active');
            langMenu.style.display = 'none';
          }
          if (window.sinaTranslate) {
            window.sinaTranslate.applyLanguage(lang);
          }
        }
      };
    });

    document.querySelectorAll('.drawer-lang-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const lang = btn.getAttribute('data-lang');
        if (lang) {
          localStorage.setItem('sina_app_language', lang);
          syncActiveLangUI(lang);
          if (window.sinaTranslate) {
            window.sinaTranslate.applyLanguage(lang);
          }
        }
      };
    });

    // Global Toast Notifier
    window.showToast = function(body, title = 'SINA Admin') {
      let container = document.getElementById('admin-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'admin-toast-container';
        container.className = 'admin-toast-container';
        document.body.appendChild(container);
      }
      const card = document.createElement('div');
      card.className = 'admin-toast-card';
      card.innerHTML = `
        <div style="color: var(--purple-primary); margin-top: 2px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div class="toast-title">${title}</div>
          <div class="toast-body">${body}</div>
        </div>
      `;
      container.appendChild(card);
      setTimeout(() => {
        card.style.opacity = '0';
        card.style.transform = 'translateX(100%)';
        setTimeout(() => card.remove(), 300);
      }, 3500);
    };

    // Refresh Button Handler
    const refreshBtn = document.getElementById('admin-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.classList.add('spinning');
        try {
          if (window.refreshAdminData) {
            await window.refreshAdminData();
          } else if (window.refreshCurrentPageData) {
            await window.refreshCurrentPageData();
          } else {
            await new Promise(r => setTimeout(r, 600));
            window.location.reload();
          }
          window.showToast('Data refreshed and updated from cloud.', 'Sync Successful');
        } catch (err) {
          window.showToast('Could not refresh data: ' + (err.message || 'Network error'), 'Refresh Failed');
        } finally {
          setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
        }
      };
    }

    // Settings Modal
    let settingsModal = document.getElementById('admin-settings-modal');
    if (!settingsModal) {
      settingsModal = document.createElement('div');
      settingsModal.id = 'admin-settings-modal';
      settingsModal.className = 'sina-modal-backdrop';
      settingsModal.innerHTML = `
        <div class="sina-modal-card" style="max-width: 480px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="assets/logo.png" alt="SINA" style="width: 28px; height: 28px; object-fit: contain;">
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--green-dark); margin: 0;">App Policies & Permissions</h3>
            </div>
            <button type="button" class="icon-btn" onclick="window.closeSettingsModal()">&times;</button>
          </div>
          <div style="background: var(--bg-secondary); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 12px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 0.95rem; color: var(--text-primary);">Mandatory Expense Receipt Photo</strong>
                <p class="text-muted" style="font-size: 0.78rem; margin: 4px 0 0 0;">Require field reps to upload a bill/receipt photo before an expense can be saved.</p>
              </div>
              <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 12px;">
                <input type="checkbox" id="setting-require-receipt-chk" style="opacity: 0; width: 0; height: 0;">
                <span id="slider-require-receipt" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #CBD5E1; transition: .3s; border-radius: 24px;"></span>
              </label>
            </div>
          </div>
          <div style="background: var(--bg-secondary); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px; border: 1px solid var(--border-color);">
            <strong style="font-size: 0.88rem; display: block; margin-bottom: 10px;">Android System Permissions</strong>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); display: block;">High Priority Alerts</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">Real-time purchase & payment sound/vibration</span>
                </div>
                <span class="badge" style="background: var(--green-tint); color: var(--green-dark); border: 1px solid var(--green-border); font-weight: 700;">Granted</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); display: block;">Location / GPS</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">View field representative live coordinates</span>
                </div>
                <span class="badge" style="background: var(--green-tint); color: var(--green-dark); border: 1px solid var(--green-border); font-weight: 700;">Granted</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); display: block;">Camera & Storage</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">Receipt & passbook review attachments</span>
                </div>
                <span class="badge" style="background: var(--green-tint); color: var(--green-dark); border: 1px solid var(--green-border); font-weight: 700;">Granted</span>
              </div>
            </div>
            <button type="button" class="btn btn-outline-green btn-sm btn-block" onclick="if(window.FlutterBridge){window.FlutterBridge.postMessage(JSON.stringify({action:'OPEN_APP_SETTINGS'}))}else{alert('Available on Android')}" style="font-size: 0.8rem; font-weight: 700;">
              Open Android App Settings
            </button>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeSettingsModal()">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.saveSettings()">Save Configuration</button>
          </div>
        </div>
      `;
      if (document.body) document.body.appendChild(settingsModal);
    }

    const settingsBtn = document.getElementById('admin-settings-btn');
    if (settingsBtn) {
      settingsBtn.onclick = () => {
        window.location.href = 'settings.html';
      };
    }

    // Setup Notification Drawer and Badges
    setupAdminNotificationDrawer();

    // Approvals Notification Badge Check
    (async () => {
      try {
        if (window.sinaAdminDB) {
          const all = await window.sinaAdminDB.getProcurementEntries();
          const pending = all.filter(e =>
            (e.payment_mode === 'upi' || e.payment_mode === 'bank_transfer') &&
            e.status !== 'verified' && e.status !== 'completed'
          );
          const badge = document.getElementById('admin-approvals-badge');
          if (badge) badge.style.display = pending.length > 0 ? 'block' : 'none';
        }
      } catch (e) {}
    })();

    // Listen to Supabase Realtime alerts
    if (window.sinaAdminDB && !window._sina_admin_nav_listener_registered) {
      window._sina_admin_nav_listener_registered = true;
      window.sinaAdminDB.onNewActivity((notif) => {
        showLiveToast(notif);
        updateAdminNotificationsBadge();
        if (window.refreshAdminData) window.refreshAdminData();
      });
    }
  }

  function setupAdminNotificationDrawer() {
    let notifDrawer = document.getElementById('admin-notif-drawer-modal');
    if (!notifDrawer) {
      notifDrawer = document.createElement('div');
      notifDrawer.id = 'admin-notif-drawer-modal';
      notifDrawer.className = 'sina-modal-backdrop';
      notifDrawer.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.5); display:none; justify-content:flex-end; align-items:stretch; transition:all 0.3s;';
      notifDrawer.innerHTML = `
        <div style="background:#FFFFFF; width:88%; max-width:400px; height:100%; display:flex; flex-direction:column; box-shadow:-4px 0 20px rgba(0,0,0,0.25); animation:sinaSlideLeft 0.25s ease;">
          <div style="background:linear-gradient(135deg, #166534, #15803D); color:#FFFFFF; padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <h3 style="margin:0; font-size:1.05rem; font-weight:800;">Alerts & Requests</h3>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" id="admin-mark-all-read-btn" style="background:rgba(255,255,255,0.2); border:none; color:#FFFFFF; padding:4px 8px; border-radius:4px; font-size:0.72rem; font-weight:700; cursor:pointer;">Mark Read</button>
              <button type="button" id="admin-close-notif-btn" style="background:none; border:none; color:#FFFFFF; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
          </div>
          <div id="admin-notif-list-container" style="flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="text-align:center; padding:30px; color:#94A3B8;">Loading notifications...</div>
          </div>
        </div>
      `;
      document.body.appendChild(notifDrawer);
    }

    const notifBtn = document.getElementById('admin-notif-btn');
    if (notifBtn) {
      notifBtn.onclick = () => {
        openAdminNotifications();
      };
    }

    const closeBtn = document.getElementById('admin-close-notif-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        notifDrawer.style.display = 'none';
      };
    }

    const markAllBtn = document.getElementById('admin-mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.onclick = () => {
        markAllAdminNotificationsRead();
      };
    }

    notifDrawer.onclick = (e) => {
      if (e.target === notifDrawer) notifDrawer.style.display = 'none';
    };

    updateAdminNotificationsBadge();
  }

  async function getAdminNotifications() {
    let items = [];
    try {
      if (window.sinaAdminDB && window.sinaAdminDB.supabaseRequest) {
        const remote = await window.sinaAdminDB.supabaseRequest('notifications?target_role=in.(admin,all)&order=created_at.desc&limit=30');
        if (Array.isArray(remote)) items = remote;
      }
    } catch (e) {}

    if (items.length === 0) {
      items = JSON.parse(localStorage.getItem('sina_admin_notifications') || '[]');
    }

    try {
      let entries = [];
      if (window.sinaAdminDB && window.sinaAdminDB.getProcurementEntries) {
        entries = await window.sinaAdminDB.getProcurementEntries();
      } else {
        entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      }

      const readEntries = JSON.parse(localStorage.getItem('sina_read_admin_notifs') || '[]');

      entries.slice(0, 20).forEach(e => {
        const notifId = 'notif_entry_' + e.id;
        const isRead = readEntries.includes(notifId) || e.status === 'verified';
        const amt = parseFloat(e.total_amount || 0).toLocaleString('en-IN');
        const billNum = e.bill_number ? ` (#${e.bill_number})` : '';

        if (!items.some(n => n.id === notifId || n.entry_id === e.id)) {
          let title = '';
          let body = '';
          if (e.status === 'pending_approval' || e.status === 'pending') {
            title = `${(e.payment_mode || 'Payment').toUpperCase()} Request: ₹${amt}`;
            body = `${e.rep_name || 'Field Rep'} at ${e.firm_name || 'Seller'}${billNum}`;
          } else if (e.status === 'cash_issued' || e.payment_mode === 'cash') {
            title = `Cash Purchase: ₹${amt}`;
            body = `${e.rep_name || 'Field Rep'} at ${e.firm_name || 'Seller'}${billNum} (Cash)`;
          } else if (e.status === 'verified') {
            title = `Order Verified: ₹${amt}`;
            body = `${e.firm_name || 'Seller'}${billNum} &bull; Verified`;
          }

          if (title) {
            items.push({
              id: notifId,
              entry_id: e.id,
              title: title,
              body: body,
              created_at: e.created_at || new Date().toISOString(),
              read: isRead,
              screen: 'approvals.html'
            });
          }
        }
      });
    } catch (e) {}

    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return items;
  }

  async function updateAdminNotificationsBadge() {
    const badge = document.getElementById('admin-header-notif-badge');
    if (!badge) return;
    try {
      const notifs = await getAdminNotifications();
      const readEntries = JSON.parse(localStorage.getItem('sina_read_admin_notifs') || '[]');
      const unreadCount = notifs.filter(n => !n.read && !readEntries.includes(n.id)).length;

      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    } catch (e) {
      badge.style.display = 'none';
    }
  }

  window.openAdminNotifications = async function() {
    const drawer = document.getElementById('admin-notif-drawer-modal');
    const container = document.getElementById('admin-notif-list-container');
    if (!drawer || !container) return;

    drawer.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#94A3B8;">Loading notifications...</div>';

    const notifs = await getAdminNotifications();
    const readEntries = JSON.parse(localStorage.getItem('sina_read_admin_notifs') || '[]');

    if (!notifs || notifs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#64748B;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" style="margin-bottom:8px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div style="font-weight:700; color:#334155;">All Caught Up!</div>
          <div style="font-size:0.8rem; margin-top:4px;">No new alerts or requests at this moment.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = notifs.map(n => {
      const isUnread = !n.read && !readEntries.includes(n.id);
      const timeStr = formatNotifTime(n.created_at);
      const hasAction = n.entry_id || (n.screen && n.screen.includes('approvals'));
      const entryId = n.entry_id || (n.payload && n.payload.id) || '';

      return `
        <div onclick="window.onAdminNotifClick('${n.id}', '${entryId}', '${n.screen || 'approvals.html'}')" 
          style="background:${isUnread ? '#F0FDF4' : '#FFFFFF'}; border:1px solid ${isUnread ? '#86EFAC' : '#E2E8F0'}; border-radius:8px; padding:12px; cursor:pointer; transition:all 0.15s ease; position:relative; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          ${isUnread ? '<span style="position:absolute; top:12px; right:12px; width:8px; height:8px; background:#16A34A; border-radius:50%;"></span>' : ''}
          <div style="font-weight:700; font-size:0.88rem; color:#0F172A; margin-bottom:4px; padding-right:16px;">
            ${escapeHtml(n.title)}
          </div>
          <div style="font-size:0.8rem; color:#475569; margin-bottom:6px; line-height:1.4;">
            ${escapeHtml(n.body)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.72rem; color:#94A3B8;">${timeStr}</span>
            ${hasAction ? '<span style="font-size:0.75rem; font-weight:700; color:#166534;">View Order &rarr;</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  };

  window.onAdminNotifClick = function(notifId, entryId, screen) {
    let readEntries = JSON.parse(localStorage.getItem('sina_read_admin_notifs') || '[]');
    if (!readEntries.includes(notifId)) {
      readEntries.push(notifId);
      localStorage.setItem('sina_read_admin_notifs', JSON.stringify(readEntries));
    }
    updateAdminNotificationsBadge();

    const drawer = document.getElementById('admin-notif-drawer-modal');
    if (drawer) drawer.style.display = 'none';

    if (entryId) {
      window.location.href = `approvals.html?entry_id=${encodeURIComponent(entryId)}`;
    } else if (screen) {
      window.location.href = screen;
    }
  };

  window.markAllAdminNotificationsRead = function() {
    getAdminNotifications().then(notifs => {
      const readEntries = notifs.map(n => n.id);
      localStorage.setItem('sina_read_admin_notifs', JSON.stringify(readEntries));
      updateAdminNotificationsBadge();
      openAdminNotifications();
    });
  };

  function formatNotifTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.openSettingsModal = function() {
    window.location.href = 'settings.html';
  };

  window.closeSettingsModal = function() {
    const modal = document.getElementById('admin-settings-modal');
    if (modal) modal.classList.remove('active');
  };

  window.saveSettings = async function() {
    const chk = document.getElementById('setting-require-receipt-chk');
    if (chk && window.sinaAdminDB) {
      const val = chk.checked ? 'true' : 'false';
      await window.sinaAdminDB.setSetting('require_expense_receipt', val);
      alert('Expense Receipt Policy updated to: ' + (chk.checked ? 'MANDATORY' : 'OPTIONAL'));
      window.closeSettingsModal();
    }
  };

  window.triggerSystemReset = async function() {
    if (confirm('Are you sure you want to reset all field data?\n\nThis will wipe all orders, reset field expenses to ₹0, restore fresh morning cash given, and reset representative passwords back to default (rep123).')) {
      if (window.sinaAdminDB) {
        await window.sinaAdminDB.resetAllData();
        alert('All field operations data has been reset to starting fresh state.');
        window.location.reload();
      }
    }
  };

  window.showLiveToast = function(notif) {
    let container = document.getElementById('admin-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'admin-toast-container';
      container.className = 'admin-toast-container';
      if (document.body) document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'admin-toast-card';

    let title = 'New Field Activity';
    let body = 'A representative submitted new data.';

    if (notif.type === 'NEW_PROCUREMENT_ENTRY') {
      title = 'Procurement Logged: ₹' + (notif.payload?.total_amount ? Number(notif.payload.total_amount).toLocaleString('en-IN') : '0');
      body = (notif.payload?.rep_name || 'Rep') + ' at ' + (notif.payload?.firm_name || '') + ' (' + (notif.payload?.payment_mode || '').toUpperCase() + ')';
    } else if (notif.type === 'NEW_EXPENSE') {
      title = 'Expense Logged: ₹' + (notif.payload?.amount || 0);
      body = (notif.payload?.rep_name || 'Rep') + ': ' + (notif.payload?.category || '').toUpperCase() + ' - ' + (notif.payload?.notes || '');
    } else if (notif.type === 'PRODUCT_ADDED') {
      title = 'New Product Added: ' + (notif.payload?.name || '');
      body = (notif.payload?.type || 'Standard') + ' added by field rep';
    } else if (notif.type === 'CATEGORY_ADDED') {
      title = 'New Category Added: ' + (notif.payload?.name || '');
      body = 'Category created by field rep';
    }

    toast.innerHTML = `
      <div class="toast-indicator"></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-body">${body}</div>
      </div>
    `;

    if (container) {
      container.prepend(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
      }, 4500);
    }
  };

  window.initAdminNavigation = renderAdminNav;

  // 4. Register SINA Admin Service Worker & VAPID Push Manager
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          console.log('[SINA Admin] Service Worker registered:', reg.scope);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            window.subscribeUserToPush();
          }
        })
        .catch(err => console.warn('[SINA Admin] SW registration error:', err));
    });
  }

  // Global PWA Install Prompt Capture
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });

  window.addEventListener('appinstalled', () => {
    window.deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-app-installed'));
  });

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  window.subscribeUserToPush = async function(adminId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push messaging not supported in this environment');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg) return null;

      const vapidKey = (window.SINA_CONFIG && window.SINA_CONFIG.VAPID_PUBLIC_KEY) || 'BKAxn-D1otzXlA5c4Vw8WqxEvQ57HAUx5BKy8nL3chRO2z8yJJal-UskoGgcC0ICByPCTBRJkGNxzO4DCUlzrv8';
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      if (subscription) {
        const subJson = subscription.toJSON();
        const p256dh = subJson.keys ? subJson.keys.p256dh : '';
        const auth = subJson.keys ? subJson.keys.auth : '';
        const endpoint = subJson.endpoint;

        const currentAdminId = adminId || (window.sinaAdminAuth?.getCurrentAdmin()?.id) || null;
        const payload = {
          user_id: currentAdminId,
          target_role: 'admin',
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
          language: localStorage.getItem('sina_language') || 'en',
          updated_at: new Date().toISOString()
        };

        const config = window.SINA_CONFIG;
        if (config && config.SUPABASE_URL) {
          fetch(`${config.SUPABASE_URL}/rest/v1/push_subscriptions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(payload)
          }).then(res => console.log('[Push] Admin subscription stored in Supabase:', res.status))
            .catch(err => console.warn('[Push] Error saving admin push subscription:', err));
        }
        return subscription;
      }
    } catch (err) {
      console.warn('[Push] Error in admin subscribeUserToPush:', err);
      return null;
    }
  };

  window.dispatchPushNotification = async function({ user_id, target_role, title, body, data }) {
    const config = window.SINA_CONFIG;

    // 1. Direct native FCM push dispatch via Flutter Bridge (Works when recipient app is closed!)
    if (window.FlutterBridge) {
      try {
        window.FlutterBridge.postMessage(JSON.stringify({
          action: 'SEND_FCM',
          role: target_role || 'representative',
          user_id: user_id || null,
          title: title,
          body: body,
          screen: (data && data.url) ? data.url : (target_role === 'representative' ? 'records.html' : 'approvals.html')
        }));
      } catch (err) {
        console.warn('[Bridge] FCM send error:', err);
      }
    }

    if (!config || !config.SUPABASE_URL) return;

    // 2. Persist notification to Supabase database
    try {
      await fetch(`${config.SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          user_id: user_id || null,
          target_role: target_role || null,
          title: title,
          body: body,
          data: data || {},
          created_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn('[Push] Error writing to notifications table:', e);
    }
  };

  // Immediate execution if DOM is ready, otherwise on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAdminNav);
  } else {
    renderAdminNav();
  }
})();
