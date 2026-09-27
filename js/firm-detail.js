// SINA Admin - Independent Firm Detail & Representative Breakdown Controller
(function() {
  let currentFirm = null;
  let allFirms = [];
  let allBills = [];

  async function init() {
    const admin = window.sinaAdminAuth ? window.sinaAdminAuth.requireAdmin() : true;
    if (!admin) return;

    await loadFirmDetails();
    setupEditFirmModal();
    setupBillFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadFirmDetails();
  };

  async function loadFirmDetails() {
    const params = new URLSearchParams(window.location.search);
    const firmNameParam = params.get('firm');
    const firmIdParam = params.get('id');

    allFirms = await window.sinaAdminDB.getFirmsSummary();

    if (firmNameParam) {
      currentFirm = allFirms.find(f => (f.firm_name || '').trim().toLowerCase() === firmNameParam.trim().toLowerCase());
    } else if (firmIdParam) {
      currentFirm = allFirms.find(f => f.id === firmIdParam);
    }

    if (!currentFirm && allFirms.length > 0) {
      currentFirm = allFirms[0];
    }

    if (!currentFirm) {
      document.getElementById('firm-hero-name').textContent = 'Firm Not Found';
      return;
    }

    renderFirmHero();
    renderRepBreakdown();
    renderBillsTable();
  }

  function renderFirmHero() {
    document.getElementById('firm-hero-name').textContent = currentFirm.firm_name || 'Unnamed Firm';
    document.getElementById('firm-hero-contact').textContent = currentFirm.contact_person || 'Not Specified';

    const phoneWrap = document.getElementById('firm-hero-phone-wrap');
    if (phoneWrap) {
      if (currentFirm.mobile) {
        phoneWrap.innerHTML = `
          <span>Mobile: <strong>${escapeHtml(currentFirm.mobile)}</strong></span>
          <a href="tel:${currentFirm.mobile}" onclick="window.makeDirectCall && window.makeDirectCall('${currentFirm.mobile}')" class="btn btn-sm" style="background: #22C55E; color: #FFFFFF; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-decoration: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">
            📞 Call
          </a>
        `;
      } else {
        phoneWrap.innerHTML = '<span class="text-muted">No mobile number</span>';
      }
    }

    const addrEl = document.getElementById('firm-hero-address');
    if (addrEl) {
      addrEl.textContent = 'Mandi / Address: ' + (currentFirm.address || 'Not Specified');
    }

    const upiEl = document.getElementById('firm-hero-upi');
    if (upiEl) {
      upiEl.textContent = 'UPI ID: ' + (currentFirm.upi_id || 'Not Specified');
    }

    const totalSpent = parseFloat(currentFirm.total_spent || 0);
    const billsCount = currentFirm.total_visits || (currentFirm.visits ? currentFirm.visits.length : 0);
    const avgOrder = billsCount > 0 ? (totalSpent / billsCount) : 0;

    // Unique reps
    const repSet = new Set();
    (currentFirm.visits || []).forEach(v => {
      if (v.rep_name) repSet.add(v.rep_name);
    });

    document.getElementById('firm-kpi-spent').textContent = '₹' + totalSpent.toLocaleString('en-IN');
    document.getElementById('firm-kpi-bills').textContent = billsCount;
    document.getElementById('firm-kpi-avg').textContent = '₹' + Math.round(avgOrder).toLocaleString('en-IN');
    document.getElementById('firm-kpi-reps-count').textContent = repSet.size;
  }

  function renderRepBreakdown() {
    const tbody = document.getElementById('firm-reps-tbody');
    const badge = document.getElementById('firm-reps-badge');
    if (!tbody) return;

    const bills = currentFirm.visits || [];
    const repMap = new Map();

    bills.forEach(b => {
      const repName = (b.rep_name || 'Representative').trim();
      if (!repMap.has(repName)) {
        repMap.set(repName, {
          rep_name: repName,
          rep_id: b.rep_id,
          entries_count: 0,
          total_amount: 0,
          last_visited: b.created_at
        });
      }
      const r = repMap.get(repName);
      r.entries_count += 1;
      r.total_amount += parseFloat(b.amount || 0);
      if (new Date(b.created_at) > new Date(r.last_visited)) {
        r.last_visited = b.created_at;
      }
    });

    const repsList = Array.from(repMap.values()).sort((a, b) => b.total_amount - a.total_amount);
    if (badge) badge.textContent = `${repsList.length} Rep${repsList.length === 1 ? '' : 's'}`;

    if (repsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No representative entries recorded for this firm yet.</td></tr>`;
      return;
    }

    const totalFirmSpent = parseFloat(currentFirm.total_spent || 1);

    let html = '';
    repsList.forEach(r => {
      const pct = totalFirmSpent > 0 ? ((r.total_amount / totalFirmSpent) * 100).toFixed(1) : '0';
      const lastVisitFormatted = new Date(r.last_visited).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      html += `
        <tr>
          <td>
            <strong style="font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(r.rep_name)}</strong>
          </td>
          <td>
            <span class="status-badge active" style="font-size: 0.82rem;">${r.entries_count} Entries</span>
          </td>
          <td>
            <strong style="color: var(--green-dark); font-size: 1rem;">₹${r.total_amount.toLocaleString('en-IN')}</strong>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 0.85rem;">${pct}%</span>
              <div style="background: var(--bg-secondary); border-radius: 4px; width: 60px; height: 6px; overflow: hidden;">
                <div style="background: var(--green-primary); height: 100%; width: ${pct}%;"></div>
              </div>
            </div>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-secondary);">
            ${lastVisitFormatted}
          </td>
          <td>
            <a href="rep-detail.html?rep=${encodeURIComponent(r.rep_name)}" class="btn btn-outline-green btn-sm" style="padding: 4px 10px; font-size: 0.78rem; font-weight: 700; text-decoration: none;">
              Rep Profile &rarr;
            </a>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderBillsTable(filterQuery = '') {
    const tbody = document.getElementById('firm-bills-tbody');
    const badge = document.getElementById('firm-total-bills-badge');
    if (!tbody) return;

    allBills = currentFirm.visits || [];
    let filtered = allBills;

    if (filterQuery) {
      filtered = allBills.filter(b =>
        (b.rep_name && b.rep_name.toLowerCase().includes(filterQuery)) ||
        (b.item_name && b.item_name.toLowerCase().includes(filterQuery)) ||
        (b.payment_mode && b.payment_mode.toLowerCase().includes(filterQuery)) ||
        (b.upi_utr && b.upi_utr.toLowerCase().includes(filterQuery))
      );
    }

    if (badge) badge.textContent = `${filtered.length} Bills`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No transactions found matching filter.</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(b => {
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
          ? `<span class="status-badge active">UPI Settled</span>`
          : '<span class="status-badge pending">UPI Pending</span>';
      } else {
        paymentBadge = `<span class="status-badge ${isVerified ? 'active' : 'pending'}">${(b.payment_mode || 'PAYMENT').toUpperCase()}</span>`;
      }

      html += `
        <tr>
          <td>
            <div style="font-weight: 700;">${dateStr}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">ID: ${b.id ? b.id.substring(0, 8) : 'N/A'}</div>
          </td>
          <td>
            <strong style="color: var(--text-primary);">${escapeHtml(b.rep_name || 'Representative')}</strong>
          </td>
          <td>
            <div><strong>${escapeHtml(b.item_name || 'Goods')}</strong></div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${b.quantity || ''} ${(b.unit || '').replace('per_', '')} ${b.rate ? '@ ₹' + b.rate : ''}</div>
          </td>
          <td>
            <span style="font-size: 1.05rem; font-weight: 900; color: var(--green-dark);">₹${parseFloat(b.amount || 0).toLocaleString('en-IN')}</span>
          </td>
          <td>
            ${paymentBadge}
          </td>
          <td>
            ${b.upi_utr ? `<span style="font-family: monospace; font-size: 0.82rem; font-weight: 700; color: var(--green-dark);">${escapeHtml(b.upi_utr)}</span>` : '<span class="text-muted" style="font-size: 0.75rem;">None</span>'}
          </td>
          <td>
            ${hasImages ? `
              <div style="display: flex; gap: 4px;">
                ${b.images.map(img => `
                  <img src="${img}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openFirmImg('${img}')" alt="Bill Proof">
                `).join('')}
              </div>
            ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>'}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function setupBillFilter() {
    const input = document.getElementById('firm-bills-filter');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      renderBillsTable(q);
    });
  }

  function setupEditFirmModal() {
    const openBtn = document.getElementById('btn-open-edit-firm');
    const closeBtn = document.getElementById('btn-close-edit-firm-modal');
    const modal = document.getElementById('edit-firm-modal');
    const form = document.getElementById('edit-firm-form');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        if (!currentFirm) return;
        document.getElementById('edit_firm_name').value = currentFirm.firm_name || '';
        document.getElementById('edit_contact_person').value = currentFirm.contact_person || '';
        document.getElementById('edit_firm_mobile').value = currentFirm.mobile || '';
        document.getElementById('edit_firm_address').value = currentFirm.address || '';
        document.getElementById('edit_firm_upi').value = currentFirm.upi_id || '';
        modal.classList.add('active');
      });
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
        const oldName = currentFirm.firm_name;
        const newName = document.getElementById('edit_firm_name').value.trim();
        const contact = document.getElementById('edit_contact_person').value.trim();
        const mobile = document.getElementById('edit_firm_mobile').value.trim();
        const address = document.getElementById('edit_firm_address').value.trim();
        const upi = document.getElementById('edit_firm_upi').value.trim();

        if (!newName || !contact || !mobile || !address) {
          alert('Please fill all mandatory fields.');
          return;
        }

        try {
          await window.sinaAdminDB.updateFirm(oldName, {
            firm_name: newName,
            contact_person: contact,
            mobile: mobile,
            address: address,
            upi_id: upi
          });

          alert('Firm details updated successfully!');
          modal.classList.remove('active');
          window.location.search = `?firm=${encodeURIComponent(newName)}`;
        } catch (err) {
          alert('Error updating firm: ' + err.message);
        }
      });
    }
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

  window.makeDirectCall = function(phone) {
    if (window.FlutterBridge) {
      window.FlutterBridge.postMessage(JSON.stringify({
        action: 'MAKE_CALL',
        phone: phone
      }));
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
