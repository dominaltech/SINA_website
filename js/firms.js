// SINA Admin - Firms Directory & Itemized Bill History Controller
(function() {
  let allFirms = [];
  let selectedFirmName = null;

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await loadFirmsData();
    setupFilters();
    setupAddFirmModal();
    checkUrlParams();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadFirmsData();
  };

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const firmName = params.get('firm');
    if (firmName) {
      selectFirm(firmName);
    }
  }

  async function loadFirmsData() {
    allFirms = await window.sinaAdminDB.getFirmsSummary();
    renderKpis();
    populateFirmDropdown();
    if (selectedFirmName) {
      const exists = allFirms.find(f => f.firm_name.toLowerCase() === selectedFirmName.toLowerCase());
      if (exists) {
        renderSelectedFirm(exists);
      } else {
        renderAllFirmsTable();
      }
    } else {
      renderAllFirmsTable();
    }
  }

  function renderKpis() {
    const totalSpent = allFirms.reduce((acc, f) => acc + (parseFloat(f.total_spent) || 0), 0);
    const totalVisits = allFirms.reduce((acc, f) => acc + (f.total_visits || (f.visits ? f.visits.length : 0)), 0);

    const countEl = document.getElementById('kpi-firms-count');
    const spentEl = document.getElementById('kpi-total-spent');
    const visitsEl = document.getElementById('kpi-total-visits');

    if (countEl) countEl.textContent = allFirms.length;
    if (spentEl) spentEl.textContent = '₹' + totalSpent.toLocaleString('en-IN');
    if (visitsEl) visitsEl.textContent = totalVisits;
  }

  function populateFirmDropdown() {
    const select = document.getElementById('firm-select-filter');
    if (!select) return;

    let html = '<option value="">-- All Merchant Firms --</option>';
    allFirms.forEach(f => {
      const isSelected = selectedFirmName && selectedFirmName.toLowerCase() === f.firm_name.toLowerCase();
      html += `<option value="${escapeHtml(f.firm_name)}" ${isSelected ? 'selected' : ''}>${escapeHtml(f.firm_name)} (${f.total_visits || (f.visits ? f.visits.length : 0)} bills &bull; ₹${parseFloat(f.total_spent || 0).toLocaleString('en-IN')})</option>`;
    });

    select.innerHTML = html;
  }

  function setupFilters() {
    const select = document.getElementById('firm-select-filter');
    const searchInput = document.getElementById('firm-search-input');
    const resetBtn = document.getElementById('btn-clear-firm-filter');

    if (select) {
      select.addEventListener('change', () => {
        const val = select.value.trim();
        if (val) {
          selectFirm(val);
        } else {
          clearSelection();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!selectedFirmName) {
          renderAllFirmsTable();
        } else {
          // If searching while a firm is selected, filter that firm's bills
          const firm = allFirms.find(f => f.firm_name.toLowerCase() === selectedFirmName.toLowerCase());
          if (firm) renderSelectedFirmBills(firm, query);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', clearSelection);
    }
  }

  window.selectFirm = function(firmName) {
    selectedFirmName = firmName;
    const select = document.getElementById('firm-select-filter');
    if (select) select.value = firmName;

    const firm = allFirms.find(f => f.firm_name.toLowerCase() === firmName.toLowerCase());
    if (firm) {
      renderSelectedFirm(firm);
    } else {
      clearSelection();
    }
  };

  function clearSelection() {
    selectedFirmName = null;
    const select = document.getElementById('firm-select-filter');
    const searchInput = document.getElementById('firm-search-input');
    if (select) select.value = '';
    if (searchInput) searchInput.value = '';

    const selectedView = document.getElementById('selected-firm-view');
    const allView = document.getElementById('all-firms-view');
    if (selectedView) selectedView.style.display = 'none';
    if (allView) allView.style.display = 'block';

    renderAllFirmsTable();
  }

  function renderSelectedFirm(firm) {
    const selectedView = document.getElementById('selected-firm-view');
    const allView = document.getElementById('all-firms-view');
    if (selectedView) selectedView.style.display = 'block';
    if (allView) allView.style.display = 'none';

    // Unique representatives who visited this firm
    const repSet = new Set();
    if (firm.visits) {
      firm.visits.forEach(v => {
        if (v.rep_name) repSet.add(v.rep_name);
      });
    }
    const repsList = Array.from(repSet).join(', ') || 'None assigned yet';

    const banner = document.getElementById('selected-firm-banner');
    if (banner) {
      banner.innerHTML = `
        <div>
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--purple-primary); text-transform: uppercase;">Merchant Firm Overview</div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin: 2px 0 6px 0;">${escapeHtml(firm.firm_name)}</h2>
          <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 4px;">
            Contact: <strong>${escapeHtml(firm.contact_person)}</strong> &bull; <a href="tel:${firm.mobile}" class="text-purple" style="font-weight: 700;">${escapeHtml(firm.mobile)}</a>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escapeHtml(firm.address)}
          </div>
          <div style="font-size: 0.8rem; color: var(--purple-dark); margin-top: 6px;">
            Visiting Representatives: <strong>${escapeHtml(repsList)}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <div class="firm-kpi-pill">
            <div class="firm-kpi-lbl">Total Spent</div>
            <div class="firm-kpi-num">₹${parseFloat(firm.total_spent || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="firm-kpi-pill">
            <div class="firm-kpi-lbl">Bills Logged</div>
            <div class="firm-kpi-num">${firm.visits ? firm.visits.length : 0}</div>
          </div>
        </div>
      `;
    }

    renderSelectedFirmBills(firm);
  }

  function renderSelectedFirmBills(firm, query = '') {
    const tbody = document.getElementById('firm-bills-tbody');
    const countBadge = document.getElementById('firm-bills-count-badge');
    if (!tbody) return;

    let bills = firm.visits || [];
    if (query) {
      bills = bills.filter(b => 
        (b.rep_name && b.rep_name.toLowerCase().includes(query)) ||
        (b.item_name && b.item_name.toLowerCase().includes(query)) ||
        (b.payment_mode && b.payment_mode.toLowerCase().includes(query)) ||
        (b.upi_utr && b.upi_utr.toLowerCase().includes(query))
      );
    }

    if (countBadge) countBadge.textContent = `${bills.length} Bills`;

    if (bills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No bills recorded for this firm matching query.</td></tr>`;
      return;
    }

    let html = '';
    bills.forEach(b => {
      const dateStr = new Date(b.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const hasImages = b.images && b.images.length > 0;
      const isVerified = b.status === 'verified' || b.status === 'completed';

      let paymentBadge = '';
      if (b.payment_mode === 'cash') {
        paymentBadge = '<span class="status-badge active">Cash Paid</span>';
      } else if (b.payment_mode === 'upi') {
        paymentBadge = isVerified 
          ? `<span class="status-badge active">UPI Paid (${b.upi_utr ? 'UTR: ' + escapeHtml(b.upi_utr) : 'Settled'})</span>`
          : '<span class="status-badge pending">UPI Pending Approval</span>';
      } else {
        paymentBadge = `<span class="status-badge ${isVerified ? 'active' : 'pending'}">${b.payment_mode.toUpperCase()}</span>`;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight: 700;">${dateStr}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">ID: ${b.id ? b.id.substring(0, 8) : 'N/A'}</div>
          </td>
          <td>
            <strong>${escapeHtml(b.rep_name || 'Representative')}</strong>
          </td>
          <td>
            <div><strong>${escapeHtml(b.item_name || 'Goods')}</strong></div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${b.quantity} ${b.unit ? b.unit.replace('per_', '') : ''} @ ₹${b.rate}</div>
          </td>
          <td>
            <span style="font-size: 1.05rem; font-weight: 800; color: var(--purple-dark);">₹${parseFloat(b.amount || 0).toLocaleString('en-IN')}</span>
          </td>
          <td>
            ${paymentBadge}
          </td>
          <td>
            ${hasImages ? `
              <div style="display: flex; gap: 4px;">
                ${b.images.map(img => `
                  <img src="${img}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid var(--purple-border); cursor: pointer;" onclick="openFirmImg('${img}')" alt="Bill Proof">
                `).join('')}
              </div>
            ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>'}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderAllFirmsTable() {
    const tbody = document.getElementById('all-firms-tbody');
    if (!tbody) return;

    const query = document.getElementById('firm-search-input')?.value.trim().toLowerCase() || '';

    let filtered = allFirms.filter(f => 
      !query || 
      f.firm_name.toLowerCase().includes(query) || 
      (f.contact_person && f.contact_person.toLowerCase().includes(query)) || 
      (f.mobile && f.mobile.includes(query)) ||
      (f.address && f.address.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No merchant firms found matching your search.</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(f => {
      const visitsCount = f.total_visits || (f.visits ? f.visits.length : 0);
      const spent = parseFloat(f.total_spent || 0);

      html += `
        <tr>
          <td>
            <strong style="font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(f.firm_name)}</strong>
          </td>
          <td>
            <div>${escapeHtml(f.contact_person)}</div>
            <a href="tel:${f.mobile}" class="text-purple" style="font-size: 0.8rem; font-weight: 600;">${escapeHtml(f.mobile)}</a>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 200px;">
            ${escapeHtml(f.address)}
          </td>
          <td>
            <span class="status-badge active" style="font-size: 0.82rem;">${visitsCount} Bills</span>
          </td>
          <td>
            <strong style="color: var(--purple-dark); font-size: 1rem;">₹${spent.toLocaleString('en-IN')}</strong>
          </td>
          <td>
            <a href="firm-detail.html?firm=${encodeURIComponent(f.firm_name)}" class="btn btn-primary btn-sm" style="padding: 6px 14px; font-size: 0.8rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              View History & Reps &rarr;
            </a>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  window.openFirmImg = function(src) {
    const modal = document.getElementById('firm-img-modal');
    const img = document.getElementById('firm-modal-img');
    if (modal && img) {
      img.src = src;
      modal.classList.add('active');
    }
  };

  window.closeFirmImg = function() {
    const modal = document.getElementById('firm-img-modal');
    if (modal) modal.classList.remove('active');
  };

  function setupAddFirmModal() {
    const openBtn = document.getElementById('btn-open-add-firm');
    const closeBtn = document.getElementById('btn-close-firm-modal');
    const modal = document.getElementById('add-firm-modal');
    const form = document.getElementById('add-firm-form');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => modal.classList.add('active'));
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const firmName = document.getElementById('new_firm_name')?.value.trim();
        const contact = document.getElementById('new_contact_person')?.value.trim();
        const mobile = document.getElementById('new_firm_mobile')?.value.trim();
        const address = document.getElementById('new_firm_address')?.value.trim();
        const upi = document.getElementById('new_firm_upi')?.value.trim();

        if (!firmName || !contact || !mobile || !address) {
          alert('Please fill all mandatory fields.');
          return;
        }

        try {
          await window.sinaAdminDB.addFirm({
            firm_name: firmName,
            contact_person: contact,
            mobile: mobile,
            address: address,
            upi_id: upi
          });

          alert(`Firm "${firmName}" added to directory successfully!`);
          form.reset();
          if (modal) modal.classList.remove('active');
          await loadFirmsData();
        } catch (err) {
          alert('Error adding firm: ' + err.message);
        }
      });
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
})();
