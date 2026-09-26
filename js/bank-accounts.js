// SINA Admin - Company Bank Accounts Controller
(function() {
  let allAccounts = [];
  let allEntries = [];
  let selectedFilter = 'all';

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
      allAccounts = await window.sinaDB.getCompanyBankAccounts();
      allEntries = await window.sinaDB.getProcurementEntries();
      renderAnalytics();
      renderAccountsCards();
      populateFilterDropdown();
      renderLedgerTable();
    } catch (err) {
      console.error('Failed to load bank accounts data:', err);
      showToast('Error loading accounts data: ' + err.message, 'error');
    }
  }

  function renderAnalytics() {
    const activeCount = allAccounts.filter(a => a.is_active !== false).length;
    let totalDisbursed = 0;
    let totalTxns = 0;

    allEntries.forEach(e => {
      if (e.bank_account_id || e.bank_account_name) {
        totalDisbursed += parseFloat(e.total_amount) || 0;
        totalTxns++;
      }
    });

    const countEl = document.getElementById('kpi-accounts-count');
    const disbursedEl = document.getElementById('kpi-total-disbursed');
    const txnsEl = document.getElementById('kpi-total-txns');

    if (countEl) countEl.textContent = activeCount.toString();
    if (disbursedEl) disbursedEl.textContent = '₹' + totalDisbursed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    if (txnsEl) txnsEl.textContent = totalTxns.toString();
  }

  function renderAccountsCards() {
    const container = document.getElementById('accounts-cards-container');
    if (!container) return;

    if (!allAccounts || allAccounts.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;">
            <polygon points="12 2 2 7 22 7 12 2"/><rect x="4" y="10" width="2" height="9"/><rect x="9" y="10" width="2" height="9"/><rect x="14" y="10" width="2" height="9"/><rect x="19" y="10" width="2" height="9"/><line x1="2" y1="19" x2="22" y2="19"/>
          </svg>
          <div style="font-weight: 700;">No Bank Accounts Configured</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">Click "+ Add Bank Account" above to add your company disbursement accounts.</div>
        </div>`;
      return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">';
    allAccounts.forEach(acc => {
      const accEntries = allEntries.filter(e => e.bank_account_id === acc.id || e.bank_account_name === acc.bank_name);
      const accDisbursed = accEntries.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);
      const isActive = acc.is_active !== false;

      html += `
        <div class="card" style="padding: 16px; border-left: 4px solid ${isActive ? 'var(--green-primary)' : 'var(--text-secondary)'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin: 0;">${acc.bank_name}</h3>
              <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                A/C: ${acc.account_number ? acc.account_number : 'Not set'}
              </div>
            </div>
            <span class="badge" style="background: ${isActive ? '#DCFCE7' : '#F3F4F6'}; color: ${isActive ? '#15803D' : '#6B7280'}; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px;">
              ${isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; font-size: 0.8rem; margin: 10px 0; display: flex; flex-direction: column; gap: 4px;">
            <div><strong>IFSC:</strong> ${acc.ifsc_code || '—'}</div>
            <div><strong>Holder:</strong> ${acc.account_holder || '—'}</div>
            <div><strong>Branch:</strong> ${acc.branch || '—'}</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 6px;">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-secondary);">Disbursed:</div>
              <div style="font-weight: 800; color: var(--green-dark); font-size: 0.95rem;">₹${accDisbursed.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${accEntries.length} bills)</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.editAccount('${acc.id}')" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.toggleAccountActive('${acc.id}', ${!isActive})" style="padding: 4px 8px; font-size: 0.75rem; color: ${isActive ? '#DC2626' : '#15803D'};">
                ${isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function populateFilterDropdown() {
    const sel = document.getElementById('account-filter-select');
    if (!sel) return;

    const current = sel.value || 'all';
    let opts = '<option value="all">All Bank Accounts</option>';
    allAccounts.forEach(acc => {
      opts += `<option value="${acc.id}" ${current === acc.id ? 'selected' : ''}>${acc.bank_name} (${acc.account_number ? '...' + acc.account_number.slice(-4) : ''})</option>`;
    });
    sel.innerHTML = opts;
    selectedFilter = sel.value;
  }

  function renderLedgerTable() {
    const tbody = document.getElementById('account-ledger-tbody') || document.getElementById('account-txns-tbody');
    if (!tbody) return;

    let filtered = allEntries.filter(e => e.bank_account_id || e.bank_account_name);
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(e => e.bank_account_id === selectedFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">No transactions recorded for this account.</td></tr>`;
      return;
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    let html = '';
    filtered.slice(0, 50).forEach(e => {
      const dt = e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const amt = parseFloat(e.total_amount) || 0;
      const bankName = e.bank_account_name || 'Company Account';

      html += `
        <tr>
          <td style="font-size: 0.8rem; white-space: nowrap;">${dt}</td>
          <td><strong style="color: var(--text-primary);">${bankName}</strong></td>
          <td>
            <strong>${e.firm_name || '—'}</strong>
            ${e.bill_number ? `<div style="font-size:0.72rem; color:#6D28D9; font-weight:700;">#${e.bill_number}</div>` : ''}
          </td>
          <td>${e.rep_name || 'Field Rep'}</td>
          <td style="font-weight: 800; color: var(--green-dark);">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="font-size: 0.8rem;">
            <span class="badge" style="background: #F3F4F6; color: #374151; text-transform: uppercase;">${e.payment_mode || 'cash'}</span>
            ${e.upi_utr ? `<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">UTR: ${e.upi_utr}</div>` : ''}
          </td>
          <td>
            <span class="status-badge ${e.status === 'verified' || e.status === 'completed' ? 'completed' : 'pending'}">
              ${e.status === 'verified' || e.status === 'completed' ? 'Verified' : 'Pending'}
            </span>
          </td>
        </tr>`;
    });

    tbody.innerHTML = html;
  }

  function setupEventListeners() {
    const addBtn = document.getElementById('btn-add-account');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openAccountModal();
      });
    }

    const saveBtn = document.getElementById('btn-save-account');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await saveAccountFromModal();
      });
    }

    const filterSel = document.getElementById('account-filter-select');
    if (filterSel) {
      filterSel.addEventListener('change', () => {
        selectedFilter = filterSel.value;
        renderLedgerTable();
      });
    }
  }

  window.openAccountModal = function(acc = null) {
    const modal = document.getElementById('account-modal');
    const title = document.getElementById('modal-account-title') || document.getElementById('account-modal-title');
    const idInp = document.getElementById('acc-id-input');
    const nameInp = document.getElementById('acc-name-input') || document.getElementById('acc-bank-input');
    const numInp = document.getElementById('acc-number-input');
    const ifscInp = document.getElementById('acc-ifsc-input');
    const holderInp = document.getElementById('acc-holder-input');
    const branchInp = document.getElementById('acc-branch-input');

    if (!modal) return;

    if (acc) {
      if (title) title.textContent = 'Edit Bank Account';
      if (idInp) idInp.value = acc.id || '';
      if (nameInp) nameInp.value = acc.bank_name || '';
      if (numInp) numInp.value = acc.account_number || '';
      if (ifscInp) ifscInp.value = acc.ifsc_code || '';
      if (holderInp) holderInp.value = acc.account_holder || '';
      if (branchInp) branchInp.value = acc.branch || '';
    } else {
      if (title) title.textContent = 'Add Bank Account';
      if (idInp) idInp.value = '';
      if (nameInp) nameInp.value = '';
      if (numInp) numInp.value = '';
      if (ifscInp) ifscInp.value = '';
      if (holderInp) holderInp.value = '';
      if (branchInp) branchInp.value = '';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
  };

  window.closeAccountModal = function() {
    const modal = document.getElementById('account-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  window.editAccount = function(id) {
    const acc = allAccounts.find(a => a.id === id);
    if (acc) openAccountModal(acc);
  };

  window.toggleAccountActive = async function(id, newStatus) {
    try {
      await window.sinaDB.updateCompanyBankAccount(id, { is_active: newStatus });
      showToast(newStatus ? 'Account activated' : 'Account deactivated', 'success');
      await loadData();
    } catch (err) {
      showToast('Failed to update account: ' + err.message, 'error');
    }
  };

  async function saveAccountFromModal() {
    const id = document.getElementById('acc-id-input')?.value.trim();
    const bankName = (document.getElementById('acc-name-input') || document.getElementById('acc-bank-input'))?.value.trim();
    const accNumber = document.getElementById('acc-number-input')?.value.trim();
    const ifsc = document.getElementById('acc-ifsc-input')?.value.trim();
    const holder = document.getElementById('acc-holder-input')?.value.trim();
    const branch = document.getElementById('acc-branch-input')?.value.trim();

    if (!bankName) {
      alert('Please enter Bank Name (e.g. HDFC Bank, SBI).');
      return;
    }

    const payload = {
      bank_name: bankName,
      account_number: accNumber || null,
      ifsc_code: ifsc || null,
      account_holder: holder || null,
      branch: branch || null,
      is_active: true
    };

    try {
      if (id) {
        await window.sinaDB.updateCompanyBankAccount(id, payload);
        showToast('Bank Account updated successfully!', 'success');
      } else {
        await window.sinaDB.saveCompanyBankAccount(payload);
        showToast('Bank Account added successfully!', 'success');
      }
      closeAccountModal();
      await loadData();
    } catch (err) {
      alert('Failed to save account: ' + err.message);
    }
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
