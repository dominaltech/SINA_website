// SINA Admin - Our Purchasing Firms Controller
(function() {
  let allFirms = [];
  let allEntries = [];

  async function init() {
    await loadData();
    setupEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshCurrentPageData = async function() {
    await loadData();
  };

  async function loadData() {
    try {
      allFirms = await window.sinaDB.getPurchasingFirms();
      allEntries = await window.sinaAdminDB.getProcurementEntries();
      renderAnalytics();
      renderFirmsCards();
      populateFirmFilterDropdown();
      renderFirmLedger();
    } catch (err) {
      console.error('Failed to load purchasing firms:', err);
      showToast('Error loading purchasing firms: ' + err.message, 'error');
    }
  }

  function renderAnalytics() {
    const activeCount = allFirms.filter(f => f.is_active !== false).length;
    let totalPurchases = 0;
    let billsCount = 0;

    allEntries.forEach(e => {
      if (e.our_firm_id || e.our_firm_name) {
        totalPurchases += parseFloat(e.total_amount) || 0;
        billsCount++;
      }
    });

    const countEl = document.getElementById('kpi-firms-count');
    const purchasesEl = document.getElementById('kpi-total-purchases');
    const billsEl = document.getElementById('kpi-bills-count');

    if (countEl) countEl.textContent = activeCount.toString();
    if (purchasesEl) purchasesEl.textContent = '₹' + totalPurchases.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    if (billsEl) billsEl.textContent = billsCount.toString();
  }

  function renderFirmsCards() {
    const container = document.getElementById('firms-cards-container');
    if (!container) return;

    if (!allFirms || allFirms.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <div style="font-weight: 700;">No Purchasing Firms Added</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">Click "+ Add Purchasing Firm" to register your company's buying entities.</div>
        </div>`;
      return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;">';
    allFirms.forEach(firm => {
      const firmEntries = allEntries.filter(e => e.our_firm_id === firm.id || e.our_firm_name === firm.firm_name);
      const firmTotal = firmEntries.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);
      const isActive = firm.is_active !== false;

      html += `
        <div class="card" style="padding: 16px; border-left: 4px solid ${isActive ? 'var(--green-primary)' : 'var(--text-secondary)'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0;">${firm.firm_name}</h3>
              <div style="font-size: 0.82rem; color: #166534; font-weight: 700; margin-top: 3px;">
                GSTIN: ${firm.gst_number || 'Not Provided'}
              </div>
            </div>
            <span class="badge" style="background: ${isActive ? '#DCFCE7' : '#F3F4F6'}; color: ${isActive ? '#15803D' : '#6B7280'}; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px;">
              ${isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; font-size: 0.82rem; margin: 10px 0; display: flex; flex-direction: column; gap: 4px;">
            <div><strong>Address:</strong> ${firm.address || '—'}</div>
            <div><strong>Phone:</strong> ${firm.phone || firm.mobile || '—'}</div>
            <div><strong>Contact Person:</strong> ${firm.contact_person || '—'}</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 6px;">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-secondary);">Total Billed:</div>
              <div style="font-weight: 800; color: var(--green-dark); font-size: 0.95rem;">₹${firmTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${firmEntries.length} bills)</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.editFirm('${firm.id}')" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.toggleFirmActive('${firm.id}', ${!isActive})" style="padding: 4px 8px; font-size: 0.75rem; color: ${isActive ? '#DC2626' : '#15803D'};">
                ${isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function setupEventListeners() {
    const addBtn = document.getElementById('btn-add-firm');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openFirmModal();
      });
    }

    const saveBtn = document.getElementById('btn-save-firm');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await saveFirmFromModal();
      });
    }
  }

  window.openFirmModal = function(firm = null) {
    const modal = document.getElementById('firm-modal');
    const title = document.getElementById('modal-firm-title');
    const idInp = document.getElementById('pf-id-input');
    const nameInp = document.getElementById('pf-name-input');
    const gstInp = document.getElementById('pf-gst-input');
    const addrInp = document.getElementById('pf-address-input');
    const phoneInp = document.getElementById('pf-phone-input');
    const personInp = document.getElementById('pf-person-input');

    if (!modal) return;

    if (firm) {
      if (title) title.textContent = 'Edit Purchasing Firm';
      if (idInp) idInp.value = firm.id || '';
      if (nameInp) nameInp.value = firm.firm_name || '';
      if (gstInp) gstInp.value = firm.gst_number || '';
      if (addrInp) addrInp.value = firm.address || '';
      if (phoneInp) phoneInp.value = firm.phone || firm.mobile || '';
      if (personInp) personInp.value = firm.contact_person || '';
    } else {
      if (title) title.textContent = 'Add Purchasing Firm';
      if (idInp) idInp.value = '';
      if (nameInp) nameInp.value = '';
      if (gstInp) gstInp.value = '';
      if (addrInp) addrInp.value = '';
      if (phoneInp) phoneInp.value = '';
      if (personInp) personInp.value = '';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
  };

  window.closeFirmModal = function() {
    const modal = document.getElementById('firm-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  window.editFirm = function(id) {
    const firm = allFirms.find(f => f.id === id);
    if (firm) openFirmModal(firm);
  };

  window.toggleFirmActive = async function(id, newStatus) {
    try {
      await window.sinaDB.updatePurchasingFirm(id, { is_active: newStatus });
      showToast(newStatus ? 'Purchasing Firm activated' : 'Purchasing Firm deactivated', 'success');
      await loadData();
    } catch (err) {
      showToast('Failed to update firm: ' + err.message, 'error');
    }
  };

  async function saveFirmFromModal() {
    const id = document.getElementById('pf-id-input')?.value.trim();
    const firmName = document.getElementById('pf-name-input')?.value.trim();
    const gstNumber = document.getElementById('pf-gst-input')?.value.trim();
    const address = document.getElementById('pf-address-input')?.value.trim();
    const phone = document.getElementById('pf-phone-input')?.value.trim();
    const contactPerson = document.getElementById('pf-person-input')?.value.trim();

    if (!firmName) {
      alert('Please enter Firm Name (e.g. SINA Agro Industries Ltd.).');
      return;
    }
    if (!gstNumber) {
      alert('Please enter GSTIN / Tax ID.');
      return;
    }

    const payload = {
      firm_name: firmName,
      gst_number: gstNumber,
      address: address || null,
      phone: phone || null,
      mobile: phone || null,
      contact_person: contactPerson || null,
      is_active: true
    };

    try {
      if (id) {
        await window.sinaDB.updatePurchasingFirm(id, payload);
        showToast('Purchasing Firm updated successfully!', 'success');
      } else {
        await window.sinaDB.savePurchasingFirm(payload);
        showToast('Purchasing Firm added successfully!', 'success');
      }
      closeFirmModal();
      await loadData();
    } catch (err) {
      alert('Failed to save purchasing firm: ' + err.message);
    }
  }

  function populateFirmFilterDropdown() {
    const sel = document.getElementById('firm-filter-select');
    if (!sel) return;
    const curVal = sel.value;
    let opts = '<option value="all">All Purchasing Firms</option>';
    allFirms.forEach(f => {
      opts += `<option value="${f.id}" ${curVal === f.id ? 'selected' : ''}>${f.firm_name}</option>`;
    });
    sel.innerHTML = opts;
    sel.onchange = () => renderFirmLedger();
  }

  function renderFirmLedger() {
    const tbody = document.getElementById('firm-txns-tbody');
    const filterSel = document.getElementById('firm-filter-select');
    if (!tbody) return;

    const filterId = filterSel ? filterSel.value : 'all';
    const txns = allEntries.filter(e => {
      if (filterId === 'all') return e.our_firm_id || e.our_firm_name;
      return e.our_firm_id === filterId || (allFirms.find(f => f.id === filterId && f.firm_name === e.our_firm_name));
    });

    if (txns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No purchase entries found for this purchasing firm.</td></tr>';
      return;
    }

    let rows = '';
    txns.forEach(t => {
      const dtStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const billNum = t.bill_number || ('#G' + (t.id || '').slice(0, 6).toUpperCase());
      const amtStr = '₹' + parseFloat(t.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      const statusBadge = t.status === 'verified' || t.status === 'completed'
        ? '<span class="status-badge completed">Verified</span>'
        : '<span class="status-badge pending">Pending</span>';

      rows += `
        <tr>
          <td><span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${dtStr}</span></td>
          <td><span class="badge" style="background:#EDE9FE; color:#6D28D9; font-weight:800; font-size:0.75rem;">${billNum}</span></td>
          <td><strong style="color: #15803D;">${escapeHtml(t.our_firm_name || 'Assigned Firm')}</strong></td>
          <td><strong>${escapeHtml(t.firm_name || 'Vendor')}</strong></td>
          <td>${escapeHtml(t.rep_name || 'Representative')}</td>
          <td><strong style="color: var(--green-dark);">${amtStr}</strong></td>
          <td>${statusBadge}</td>
        </tr>`;
    });
    tbody.innerHTML = rows;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
})();
