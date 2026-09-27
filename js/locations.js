// SINA Admin - Field Representative Locations Controller
(function() {
  let repLocations = [];

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await loadLocations();

    const refreshBtn = document.getElementById('btn-refresh-locations');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadLocations();
        refreshBtn.disabled = false;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadLocations();
  };

  async function loadLocations() {
    try {
      repLocations = await window.sinaAdminDB.getLatestRepLocations();
      renderLocations();
    } catch (err) {
      console.warn('Error loading locations:', err);
    }
  }

  function renderLocations() {
    const container = document.getElementById('locations-list-container');
    if (!container) return;

    if (!repLocations || repLocations.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 36px 16px;">
          <p class="text-muted">No representatives found in the directory.</p>
        </div>
      `;
      return;
    }

    let html = '';
    repLocations.forEach(item => {
      const rep = item.rep || {};
      const loc = item.location;
      const initials = (rep.name || 'R').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const phone = rep.phone || 'N/A';
      const route = rep.assigned_route || 'Field Route';

      if (loc && loc.latitude && loc.longitude) {
        const lat = parseFloat(loc.latitude).toFixed(5);
        const lng = parseFloat(loc.longitude).toFixed(5);
        const timeStr = loc.created_at ? new Date(loc.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Recently';
        const dateStr = loc.created_at ? new Date(loc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today';
        const firmName = loc.firms ? (loc.firms.name || '') : (loc.location_name || '');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;

        html += `
          <div class="location-card">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="rep-avatar-circle">${initials}</div>
              <div class="loc-info-col">
                <div class="loc-rep-name">${escapeHtml(rep.name || 'Representative')}</div>
                <div class="loc-sub">Route: ${escapeHtml(route)} • Phone: ${escapeHtml(phone)}</div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="loc-coords-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${lat}, ${lng}
                  </span>
                  <span style="font-size: 0.78rem; color: var(--text-muted);">${dateStr}, ${timeStr}</span>
                  ${firmName ? `<span style="font-size: 0.78rem; font-weight: 600; color: var(--purple-primary);">@ ${escapeHtml(firmName)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="loc-action-col">
              <span class="loc-badge badge-live">Live GPS</span>
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-purple btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Open Google Maps
              </a>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="location-card" style="opacity: 0.85;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="rep-avatar-circle" style="background: var(--bg-secondary); color: var(--text-muted); border-color: var(--border-color);">${initials}</div>
              <div class="loc-info-col">
                <div class="loc-rep-name">${escapeHtml(rep.name || 'Representative')}</div>
                <div class="loc-sub">Route: ${escapeHtml(route)} • Phone: ${escapeHtml(phone)}</div>
                <span class="loc-coords-pill" style="color: var(--text-muted);">No GPS coordinates logged yet</span>
              </div>
            </div>
            <div class="loc-action-col">
              <span class="loc-badge badge-none">No Ping</span>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
