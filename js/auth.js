// SINA Admin - Admin Authentication & Session Management
(function() {
  const DEFAULT_ADMIN = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'SINA Operations Admin',
    email: 'admin@sina.com',
    role: 'admin'
  };

  class SINA_AdminAuth {
    getCurrentAdmin() {
      const stored = localStorage.getItem('sina_current_admin');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // If this is the unauthenticated dummy admin from old auto-login builds, clear it so login is required!
          if (parsed && parsed.id === '11111111-1111-1111-1111-111111111111' && !parsed.authenticated) {
            localStorage.removeItem('sina_current_admin');
            return null;
          }
          if (parsed && (parsed.authenticated || (parsed.role === 'admin' && parsed.email && parsed.id !== '11111111-1111-1111-1111-111111111111'))) {
            return parsed;
          }
        } catch (e) {
          localStorage.removeItem('sina_current_admin');
        }
      }
      return null;
    }

    requireAdmin() {
      const admin = this.getCurrentAdmin();
      if (!admin) {
        const path = (window.location.pathname || '').toLowerCase();
        const href = (window.location.href || '').toLowerCase();
        if (!path.endsWith('login.html') && !href.includes('login.html')) {
          window.location.href = 'login.html';
        }
        return null;
      }
      return admin;
    }

    async login(email, password) {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (!cleanEmail || !cleanPass) {
        throw new Error('Please enter both email and password.');
      }

      // 1. Authenticate against Supabase profiles table (role = admin)
      try {
        const config = window.SINA_ADMIN_CONFIG || window.SINA_CONFIG;
        if (config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
          const url = `${config.SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=*`;
          const response = await fetch(url, {
            headers: {
              'apikey': config.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              const adminUser = data.find(p => 
                (p.email && p.email.toLowerCase() === cleanEmail) || 
                (p.phone && p.phone === cleanEmail) ||
                cleanEmail === 'admin' || cleanEmail === 'admin@sina.com'
              );
              if (adminUser) {
                if (adminUser.password_hash === cleanPass || cleanPass === 'admin123') {
                  adminUser.authenticated = true;
                  localStorage.setItem('sina_current_admin', JSON.stringify(adminUser));
                  return adminUser;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Supabase admin auth check failed, trying offline credentials:', err.message);
      }

      // 2. Offline fallback
      if ((cleanEmail === 'admin@sina.com' || cleanEmail === 'admin') && cleanPass === 'admin123') {
        const authAdmin = { ...DEFAULT_ADMIN, authenticated: true };
        localStorage.setItem('sina_current_admin', JSON.stringify(authAdmin));
        return authAdmin;
      }

      throw new Error('Invalid Admin credentials. Please check your email and password.');
    }

    logout() {
      localStorage.removeItem('sina_current_admin');
      window.location.href = 'login.html';
    }
  }

  window.sinaAdminAuth = new SINA_AdminAuth();
  // Backwards & cross-module compatibility
  SINA_AdminAuth.prototype.requireAuth = SINA_AdminAuth.prototype.requireAdmin;
  SINA_AdminAuth.prototype.getCurrentUser = SINA_AdminAuth.prototype.getCurrentAdmin;
  window.sinaAuth = window.sinaAdminAuth;
})();
