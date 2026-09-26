// SINA Admin - Operational Analytics Controller
(function() {
  let activeTimeframe = 'all';

  const CATEGORY_NAMES = {
    fuel: 'Petrol / Diesel / Fuel',
    vehicle_repair: 'Vehicle Repair & Puncture',
    vehicle_maintenance: 'Vehicle Maintenance',
    bus: 'Bus & Public Transport',
    travel: 'Auto, Toll & Parking',
    food: 'Food & Refreshment',
    toll_market: 'Mandi / Market Fees',
    misc: 'Miscellaneous / Other'
  };

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    setupTimeframeButtons();
    await loadAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadAnalytics();
  };

  function setupTimeframeButtons() {
    const buttons = document.querySelectorAll('.time-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTimeframe = btn.getAttribute('data-time') || 'all';
        await loadAnalytics();
      });
    });
  }

  async function loadAnalytics() {
    const data = await window.sinaAdminDB.getAnalyticsData(activeTimeframe);
    renderOverview(data.overview);
    renderRepRankings(data.repRankings);
    renderTopFirms(data.topFirms);
    renderCommodities(data.commodities);
    renderPaymentModes(data.paymentModes);
    renderExpenseBreakdown(data.expenseBreakdown);
  }

  function renderOverview(ov) {
    const spendEl = document.getElementById('kpi-total-spend');
    const visitsEl = document.getElementById('kpi-total-visits');
    const avgBillEl = document.getElementById('kpi-avg-bill');
    const expEl = document.getElementById('kpi-total-expenses');

    if (spendEl) spendEl.textContent = '₹' + Math.round(ov.totalSpend).toLocaleString('en-IN');
    if (visitsEl) visitsEl.textContent = ov.totalVisits.toLocaleString('en-IN');
    if (avgBillEl) avgBillEl.textContent = '₹' + Math.round(ov.avgBill).toLocaleString('en-IN');
    if (expEl) expEl.textContent = '₹' + Math.round(ov.totalExpenses).toLocaleString('en-IN');
  }

  function renderRepRankings(reps) {
    const tbody = document.getElementById('reps-ranking-tbody');
    if (!tbody) return;

    if (reps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No representative data for this period.</td></tr>`;
      return;
    }

    let html = '';
    reps.forEach((r, idx) => {
      html += `
        <tr>
          <td><span class="rank-num">${idx + 1}</span></td>
          <td>
            <strong>${escapeHtml(r.name)}</strong>
          </td>
          <td><span class="status-badge active">${escapeHtml(r.route)}</span></td>
          <td><strong>${r.visits}</strong></td>
          <td>${r.qty.toFixed(1)} units</td>
          <td><strong style="color: var(--purple-dark); font-size: 0.95rem;">₹${parseFloat(r.spend || 0).toLocaleString('en-IN')}</strong></td>
          <td style="color: var(--danger-color); font-weight: 700;">₹${parseFloat(r.expenses || 0).toLocaleString('en-IN')}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderTopFirms(firms) {
    const tbody = document.getElementById('firms-ranking-tbody');
    if (!tbody) return;

    if (firms.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No merchant firm purchases in this period.</td></tr>`;
      return;
    }

    let html = '';
    firms.slice(0, 15).forEach((f, idx) => {
      html += `
        <tr>
          <td><span class="rank-num">${idx + 1}</span></td>
          <td>
            <strong>${escapeHtml(f.firm_name)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Reps: ${escapeHtml(f.reps || 'Rahul')}</div>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 180px;">${escapeHtml(f.address)}</td>
          <td>
            <div>${escapeHtml(f.contact_person)}</div>
            <a href="tel:${f.mobile}" class="text-purple" style="font-size: 0.8rem;">${f.mobile}</a>
          </td>
          <td><strong>${f.visits_count}</strong></td>
          <td>${f.total_qty.toFixed(1)} units</td>
          <td><strong style="color: var(--success-color); font-size: 1rem;">₹${parseFloat(f.total_spent || 0).toLocaleString('en-IN')}</strong></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderCommodities(commodities) {
    const tbody = document.getElementById('commodities-ranking-tbody');
    if (!tbody) return;

    if (commodities.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No commodity purchases recorded for this period.</td></tr>`;
      return;
    }

    let html = '';
    commodities.forEach(c => {
      const unitLabel = c.unit?.replace('per_', '') || 'unit';
      html += `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td><span class="status-badge active">${escapeHtml(c.category)}</span></td>
          <td><strong>${c.total_qty.toFixed(1)}</strong> ${unitLabel}s</td>
          <td>₹${c.avg_rate.toFixed(2)} / ${unitLabel}</td>
          <td><strong style="color: var(--purple-dark);">₹${parseFloat(c.total_spend || 0).toLocaleString('en-IN')}</strong></td>
          <td>${c.entries_count}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderPaymentModes(modes) {
    const tbody = document.getElementById('payment-modes-tbody');
    if (!tbody) return;

    let html = '';
    modes.forEach(m => {
      html += `
        <tr>
          <td><strong>${escapeHtml(m.mode)}</strong></td>
          <td>${m.count}</td>
          <td><strong>₹${parseFloat(m.total || 0).toLocaleString('en-IN')}</strong></td>
          <td><span class="status-badge active">${m.pct}%</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderExpenseBreakdown(breakdown) {
    const tbody = document.getElementById('expenses-breakdown-tbody');
    if (!tbody) return;

    if (breakdown.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: 16px;">No expenses for this period.</td></tr>`;
      return;
    }

    let html = '';
    breakdown.forEach(b => {
      const catLabel = CATEGORY_NAMES[b.category] || b.category.toUpperCase();
      html += `
        <tr>
          <td><strong>${escapeHtml(catLabel)}</strong></td>
          <td>${b.count}</td>
          <td style="color: var(--danger-color); font-weight: 800;">₹${parseFloat(b.total || 0).toLocaleString('en-IN')}</td>
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
