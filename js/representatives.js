// SINA Admin - Representative Management & Password Control
(function() {
  let reps = [];

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await loadRepresentatives();
    setupAddRepModal();
    setupPasswordModal();
    setupRepFloatModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadRepresentatives();
  };

  let allFloats = [];
  let allEntries = [];
  let allExpenses = [];

  async function loadRepresentatives() {
    reps = await window.sinaAdminDB.getRepresentatives();
    allFloats = await window.sinaAdminDB.getDailyFloats();
    allEntries = await window.sinaAdminDB.getProcurementEntries();
    allExpenses = await window.sinaAdminDB.getExpenses();
    renderRepsTable();
  }

  function renderRepsTable() {
    const tbody = document.getElementById('reps-table-tbody');
    const mobileContainer = document.getElementById('reps-mobile-cards');

    if (reps.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 24px;">No representatives registered.</td></tr>`;
      if (mobileContainer) mobileContainer.innerHTML = `<div class="text-center text-muted" style="padding: 24px;">No representatives registered.</div>`;
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    let tableHtml = '';
    let mobileCardsHtml = '';

    reps.forEach(rep => {
      const repFloat = allFloats.find(f => String(f.representative_id) === String(rep.id) && f.date === today) ||
                       allFloats.find(f => String(f.representative_id) === String(rep.id));
      const floatAmt = repFloat ? parseFloat(repFloat.float_amount) || 0 : 0;

      // Cumulative balance calculation for this representative
      const repFloats = allFloats.filter(f => String(f.representative_id) === String(rep.id));
      const totalInflow = repFloats.reduce((acc, f) => acc + (parseFloat(f.float_amount) || 0), 0);
      const repCashEntries = allEntries.filter(e => String(e.representative_id) === String(rep.id) && e.payment_mode === 'cash');
      const totalCashSpent = repCashEntries.reduce((acc, e) => acc + (parseFloat(e.cash_amount != null ? e.cash_amount : e.total_amount) || 0), 0);
      const repExpenses = allExpenses.filter(e => String(e.representative_id) === String(rep.id));
      const totalExpenses = repExpenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);

      const netBalanceRemaining = Math.max(0, totalInflow - totalCashSpent - totalExpenses);

      // Desktop Table Row (Whole row is clickable to open rep page)
      tableHtml += `
        <tr class="rep-table-row" onclick="handleRepRowClick(event, '${rep.id}')" style="cursor: pointer;" title="Click row to open ${escapeHtml(rep.name)}'s live page">
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--purple-tint); color: var(--purple-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style="font-weight: 700; color: var(--purple-primary); font-size: 0.95rem;">${escapeHtml(rep.name)}</div>
                <div class="text-muted" style="font-size: 0.75rem;">Click to open live page &rarr;</div>
              </div>
            </div>
          </td>
          <td>
            <a href="tel:${rep.phone}" class="text-purple font-bold">${escapeHtml(rep.phone)}</a>
          </td>
          <td>${escapeHtml(rep.assigned_route || 'All Routes')}</td>
          <td>
            <strong style="color: var(--brand-green, #1E513A); font-size: 0.95rem;">₹${netBalanceRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </td>
          <td>
            <button class="btn btn-outline-purple btn-sm" onclick="openRepFloatModal('${rep.id}', '${escapeHtml(rep.name)}', ${floatAmt})">
              ₹${floatAmt.toLocaleString('en-IN')} (Edit)
            </button>
          </td>
          <td>
            <span class="status-badge ${rep.status === 'active' ? 'active' : 'inactive'}">
              ${rep.status.toUpperCase()}
            </span>
          </td>
          <td>
            <button class="btn btn-outline-purple btn-sm" onclick="openPasswordModal('${rep.id}', '${escapeHtml(rep.name)}', '${escapeHtml(rep.password_hash)}')">
              Key &bull;&bull;&bull;&bull;
            </button>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <a href="rep-detail.html?id=${rep.id}" class="btn btn-primary btn-sm">
                Open Page &rarr;
              </a>
              <button class="btn btn-secondary btn-sm" onclick="toggleStatus('${rep.id}', '${rep.status}')">
                ${rep.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </td>
        </tr>
      `;

      // Mobile Representative Box / Card (100% clickable box)
      mobileCardsHtml += `
        <div class="rep-person-card" onclick="handleRepRowClick(event, '${rep.id}')" style="cursor: pointer; background: var(--bg-primary); border: 1.5px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px; box-shadow: var(--shadow-sm); transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--purple-tint); color: var(--purple-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style="font-weight: 800; font-size: 1rem; color: var(--purple-primary);">${escapeHtml(rep.name)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(rep.assigned_route || 'All Routes')}</div>
              </div>
            </div>
            <span class="status-badge ${rep.status === 'active' ? 'active' : 'inactive'}">
              ${rep.status.toUpperCase()}
            </span>
          </div>

          <!-- Prominent Total Net Balance Box -->
          <div style="background: var(--brand-green-tint, #ECFDF5); border: 1px solid var(--brand-green-border, #A7F3D0); border-radius: var(--radius-sm); padding: 8px 12px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--brand-green, #1E513A);">Total Net Balance:</span>
            <span style="font-size: 1.05rem; font-weight: 900; color: var(--brand-green, #1E513A);">₹${netBalanceRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; background: var(--bg-secondary); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.8rem;">
            <div>
              <span class="text-muted" style="font-size: 0.72rem; display: block;">Phone / Login:</span>
              <a href="tel:${rep.phone}" class="text-purple font-bold">${escapeHtml(rep.phone)}</a>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem; display: block;">Today's Cash Given:</span>
              <strong style="color: var(--purple-primary);">₹${floatAmt.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.72rem;">
            <span class="text-muted">Click anywhere on card to open</span>
            <span style="color: var(--purple-primary); font-weight: 700;">Live Activity &rarr;</span>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
            <button type="button" class="btn btn-outline-purple btn-sm" onclick="openRepFloatModal('${rep.id}', '${escapeHtml(rep.name)}', ${floatAmt})" style="padding: 6px 10px; font-size: 0.78rem;">
              Give Cash
            </button>
            <button type="button" class="btn btn-outline-purple btn-sm" onclick="openPasswordModal('${rep.id}', '${escapeHtml(rep.name)}', '${escapeHtml(rep.password_hash)}') "style="padding: 6px 10px; font-size: 0.78rem;">
              Password
            </button>
            <a href="rep-detail.html?id=${rep.id}" class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size: 0.78rem;">
              Open Person Page &rarr;
            </a>
          </div>
        </div>
      `;
    });

    if (tbody) tbody.innerHTML = tableHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileCardsHtml;
  }

  window.handleRepRowClick = function(event, repId) {
    // If the click originated from an action button or link, don't hijack navigation
    if (event.target.closest('button') || event.target.closest('a') || event.target.closest('input')) {
      return;
    }
    window.location.href = `rep-detail.html?id=${repId}`;
  };

  function setupAddRepModal() {
    const openBtn = document.getElementById('btn-open-add-rep');
    const modal = document.getElementById('add-rep-modal');
    const closeBtn = document.getElementById('btn-close-add-rep');
    const form = document.getElementById('add-rep-form');

    if (!openBtn || !modal) return;

    openBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('rep_name')?.value.trim();
        const phone = document.getElementById('rep_phone')?.value.trim();
        const route = document.getElementById('rep_route')?.value.trim();
        const password = document.getElementById('rep_password')?.value.trim();

        if (!name || !phone || !password) {
          alert('Name, Phone and Password are required.');
          return;
        }

        try {
          await window.sinaAdminDB.addRepresentative({
            name,
            phone,
            assigned_route: route,
            password
          });
          alert(`Representative "${name}" created successfully!`);
          modal.classList.remove('active');
          form.reset();
          await loadRepresentatives();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      });
    }
  }

  function setupPasswordModal() {
    const modal = document.getElementById('edit-password-modal');
    const closeBtn = document.getElementById('btn-close-password-modal');
    const form = document.getElementById('edit-password-form');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repId = document.getElementById('pwd_rep_id')?.value;
        const newPassword = document.getElementById('pwd_new_password')?.value.trim();

        if (!newPassword) {
          alert('Please enter a new password/PIN.');
          return;
        }

        try {
          await window.sinaAdminDB.updateRepresentativePassword(repId, newPassword);
          alert('Password updated successfully! Representative can now login with the new password.');
          modal.classList.remove('active');
          await loadRepresentatives();
        } catch (err) {
          alert('Error updating password: ' + err.message);
        }
      });
    }
  }

  function setupRepFloatModal() {
    const modal = document.getElementById('rep-float-modal');
    const closeBtn = document.getElementById('btn-close-rep-float-modal');
    const form = document.getElementById('rep-float-form');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repId = document.getElementById('float_rep_id')?.value;
        const date = document.getElementById('rep_float_date_input')?.value || new Date().toISOString().split('T')[0];
        const amount = parseFloat(document.getElementById('rep_float_amount_input')?.value) || 0;
        const notes = document.getElementById('rep_float_notes_input')?.value.trim();

        try {
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

          alert('Cash given updated successfully and synced to representative!');
          modal.classList.remove('active');
          await loadRepresentatives();
        } catch (err) {
          alert('Error updating cash: ' + err.message);
        }
      });
    }
  }

  window.openRepFloatModal = function(repId, repName, currentFloat, floatDate = null) {
    const modal = document.getElementById('rep-float-modal');
    if (!modal) return;

    document.getElementById('float_rep_id').value = repId;
    document.getElementById('rep_float_name_display').textContent = repName;
    document.getElementById('rep_float_date_input').value = floatDate || new Date().toISOString().split('T')[0];
    document.getElementById('rep_float_amount_input').value = currentFloat || 0;
    document.getElementById('rep_float_notes_input').value = 'Morning cash handover';
    modal.classList.add('active');
  };

  window.openPasswordModal = function(repId, repName, currentPass) {
    const modal = document.getElementById('edit-password-modal');
    if (!modal) return;

    document.getElementById('pwd_rep_id').value = repId;
    document.getElementById('pwd_rep_name_display').textContent = repName;
    document.getElementById('pwd_new_password').value = currentPass || '';
    modal.classList.add('active');
  };

  window.toggleStatus = async function(repId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (confirm(`Are you sure you want to set this representative to ${newStatus.toUpperCase()}?`)) {
      await window.sinaAdminDB.updateRepresentative(repId, { status: newStatus });
      await loadRepresentatives();
    }
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
