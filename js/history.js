// SINA Admin - Purchase History Controller
(function() {
  let allReps = [];
  let currentPurchases = [];
  let selectedHistoryIds = new Set();

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await initRepsFilter();
    setupEventListeners();
    await loadHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadHistory();
  };

  if (window.sinaAdminDB && window.sinaAdminDB.onNewActivity) {
    window.sinaAdminDB.onNewActivity(() => {
      loadHistory();
    });
  }

  async function initRepsFilter() {
    allReps = await window.sinaAdminDB.getRepresentatives();
    const select = document.getElementById('history-rep-filter');
    if (!select) return;

    let html = '<option value="">All Representatives (Consolidated)</option>';
    allReps.forEach(rep => {
      html += `<option value="${rep.id}">${escapeHtml(rep.name)} (${escapeHtml(rep.assigned_route || 'Field')})</option>`;
    });
    select.innerHTML = html;
  }

  function setupEventListeners() {
    const dateInput = document.getElementById('history-date-filter');
    const todayBtn = document.getElementById('btn-filter-today');
    const allDatesBtn = document.getElementById('btn-filter-all-dates');
    const repSelect = document.getElementById('history-rep-filter');
    const searchInput = document.getElementById('history-search-input');
    const paymentSelect = document.getElementById('history-payment-filter');

    if (dateInput) {
      dateInput.addEventListener('change', () => loadHistory());
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        if (dateInput) {
          dateInput.value = new Date().toISOString().split('T')[0];
          loadHistory();
        }
      });
    }

    if (allDatesBtn) {
      allDatesBtn.addEventListener('click', () => {
        if (dateInput) {
          dateInput.value = '';
          loadHistory();
        }
      });
    }

    if (repSelect) {
      repSelect.addEventListener('change', () => loadHistory());
    }

    if (paymentSelect) {
      paymentSelect.addEventListener('change', () => loadHistory());
    }

    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadHistory(), 250);
      });
    }
  }

  async function loadHistory() {
    const dateVal = document.getElementById('history-date-filter')?.value || '';
    const repIdVal = document.getElementById('history-rep-filter')?.value || '';
    const searchVal = document.getElementById('history-search-input')?.value || '';
    const paymentVal = document.getElementById('history-payment-filter')?.value || 'all';

    // 1. Fetch filtered purchases
    const purchases = await window.sinaAdminDB.getAllPurchases({
      date: dateVal,
      repId: repIdVal,
      search: searchVal,
      paymentMode: paymentVal
    });
    currentPurchases = (purchases || []).sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    // Clean up selected IDs that might no longer exist
    const currentIdSet = new Set(currentPurchases.map(p => p.id));
    selectedHistoryIds = new Set([...selectedHistoryIds].filter(id => currentIdSet.has(id)));
    updateHistoryBatchBar();

    // 2. Compute Summary Stats
    const totalSpent = currentPurchases.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
    const countEl = document.getElementById('history-count');
    const spentEl = document.getElementById('history-total-spent');
    const scopeEl = document.getElementById('history-scope-label');

    if (countEl) countEl.textContent = currentPurchases.length.toString();
    if (spentEl) spentEl.textContent = '₹' + totalSpent.toLocaleString('en-IN');

    // Human description of active filter scope
    let scopeParts = [];
    if (dateVal) {
      const d = new Date(dateVal + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      scopeParts.push(`Date: ${d}`);
    } else {
      scopeParts.push('All Dates');
    }

    if (repIdVal) {
      const r = allReps.find(rep => rep.id === repIdVal);
      scopeParts.push(`Rep: ${r ? r.name : 'Selected Rep'}`);
    } else {
      scopeParts.push('All Representatives');
    }

    if (paymentVal && paymentVal !== 'all') {
      scopeParts.push(`Payment: ${paymentVal.toUpperCase()}`);
    }

    if (searchVal.trim()) {
      scopeParts.push(`Keyword: "${searchVal.trim()}"`);
    }

    if (scopeEl) scopeEl.textContent = scopeParts.join(' • ');

    // 3. Render Results
    renderPurchasesList(currentPurchases);
  }

  function renderPurchasesList(purchases) {
    const container = document.getElementById('history-results-container');
    if (!container) return;

    if (!purchases || purchases.length === 0) {
      container.innerHTML = `
        <div class="card text-center text-muted" style="padding: 40px 16px; background: var(--bg-primary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: center; margin-bottom: 10px; color: var(--text-muted);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No purchase records found</div>
          <div style="font-size: 0.82rem;">Try adjusting the date, representative, or search query.</div>
        </div>
      `;
      return;
    }

    const allChecked = purchases.length > 0 && purchases.every(p => selectedHistoryIds.has(p.id));

    // 1. Desktop Table
    let tableHtml = `
      <div class="history-table-desktop table-responsive">
        <table class="admin-table" style="margin: 0;">
          <thead>
            <tr>
              <th style="width: 38px; text-align: center;">
                <input type="checkbox" id="select-all-history" onchange="toggleSelectAllHistory(this.checked)" class="order-checkbox" ${allChecked ? 'checked' : ''} title="Select all orders">
              </th>
              <th>Date & Time</th>
              <th>Representative</th>
              <th>Firm / Shop</th>
              <th>Commodity / Goods</th>
              <th>Qty & Rate</th>
              <th>Total Amount</th>
              <th>Payment Mode</th>
              <th>Proofs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    // 2. Mobile Responsive Card List
    let mobileHtml = `<div class="history-mobile-list">`;

    purchases.forEach(p => {
      const isSelected = selectedHistoryIds.has(p.id);
      const dateObj = new Date(p.created_at);
      const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const amtStr = '₹' + parseFloat(p.total_amount || 0).toLocaleString('en-IN');
      const repName = p.rep_name || 'Representative';
      const itemName = p.type || p.category_name || 'Goods';
      const unitStr = p.unit ? p.unit.replace('per_', '') : 'unit';
      const modeBadge = p.payment_mode === 'cash' ? 'status-badge completed' : (p.payment_mode === 'upi' ? 'status-badge pending' : 'status-badge active');
      const hasImages = p.images && p.images.length > 0;

      // Table Row
      tableHtml += `
        <tr style="${isSelected ? 'background: rgba(22, 101, 52, 0.05);' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" class="order-checkbox history-row-cb" data-id="${p.id}" ${isSelected ? 'checked' : ''} onchange="onHistoryCheckboxChange('${p.id}', this.checked)">
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${dateStr}</div>
            <div class="text-muted" style="font-size: 0.75rem;">${timeStr}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--purple-primary);">${escapeHtml(repName)}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(p.firm_name)}</div>
            <div class="text-muted" style="font-size: 0.78rem;">${escapeHtml(p.contact_person)} (${escapeHtml(p.mobile || 'N/A')})</div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(itemName)}</div>
          </td>
          <td>
            <div>${p.quantity} ${escapeHtml(unitStr)} @ ₹${p.rate}</div>
          </td>
          <td>
            <span style="font-weight: 800; font-size: 1rem; color: var(--purple-dark);">${amtStr}</span>
          </td>
          <td>
            <span class="${modeBadge}">${(p.payment_mode || 'cash').toUpperCase()}</span>
            ${p.upi_id ? `<div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">UPI: ${escapeHtml(p.upi_id)}</div>` : ''}
            ${p.upi_utr ? `<div class="text-muted" style="font-size: 0.72rem;">UTR: ${escapeHtml(p.upi_utr)}</div>` : ''}
          </td>
          <td>
            ${hasImages ? `
              <div style="display: flex; gap: 6px;">
                ${p.images.map(img => `<img src="${img}" class="proof-thumb" onclick="openProofModal('${img}')">`).join('')}
              </div>
            ` : '<span class="text-muted" style="font-size: 0.75rem;">None</span>'}
          </td>
          <td>
            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: nowrap;">
              <button type="button" class="btn btn-outline-purple btn-sm" onclick="openEditOrderModal('${p.id}')" style="padding: 3px 8px; font-size: 0.72rem; font-weight: 700;">Edit</button>
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteSingleHistoryOrder('${p.id}')" style="padding: 3px 8px; font-size: 0.72rem; font-weight: 700; color: #DC2626; border-color: #FCA5A5;">Delete</button>
              <a href="receipts.html?entry_id=${p.id}" class="btn btn-outline-green btn-sm" style="padding: 3px 8px; font-size: 0.72rem; text-decoration: none; font-weight: 700; white-space: nowrap;">Receipt</a>
            </div>
          </td>
        </tr>
      `;

      // Mobile Card
      mobileHtml += `
        <div class="history-mobile-card" style="${isSelected ? 'border: 2px solid var(--brand-green, #166534); background: #F0FDF4;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" class="order-checkbox history-row-cb" data-id="${p.id}" ${isSelected ? 'checked' : ''} onchange="onHistoryCheckboxChange('${p.id}', this.checked)">
              <div>
                <div style="font-weight: 800; font-size: 1rem; color: var(--text-primary);">${escapeHtml(p.firm_name)}</div>
                <div style="font-size: 0.78rem; color: var(--purple-primary); font-weight: 700; margin-top: 2px;">
                  Rep: ${escapeHtml(repName)} &bull; <span class="text-muted">${dateStr} ${timeStr}</span>
                </div>
              </div>
            </div>
            <span class="${modeBadge}" style="font-size: 0.7rem;">${(p.payment_mode || 'cash').toUpperCase()}</span>
          </div>

          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">
            Contact: <strong>${escapeHtml(p.contact_person)}</strong> (${escapeHtml(p.mobile || 'N/A')}) &bull; ${escapeHtml(p.address || 'Field')}
          </div>

          <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <span style="font-weight: 700; font-size: 0.88rem;">${escapeHtml(itemName)}</span>
              <span class="text-muted" style="font-size: 0.8rem; margin-left: 6px;">(${p.quantity} ${escapeHtml(unitStr)} @ ₹${p.rate})</span>
            </div>
            <span style="font-weight: 800; font-size: 1.1rem; color: var(--purple-dark);">${amtStr}</span>
          </div>

          ${p.upi_id || p.upi_utr ? `
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
              ${p.upi_id ? `UPI ID: <strong style="color: var(--text-primary);">${escapeHtml(p.upi_id)}</strong> ` : ''}
              ${p.upi_utr ? `&bull; UTR: <strong style="color: var(--text-primary);">${escapeHtml(p.upi_utr)}</strong>` : ''}
            </div>
          ` : ''}

          ${hasImages ? `
            <div style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Uploaded Proofs:</span>
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                ${p.images.map(img => `<img src="${img}" class="proof-thumb" onclick="openProofModal('${img}')">`).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline-purple btn-sm" onclick="openEditOrderModal('${p.id}')" style="padding: 4px 10px; font-size: 0.75rem; font-weight: 700;">
                Edit
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteSingleHistoryOrder('${p.id}')" style="padding: 4px 10px; font-size: 0.75rem; font-weight: 700; color: #DC2626; border-color: #FCA5A5;">
                Delete
              </button>
            </div>
            <a href="receipts.html?entry_id=${p.id}" class="btn btn-outline-green btn-sm" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; font-weight: 700;">
              Download Receipt
            </a>
          </div>
        </div>
      `;
    });

    tableHtml += `</tbody></table></div>`;
    mobileHtml += `</div>`;

    container.innerHTML = tableHtml + mobileHtml;
  }

  // MULTI-SELECT & BATCH ACTIONS
  window.toggleSelectAllHistory = function(checked) {
    currentPurchases.forEach(p => {
      if (checked) selectedHistoryIds.add(p.id);
      else selectedHistoryIds.delete(p.id);
    });
    document.querySelectorAll('.history-row-cb').forEach(cb => cb.checked = checked);
    updateHistoryBatchBar();
  };

  window.onHistoryCheckboxChange = function(id, checked) {
    if (checked) selectedHistoryIds.add(id);
    else selectedHistoryIds.delete(id);
    const allCb = document.getElementById('select-all-history');
    if (allCb) allCb.checked = (selectedHistoryIds.size === currentPurchases.length && currentPurchases.length > 0);
    updateHistoryBatchBar();
  };

  window.updateHistoryBatchBar = function() {
    const bar = document.getElementById('history-batch-bar');
    const countEl = document.getElementById('history-selected-count');
    if (!bar) return;
    if (selectedHistoryIds.size > 0) {
      if (countEl) countEl.textContent = `${selectedHistoryIds.size} Selected`;
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  };

  window.clearHistorySelection = function() {
    selectedHistoryIds.clear();
    document.querySelectorAll('.history-row-cb').forEach(cb => cb.checked = false);
    const allCb = document.getElementById('select-all-history');
    if (allCb) allCb.checked = false;
    updateHistoryBatchBar();
  };

  window.deleteSingleHistoryOrder = async function(id) {
    const p = currentPurchases.find(item => item.id === id);
    const firm = p ? p.firm_name : 'this purchase';
    if (!confirm(`Are you sure you want to delete order for "${firm}"? This will remove it and notify the representative.`)) return;

    try {
      await window.sinaAdminDB.deleteProcurementEntry(id);
      selectedHistoryIds.delete(id);
      updateHistoryBatchBar();
      if (window.showToast) window.showToast('Order deleted & representative notified.', 'info');
      await loadHistory();
    } catch (err) {
      alert('Error deleting order: ' + err.message);
    }
  };

  window.batchDeleteSelectedHistory = async function() {
    if (selectedHistoryIds.size === 0) return;
    const count = selectedHistoryIds.size;
    if (!confirm(`Are you sure you want to delete ${count} selected order(s)? This will remove them and send notification to the field representatives.`)) return;

    try {
      const ids = Array.from(selectedHistoryIds);
      await window.sinaAdminDB.deleteProcurementEntriesBatch(ids);
      selectedHistoryIds.clear();
      updateHistoryBatchBar();
      if (window.showToast) window.showToast(`${count} orders deleted & representatives notified.`, 'info');
      await loadHistory();
    } catch (err) {
      alert('Error deleting orders: ' + err.message);
    }
  };

  // EDIT ORDER MODAL HANDLERS
  window.openEditOrderModal = function(id) {
    const p = currentPurchases.find(item => item.id === id);
    if (!p) return;
    document.getElementById('edit-order-id').value = p.id;
    document.getElementById('edit-order-firm').value = p.firm_name || '';
    document.getElementById('edit-order-contact').value = p.contact_person || '';
    document.getElementById('edit-order-mobile').value = p.mobile || '';
    document.getElementById('edit-order-item').value = p.type || p.category_name || '';
    document.getElementById('edit-order-qty').value = p.quantity || 1;
    document.getElementById('edit-order-rate').value = p.rate || 0;
    document.getElementById('edit-order-total').value = parseFloat(p.total_amount || 0);
    document.getElementById('edit-order-payment').value = (p.payment_mode || 'cash').toLowerCase();
    document.getElementById('edit-order-status').value = p.status || 'verified';
    document.getElementById('edit-order-modal').classList.add('active');
  };

  window.closeEditOrderModal = function() {
    const modal = document.getElementById('edit-order-modal');
    if (modal) modal.classList.remove('active');
  };

  window.calcEditOrderTotal = function() {
    const qty = parseFloat(document.getElementById('edit-order-qty').value) || 0;
    const rate = parseFloat(document.getElementById('edit-order-rate').value) || 0;
    document.getElementById('edit-order-total').value = (qty * rate).toFixed(2);
  };

  window.saveEditedOrder = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value;
    const saveBtn = document.getElementById('btn-save-edit-order');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    const updates = {
      firm_name: document.getElementById('edit-order-firm').value.trim(),
      contact_person: document.getElementById('edit-order-contact').value.trim(),
      mobile: document.getElementById('edit-order-mobile').value.trim(),
      type: document.getElementById('edit-order-item').value.trim(),
      quantity: parseFloat(document.getElementById('edit-order-qty').value) || 0,
      rate: parseFloat(document.getElementById('edit-order-rate').value) || 0,
      total_amount: parseFloat(document.getElementById('edit-order-total').value) || 0,
      payment_mode: document.getElementById('edit-order-payment').value,
      status: document.getElementById('edit-order-status').value
    };

    try {
      await window.sinaAdminDB.updateProcurementEntryFull(id, updates);
      closeEditOrderModal();
      if (window.showToast) window.showToast('Order updated & representative notified!', 'success');
      else alert('Order updated & representative notified!');
      await loadHistory();
    } catch (err) {
      alert('Error updating order: ' + err.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
  };

  let currentHistoryDownloadName = 'SINA_Proof.jpg';

  window.openProofModal = function(imgSrc, title, defaultFilename) {
    const modal = document.getElementById('proof-view-modal');
    const imgEl = document.getElementById('proof-view-img');
    const titleEl = document.getElementById('history-proof-modal-title');
    if (modal && imgEl) {
      imgEl.src = imgSrc;
      if (titleEl) titleEl.textContent = title || 'Uploaded Passbook / Cheque Proof';
      currentHistoryDownloadName = (defaultFilename ? defaultFilename + '.jpg' : 'SINA_Proof_' + Date.now() + '.jpg');
      modal.classList.add('active');
    }
  };

  window.downloadCurrentHistoryProofImg = function() {
    const imgEl = document.getElementById('proof-view-img');
    if (!imgEl || !imgEl.src) return;
    const a = document.createElement('a');
    a.href = imgEl.src;
    a.download = currentHistoryDownloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  window.closeProofModal = function() {
    const modal = document.getElementById('proof-view-modal');
    if (modal) modal.classList.remove('active');
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
