// SINA Admin - Dashboard Controller (Dual-View: All Reps vs Particular Rep)
(function() {
  let allReps = [];
  let selectedRepId = null; // null = All Representatives

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await initRepsDropdown();
    await loadDashboard();

    // Wire up filter selector
    const repSelect = document.getElementById('dashboard-rep-filter');
    if (repSelect) {
      repSelect.addEventListener('change', async (e) => {
        selectedRepId = e.target.value || null;
        await loadDashboard();
      });
    }

    setupResetDataModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadDashboard();
  };

  function setupResetDataModal() {
    const triggerBtn = document.getElementById('btn-trigger-reset');
    const modal = document.getElementById('reset-confirm-modal');
    const closeBtn = document.getElementById('btn-close-reset-modal');
    const cancelBtn = document.getElementById('btn-cancel-reset');
    const confirmBtn = document.getElementById('btn-confirm-reset');

    if (!modal) return;

    if (triggerBtn) triggerBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Resetting...';
        try {
          await window.sinaAdminDB.resetAllData();
          modal.classList.remove('active');
          if (window.showLiveToast) {
            window.showLiveToast({
              type: 'SYSTEM_RESET',
              payload: { rep_name: 'Admin', firm_name: 'All Operations Reset', total_amount: 0, payment_mode: 'RESET' }
            });
          }
          await initRepsDropdown();
          await loadDashboard();
          alert('Success: All representative data, orders, and expenses have been reset to a fresh starting state.');
        } catch (err) {
          alert('Error during reset: ' + err.message);
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Yes, Reset All';
        }
      });
    }
  }

  async function initRepsDropdown() {
    allReps = await window.sinaAdminDB.getRepresentatives();
    const repSelect = document.getElementById('dashboard-rep-filter');
    if (!repSelect) return;

    let html = '<option value="">All Field Representatives (Consolidated)</option>';
    allReps.forEach(rep => {
      html += `<option value="${rep.id}">${escapeHtml(rep.name)} (${escapeHtml(rep.assigned_route || 'All Routes')})</option>`;
    });
    repSelect.innerHTML = html;
  }

  async function loadDashboard() {
    const metrics = await window.sinaAdminDB.getAdminDashboardMetrics(selectedRepId);

    // Update KPIs
    const cashOverallEl = document.getElementById('kpi-cash-overall-val');
    if (cashOverallEl) cashOverallEl.textContent = '₹' + metrics.totalCashGivenOverall.toLocaleString('en-IN');

    const cashTodayEl = document.getElementById('kpi-cash-today-val');
    if (cashTodayEl) cashTodayEl.textContent = '₹' + metrics.totalCashGivenToday.toLocaleString('en-IN');

    const procEl = document.getElementById('kpi-procurement-val');
    if (procEl) procEl.textContent = '₹' + metrics.totalProcurement.toLocaleString('en-IN');

    const expEl = document.getElementById('kpi-expenses-val');
    if (expEl) expEl.textContent = '- ₹' + metrics.totalExpenses.toLocaleString('en-IN');

    const netCashEl = document.getElementById('kpi-net-cash-val');
    if (netCashEl) netCashEl.textContent = '₹' + metrics.netCashInHand.toLocaleString('en-IN');

    // Subtitle indicator
    const filterSubtitle = document.getElementById('dashboard-view-scope');
    if (filterSubtitle) {
      if (selectedRepId) {
        const rep = allReps.find(r => r.id === selectedRepId);
        filterSubtitle.textContent = `Showing operations specifically for: ${rep ? rep.name : 'Selected Representative'}`;
      } else {
        filterSubtitle.textContent = 'Showing consolidated operations for all active field representatives';
      }
    }

    renderRecentActivityTable(metrics.recentEntries);
    renderFloatReconCard(metrics);
  }

  function renderFloatReconCard(m) {
    const card = document.getElementById('recon-summary-card');
    if (!card) return;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--purple-primary);">Today's Cash Balance Summary</h3>
          <p class="text-muted" style="font-size: 0.78rem; margin-top: 2px;">Daily summary of cash given, purchases spent, daily expenses, and balance in hand</p>
        </div>
        <span class="status-badge active">Live Balance</span>
      </div>
      <div class="recon-grid">
        <div class="recon-item">
          <div class="recon-item-lbl">Cash Given Today</div>
          <div class="recon-item-val">₹${m.totalCashGivenToday.toLocaleString('en-IN')}</div>
        </div>
        <div class="recon-item">
          <div class="recon-item-lbl">Cash Purchases Spent</div>
          <div class="recon-item-val" style="color: var(--danger-color);">- ₹${(m.todayCashSpent || 0).toLocaleString('en-IN')}</div>
        </div>
        <div class="recon-item">
          <div class="recon-item-lbl">Daily Expenses Spent</div>
          <div class="recon-item-val" style="color: var(--danger-color);">- ₹${m.totalExpenses.toLocaleString('en-IN')}</div>
        </div>
        <div class="recon-item" style="background: var(--purple-tint); border-color: var(--purple-border);">
          <div class="recon-item-lbl" style="color: var(--purple-primary);">Remaining Cash in Hand</div>
          <div class="recon-item-val" style="color: var(--purple-dark);">₹${m.netCashInHand.toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  }

  function renderRecentActivityTable(entries) {
    const tbody = document.getElementById('recent-activity-tbody');
    if (!tbody) return;

    if (!entries || entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No field entries recorded yet today.</td></tr>`;
      return;
    }

    let html = '';
    entries.forEach(e => {
      const timeStr = new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const modeBadge = e.payment_mode === 'cash' ? 'status-badge completed' : (e.payment_mode === 'upi' ? 'status-badge pending' : 'status-badge active');

      html += `
        <tr>
          <td><strong>${timeStr}</strong></td>
          <td><a href="rep-detail.html?id=${e.representative_id}" class="text-purple font-bold">${escapeHtml(e.rep_name || 'Representative')}</a></td>
          <td>${escapeHtml(e.firm_name)}</td>
          <td>${escapeHtml(e.type || e.category_name || 'Goods')} (${e.quantity} ${e.unit?.replace('per_', '')})</td>
          <td><strong>₹${parseFloat(e.total_amount || 0).toLocaleString('en-IN')}</strong></td>
          <td><span class="${modeBadge}">${e.payment_mode.toUpperCase()}</span></td>
          <td>
            <a href="rep-detail.html?id=${e.representative_id}" class="btn btn-secondary btn-sm">Inspect Rep</a>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
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
