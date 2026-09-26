// SINA Admin - Representative Live Tracking & Calendar Operations Controller
(function() {
  let currentRep = null;
  let repId = null;
  let selectedDate = new Date().toISOString().split('T')[0];
  let currentDayEntries = [];
  let selectedRepEntryIds = new Set();

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    const params = new URLSearchParams(window.location.search);
    repId = params.get('id');

    if (!repId) {
      alert('No representative ID specified.');
      window.location.href = 'representatives.html';
      return;
    }

    initCalendarChooser();
    await loadRepDetails();
    await loadDateSpecificOperations(selectedDate);
    setupFloatModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadRepDetails();
    await loadDateSpecificOperations(selectedDate);
  };

  function initCalendarChooser() {
    const dateInput = document.getElementById('rep-calendar-date');
    const todayBtn = document.getElementById('btn-rep-date-today');

    if (dateInput) {
      dateInput.value = selectedDate;
      dateInput.addEventListener('change', async (e) => {
        if (e.target.value) {
          selectedDate = e.target.value;
          await loadDateSpecificOperations(selectedDate);
        }
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', async () => {
        selectedDate = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = selectedDate;
        await loadDateSpecificOperations(selectedDate);
      });
    }
  }

  async function loadRepDetails() {
    currentRep = await window.sinaAdminDB.getRepresentativeById(repId);
    if (!currentRep) {
      alert('Representative not found.');
      window.location.href = 'representatives.html';
      return;
    }

    // Populate header info
    document.getElementById('rep-detail-name').textContent = currentRep.name;
    document.getElementById('rep-detail-phone').textContent = currentRep.phone;
    document.getElementById('rep-detail-route').textContent = currentRep.assigned_route || 'Unassigned Territory';
    
    const statusPill = document.getElementById('rep-detail-status');
    if (statusPill) {
      statusPill.className = `status-badge ${currentRep.status === 'active' ? 'active' : 'inactive'}`;
      statusPill.textContent = currentRep.status === 'active' ? 'Active in Field' : 'Inactive';
    }

    // Get live consolidated metrics for this representative
    const summary = await window.sinaAdminDB.getAdminDashboardMetrics(repId);
    
    // Populate Cumulative Multi-Day Net Balance Hero Card
    const heroBalanceEl = document.getElementById('rep-hero-total-balance');
    const heroFloatsEl = document.getElementById('rep-hero-total-floats');
    const heroCashSpentEl = document.getElementById('rep-hero-total-cash-spent');
    const heroExpensesEl = document.getElementById('rep-hero-total-expenses');

    if (heroBalanceEl) {
      heroBalanceEl.textContent = '₹' + (summary.totalNetBalanceRemaining || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (heroFloatsEl) {
      heroFloatsEl.textContent = '₹' + (summary.totalCashGivenOverall || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (heroCashSpentEl) {
      heroCashSpentEl.textContent = '₹' + (summary.totalCashSpentOverall || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (heroExpensesEl) {
      heroExpensesEl.textContent = '₹' + (summary.totalExpensesOverall || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const cashOverallEl = document.getElementById('rep-metric-cash-overall');
    if (cashOverallEl) cashOverallEl.textContent = '₹' + (summary.totalCashGivenOverall || 0).toLocaleString('en-IN');

    const cashTodayEl = document.getElementById('rep-metric-cash-today');
    if (cashTodayEl) cashTodayEl.textContent = '₹' + (summary.totalCashGivenToday || 0).toLocaleString('en-IN');

    const procEl = document.getElementById('rep-metric-procured');
    if (procEl) procEl.textContent = '₹' + (summary.totalProcurement || 0).toLocaleString('en-IN');

    const expEl = document.getElementById('rep-metric-expenses');
    if (expEl) expEl.textContent = '- ₹' + (summary.totalExpenses || 0).toLocaleString('en-IN');

    const netCashEl = document.getElementById('rep-metric-net-cash');
    if (netCashEl) netCashEl.textContent = '₹' + (summary.netCashInHand || 0).toLocaleString('en-IN');
  }

  async function loadDateSpecificOperations(targetDate) {
    const data = await window.sinaAdminDB.getRepPurchasesAndCashForDate(repId, targetDate);

    // Format human-friendly date string
    const dateObj = new Date(targetDate + 'T00:00:00');
    const isToday = targetDate === new Date().toISOString().split('T')[0];
    const displayDate = dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    renderDayCashBanner(data, displayDate, isToday, targetDate);
    renderDayPurchases(data, displayDate);
  }

  function renderDayCashBanner(data, displayDate, isToday, targetDate) {
    const banner = document.getElementById('rep-day-cash-banner');
    if (!banner) return;

    const cashStr = '₹' + data.cashGiven.toLocaleString('en-IN');
    const notesStr = escapeHtml(data.notes || 'No specific notes logged');
    const actionLabel = data.cashGiven > 0 ? 'Edit Cash for this Date' : 'Give Cash for this Date';

    banner.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; width: 100%; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary);">${displayDate}</span>
            ${isToday ? '<span class="status-badge active" style="font-size: 0.72rem;">Today</span>' : ''}
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span class="text-muted" style="font-size: 0.82rem;">Cash Given:</span>
            <span style="font-size: 1.35rem; font-weight: 800; color: var(--purple-primary);">${cashStr}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
            <span class="text-muted">Purpose / Notes:</span> ${notesStr}
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <div style="background: var(--bg-primary); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted);">Purchases</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">₹${data.totalProcurement.toLocaleString('en-IN')}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
              <div style="font-size: 0.68rem; color: var(--text-muted);">Expenses</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--danger-color);">- ₹${data.totalExpenses.toLocaleString('en-IN')}</div>
            </div>
            <div style="background: var(--purple-tint); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--purple-border); text-align: center;">
              <div style="font-size: 0.68rem; color: var(--purple-primary);">Day Balance</div>
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--purple-dark);">₹${data.netCashBalance.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-sm" onclick="openEditFloatForDate('${targetDate}', ${data.cashGiven}, '${escapeHtml(data.notes || '')}')" style="display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            ${actionLabel}
          </button>
        </div>
      </div>
    `;
  }

  function renderDayPurchases(data, displayDate) {
    currentDayEntries = (data.entries || []);
    // Clean up selected IDs
    const currentIdSet = new Set(currentDayEntries.map(e => e.id));
    selectedRepEntryIds = new Set([...selectedRepEntryIds].filter(id => currentIdSet.has(id)));
    updateRepBatchBar();

    const titleEl = document.getElementById('rep-day-history-title');
    const subEl = document.getElementById('rep-day-history-sub');
    const countBadge = document.getElementById('rep-day-visits-count');
    const container = document.getElementById('rep-day-purchases-container');

    if (titleEl) titleEl.textContent = `Purchase History for ${displayDate}`;
    if (subEl) subEl.textContent = `Showing all goods bought and expenses logged by ${currentRep ? currentRep.name : 'representative'} on this date`;
    if (countBadge) countBadge.textContent = `${data.totalVisits} Purchases (${data.expenses.length} Expenses)`;

    if (!container) return;

    const events = [];

    (data.entries || []).forEach(e => {
      events.push({
        type: 'entry',
        timestamp: new Date(e.created_at).getTime(),
        timeStr: new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: e
      });
    });

    (data.expenses || []).forEach(x => {
      events.push({
        type: 'expense',
        timestamp: new Date(x.created_at).getTime(),
        timeStr: new Date(x.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: x
      });
    });

    events.sort((a, b) => b.timestamp - a.timestamp);

    if (events.length === 0) {
      container.innerHTML = `
        <div class="card text-center text-muted" style="padding: 32px 16px; background: var(--bg-primary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: center; margin-bottom: 8px; color: var(--text-muted);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No purchases or field activity on this date</div>
          <div style="font-size: 0.82rem;">Select another date from the calendar above or record cash given for this day.</div>
        </div>
      `;
      return;
    }

    let html = '<div class="timeline-list">';
    events.forEach(evt => {
      if (evt.type === 'entry') {
        const e = evt.data;
        const isSelected = selectedRepEntryIds.has(e.id);
        const modeBadge = e.payment_mode === 'cash' ? 'status-badge completed' : (e.payment_mode === 'upi' ? 'status-badge pending' : 'status-badge active');
        const hasImages = e.images && e.images.length > 0;

        html += `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content-card" style="${isSelected ? 'border: 2px solid var(--brand-green, #166534); background: #F0FDF4;' : ''}">
              <div class="timeline-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" class="order-checkbox rep-entry-cb" data-id="${e.id}" ${isSelected ? 'checked' : ''} onchange="onRepEntryCheckboxChange('${e.id}', this.checked)">
                  <span class="timeline-title">${escapeHtml(e.firm_name)}</span>
                  <span class="status-badge active" style="margin-left: 4px; font-size: 0.68rem;">Purchase Record</span>
                </div>
                <span class="timeline-time">${evt.timeStr}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
                Contact: <strong>${escapeHtml(e.contact_person)}</strong> (${escapeHtml(e.mobile || 'N/A')}) &bull; Address: ${escapeHtml(e.address || 'Field Location')}
              </div>
              <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>Item: <strong>${escapeHtml(e.type || e.category_name || 'Goods')}</strong> (${e.quantity} ${escapeHtml(e.unit ? e.unit.replace('per_', '') : 'units')} @ ₹${e.rate})</span>
                <span style="font-weight: 800; font-size: 1.05rem; color: var(--purple-dark);">₹${parseFloat(e.total_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  Payment: <span class="${modeBadge}">${(e.payment_mode || 'cash').toUpperCase()}</span>
                  ${e.upi_id ? `<span class="text-muted" style="font-size: 0.75rem; margin-left: 6px;">(UPI: ${escapeHtml(e.upi_id)})</span>` : ''}
                  ${e.upi_utr ? `<span class="text-muted" style="font-size: 0.75rem; margin-left: 6px;">(UTR: ${escapeHtml(e.upi_utr)})</span>` : ''}
                </div>
              </div>
              ${hasImages ? `
                <div style="margin-top: 8px;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Uploaded Passbook / Cheque Proofs:</span>
                  <div style="display: flex; gap: 8px; margin-top: 4px;">
                    ${e.images.map(img => `
                      <img src="${img}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid var(--purple-border); cursor: pointer;" onclick="openProofModal('${img}')">
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn btn-outline-purple btn-sm" onclick="openEditRepOrderModal('${e.id}')" style="padding: 3px 8px; font-size: 0.72rem; font-weight: 700;">
                    Edit Order
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteSingleRepOrder('${e.id}')" style="padding: 3px 8px; font-size: 0.72rem; font-weight: 700; color: #DC2626; border-color: #FCA5A5;">
                    Delete
                  </button>
                </div>
                <a href="receipts.html?entry_id=${e.id}" class="btn btn-outline-green btn-sm" style="padding: 3px 8px; font-size: 0.72rem; text-decoration: none; font-weight: 700;">
                  Receipt
                </a>
              </div>
            </div>
          </div>
        `;
      } else {
        const x = evt.data;
        html += `
          <div class="timeline-item">
            <div class="timeline-dot" style="background: var(--danger-color); border-color: rgba(220, 38, 38, 0.3);"></div>
            <div class="timeline-content-card" style="border-left: 3px solid var(--danger-color);">
              <div class="timeline-header">
                <div>
                  <span class="timeline-title">Expense: ${escapeHtml(x.category ? x.category.toUpperCase() : 'GENERAL')}</span>
                </div>
                <span class="timeline-time">${evt.timeStr}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                Amount: <strong style="color: var(--danger-color); font-size: 0.95rem;">- ₹${parseFloat(x.amount || 0).toLocaleString('en-IN')}</strong> &bull; Notes: ${escapeHtml(x.notes || 'None')}
              </div>
              ${x.receipt_url ? `
                <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                  <img src="${x.receipt_url}" alt="Receipt" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--purple-border); cursor: pointer; box-shadow: var(--shadow-sm);" onclick="openProofModal('${x.receipt_url}', 'Expense Receipt (${escapeHtml(x.category || 'Bill')})', 'Receipt_${x.category || 'expense'}_${(x.created_at || '').split('T')[0] || 'doc'}')">
                  <div style="cursor: pointer;" onclick="openProofModal('${x.receipt_url}', 'Expense Receipt (${escapeHtml(x.category || 'Bill')})', 'Receipt_${x.category || 'expense'}_${(x.created_at || '').split('T')[0] || 'doc'}')">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--purple-primary);">Receipt Attached</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">Tap to inspect & download &rarr;</div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // MULTI-SELECT & BATCH ACTIONS FOR REP PURCHASES
  window.onRepEntryCheckboxChange = function(id, checked) {
    if (checked) selectedRepEntryIds.add(id);
    else selectedRepEntryIds.delete(id);
    updateRepBatchBar();
  };

  window.updateRepBatchBar = function() {
    const bar = document.getElementById('rep-batch-bar');
    const countEl = document.getElementById('rep-selected-count');
    if (!bar) return;
    if (selectedRepEntryIds.size > 0) {
      if (countEl) countEl.textContent = `${selectedRepEntryIds.size} Selected`;
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  };

  window.clearRepSelection = function() {
    selectedRepEntryIds.clear();
    document.querySelectorAll('.rep-entry-cb').forEach(cb => cb.checked = false);
    updateRepBatchBar();
  };

  window.deleteSingleRepOrder = async function(id) {
    const p = currentDayEntries.find(item => item.id === id);
    const firm = p ? p.firm_name : 'this purchase';
    if (!confirm(`Are you sure you want to delete order for "${firm}"? This will remove it and notify the representative.`)) return;

    try {
      await window.sinaAdminDB.deleteProcurementEntry(id);
      selectedRepEntryIds.delete(id);
      updateRepBatchBar();
      if (window.showToast) window.showToast('Order deleted & representative notified.', 'info');
      await loadRepDetails();
      await loadDateSpecificOperations(selectedDate);
    } catch (err) {
      alert('Error deleting order: ' + err.message);
    }
  };

  window.batchDeleteSelectedRepPurchases = async function() {
    if (selectedRepEntryIds.size === 0) return;
    const count = selectedRepEntryIds.size;
    if (!confirm(`Are you sure you want to delete ${count} selected purchase(s) for this representative?`)) return;

    try {
      const ids = Array.from(selectedRepEntryIds);
      await window.sinaAdminDB.deleteProcurementEntriesBatch(ids);
      selectedRepEntryIds.clear();
      updateRepBatchBar();
      if (window.showToast) window.showToast(`${count} orders deleted & representative notified.`, 'info');
      await loadRepDetails();
      await loadDateSpecificOperations(selectedDate);
    } catch (err) {
      alert('Error deleting orders: ' + err.message);
    }
  };

  // EDIT REP ORDER MODAL HANDLERS
  window.openEditRepOrderModal = function(id) {
    const p = currentDayEntries.find(item => item.id === id);
    if (!p) return;
    document.getElementById('edit-rep-order-id').value = p.id;
    document.getElementById('edit-rep-order-firm').value = p.firm_name || '';
    document.getElementById('edit-rep-order-contact').value = p.contact_person || '';
    document.getElementById('edit-rep-order-mobile').value = p.mobile || '';
    document.getElementById('edit-rep-order-item').value = p.type || p.category_name || '';
    document.getElementById('edit-rep-order-qty').value = p.quantity || 1;
    document.getElementById('edit-rep-order-rate').value = p.rate || 0;
    document.getElementById('edit-rep-order-total').value = parseFloat(p.total_amount || 0);
    document.getElementById('edit-rep-order-payment').value = (p.payment_mode || 'cash').toLowerCase();
    document.getElementById('edit-rep-order-status').value = p.status || 'verified';
    document.getElementById('edit-rep-order-modal').classList.add('active');
  };

  window.closeEditRepOrderModal = function() {
    const modal = document.getElementById('edit-rep-order-modal');
    if (modal) modal.classList.remove('active');
  };

  window.calcEditRepOrderTotal = function() {
    const qty = parseFloat(document.getElementById('edit-rep-order-qty').value) || 0;
    const rate = parseFloat(document.getElementById('edit-rep-order-rate').value) || 0;
    document.getElementById('edit-rep-order-total').value = (qty * rate).toFixed(2);
  };

  window.saveEditedRepOrder = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-rep-order-id').value;
    const saveBtn = document.getElementById('btn-save-edit-rep-order');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    const updates = {
      firm_name: document.getElementById('edit-rep-order-firm').value.trim(),
      contact_person: document.getElementById('edit-rep-order-contact').value.trim(),
      mobile: document.getElementById('edit-rep-order-mobile').value.trim(),
      type: document.getElementById('edit-rep-order-item').value.trim(),
      quantity: parseFloat(document.getElementById('edit-rep-order-qty').value) || 0,
      rate: parseFloat(document.getElementById('edit-rep-order-rate').value) || 0,
      total_amount: parseFloat(document.getElementById('edit-rep-order-total').value) || 0,
      payment_mode: document.getElementById('edit-rep-order-payment').value,
      status: document.getElementById('edit-rep-order-status').value
    };

    try {
      await window.sinaAdminDB.updateProcurementEntryFull(id, updates);
      closeEditRepOrderModal();
      if (window.showToast) window.showToast('Order updated & representative notified!', 'success');
      else alert('Order updated & representative notified!');
      await loadRepDetails();
      await loadDateSpecificOperations(selectedDate);
    } catch (err) {
      alert('Error updating order: ' + err.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
  };

  window.openEditFloatForDate = function(dateStr, amount, notes) {
    const modal = document.getElementById('issue-float-modal');
    if (!modal) return;
    document.getElementById('float_date_input').value = dateStr;
    document.getElementById('float_amount_input').value = amount;
    document.getElementById('float_notes_input').value = notes || '';
    modal.classList.add('active');
  };

  function setupFloatModal() {
    const openBtn = document.getElementById('btn-issue-float');
    const modal = document.getElementById('issue-float-modal');
    const closeBtn = document.getElementById('btn-close-float-modal');
    const form = document.getElementById('issue-float-form');

    if (!modal) return;

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        document.getElementById('float_date_input').value = selectedDate || new Date().toISOString().split('T')[0];
        document.getElementById('float_amount_input').value = '';
        document.getElementById('float_notes_input').value = '';
        modal.classList.add('active');
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('float_date_input')?.value || selectedDate;
        const amount = parseFloat(document.getElementById('float_amount_input')?.value) || 0;
        const notes = document.getElementById('float_notes_input')?.value.trim();

        if (amount < 0) {
          alert('Please enter a valid amount.');
          return;
        }

        await window.sinaAdminDB.issueDailyFloat(repId, amount, notes, date);

        if (window.dispatchPushNotification) {
          window.dispatchPushNotification({
            user_id: repId,
            target_role: 'representative',
            title: `Cash Float Allocated: ₹${amount.toLocaleString('en-IN')}`,
            body: `₹${amount.toLocaleString('en-IN')} morning cash float credited for ${date}.`,
            data: { url: 'profile.html' }
          });
        }

        alert(`Cash given of ₹${amount.toLocaleString('en-IN')} recorded for ${currentRep.name} on ${date}.`);
        modal.classList.remove('active');
        
        // Refresh both top level metrics and date-specific view
        await loadRepDetails();
        await loadDateSpecificOperations(selectedDate);
      });
    }
  }

  let currentProofDownloadName = 'SINA_Document.jpg';

  window.openProofModal = function(imgSrc, title, defaultFilename) {
    const modal = document.getElementById('proof-view-modal');
    const imgEl = document.getElementById('proof-view-img');
    const titleEl = document.getElementById('proof-modal-title');
    if (modal && imgEl) {
      imgEl.src = imgSrc;
      if (titleEl) titleEl.textContent = title || 'Document Inspection';
      currentProofDownloadName = (defaultFilename ? defaultFilename + '.jpg' : 'SINA_Document_' + Date.now() + '.jpg');
      modal.classList.add('active');
    }
  };

  window.downloadCurrentProofImg = function() {
    const imgEl = document.getElementById('proof-view-img');
    if (!imgEl || !imgEl.src) return;
    const a = document.createElement('a');
    a.href = imgEl.src;
    a.download = currentProofDownloadName;
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
