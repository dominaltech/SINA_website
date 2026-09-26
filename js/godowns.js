// SINA Admin - Godowns & Warehouses Management Controller
(function() {
  let allGodowns = [];
  let allEntries = [];
  let editingGodownId = null;

  async function init() {
    const admin = window.sinaAdminAuth ? window.sinaAdminAuth.getCurrentAdmin() : null;
    if (!admin) {
      window.location.href = 'login.html';
      return;
    }

    await loadGodownsData();
    setupEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadGodownsData();
  };
  window.refreshCurrentPageData = window.refreshAdminData;

  async function loadGodownsData() {
    try {
      if (window.sinaAdminDB && typeof window.sinaAdminDB.getGodowns === 'function') {
        allGodowns = await window.sinaAdminDB.getGodowns();
      } else {
        allGodowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      }
      if (window.sinaAdminDB && typeof window.sinaAdminDB.getEntries === 'function') {
        allEntries = await window.sinaAdminDB.getEntries();
      } else if (window.sinaAdminDB && typeof window.sinaAdminDB.getProcurementEntries === 'function') {
        allEntries = await window.sinaAdminDB.getProcurementEntries();
      } else {
        allEntries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      }
    } catch (err) {
      console.warn('[Godowns] Error in loadGodownsData, using cache:', err);
      allGodowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      allEntries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
    }
    renderGodownsList();
    populateFilter();
    // Render inventory on page load (default: all godowns)
    const currentFilter = document.getElementById('godown-filter');
    renderInventory(currentFilter ? (currentFilter.value || 'all') : 'all');
  }

  function populateFilter() {
    const filter = document.getElementById('godown-filter');
    if (!filter) return;
    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">All Godowns</option>';
    allGodowns.forEach(gd => {
      const opt = document.createElement('option');
      opt.value = gd.id;
      opt.textContent = gd.name;
      filter.appendChild(opt);
    });
    filter.value = currentVal || 'all';
  }

  function renderGodownsList() {
    const container = document.getElementById('godowns-list-container');
    if (!container) return;

    if (allGodowns.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom: 8px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <p style="font-weight: 600;">No godowns configured yet.</p>
          <p style="font-size: 0.8rem;">Click "Add Godown" to create your first warehouse.</p>
        </div>`;
      return;
    }

    let html = '';
    allGodowns.forEach(gd => {
      const entryCount = allEntries.filter(e => e.godown_id === gd.id || e.godown_name === gd.name).length;
      const totalVal = allEntries
        .filter(e => e.godown_id === gd.id || e.godown_name === gd.name)
        .reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);

      html += `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid var(--purple-primary);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(gd.name)}</h4>
              ${gd.location ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">📍 ${escapeHtml(gd.location)}</div>` : ''}
              ${gd.contact_person ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">👤 ${escapeHtml(gd.contact_person)}</div>` : ''}
              ${gd.contact_phone ? `
                <div style="font-size: 0.82rem; margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                  <span>📞 <strong>${escapeHtml(gd.contact_phone)}</strong></span>
                  <a href="tel:${gd.contact_phone}" onclick="window.FlutterBridge && window.FlutterBridge.postMessage(JSON.stringify({action:'MAKE_CALL',phone:'${gd.contact_phone}'}))" class="btn btn-sm" style="background: #22C55E; color: #FFFFFF; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-decoration: none; font-size: 0.75rem;">
                    Call Manager
                  </a>
                </div>
              ` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted);">${entryCount} entries</div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--green-dark);">₹${totalVal.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button type="button" class="btn btn-outline-green btn-sm" onclick="window.editGodown('${gd.id}')">Edit</button>
            <button type="button" class="btn btn-sm" style="background: var(--danger-bg); color: var(--danger-color); border: 1px solid rgba(220,38,38,0.2);" onclick="window.deactivateGodown('${gd.id}')">Deactivate</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.viewInventory('${gd.id}')">View Inventory</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  }

  function renderInventory(godownId) {
    const container = document.getElementById('inventory-table-container');
    if (!container) return;

    const filteredEntries = godownId === 'all'
      ? allEntries
      : allEntries.filter(e => e.godown_id === godownId || e.godown_name === (allGodowns.find(g => g.id === godownId) || {}).name);

    if (filteredEntries.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 16px;">No entries found for this godown.</p>';
      return;
    }

    // Aggregate by product
    const productMap = {};
    filteredEntries.forEach(entry => {
      const items = entry.items || entry.procurement_items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const key = it.product_name || it.type || 'Unknown';
          if (!productMap[key]) productMap[key] = { name: key, unit: it.unit || 'per_kg', totalQty: 0, totalValue: 0 };
          productMap[key].totalQty += parseFloat(it.quantity) || 0;
          productMap[key].totalValue += parseFloat(it.line_total) || 0;
        });
      } else {
        const key = entry.type || entry.category_name || 'Unknown';
        if (!productMap[key]) productMap[key] = { name: key, unit: entry.unit || 'per_kg', totalQty: 0, totalValue: 0 };
        productMap[key].totalQty += parseFloat(entry.quantity) || 0;
        productMap[key].totalValue += parseFloat(entry.total_amount) || 0;
      }
    });

    const products = Object.values(productMap).sort((a, b) => b.totalValue - a.totalValue);
    const grandTotal = products.reduce((s, p) => s + p.totalValue, 0);

    let tableHtml = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="background: var(--purple-tint); text-align: left;">
              <th style="padding: 10px 12px; font-weight: 700;">Product</th>
              <th style="padding: 10px 12px; font-weight: 700;">Unit</th>
              <th style="padding: 10px 12px; font-weight: 700; text-align: right;">Total Qty</th>
              <th style="padding: 10px 12px; font-weight: 700; text-align: right;">Valuation</th>
            </tr>
          </thead>
          <tbody>`;

    products.forEach(p => {
      const unitLabel = p.unit === 'per_kg' ? 'Kg' : p.unit === 'per_bag' ? 'Bags' : p.unit === 'per_piece' ? 'Pcs' : p.unit;
      tableHtml += `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px 12px; font-weight: 600;">${escapeHtml(p.name)}</td>
              <td style="padding: 10px 12px; color: var(--text-secondary);">${unitLabel}</td>
              <td style="padding: 10px 12px; text-align: right;">${p.totalQty.toLocaleString('en-IN')}</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: var(--purple-primary);">₹${p.totalValue.toLocaleString('en-IN')}</td>
            </tr>`;
    });

    tableHtml += `
          </tbody>
          <tfoot>
            <tr style="background: var(--purple-tint); font-weight: 800;">
              <td colspan="3" style="padding: 10px 12px;">Grand Total</td>
              <td style="padding: 10px 12px; text-align: right; color: var(--purple-dark);">₹${grandTotal.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    container.innerHTML = tableHtml;
  }

  function setupEventListeners() {
    const addBtn = document.getElementById('btn-add-godown');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        editingGodownId = null;
        document.getElementById('godown-modal-title').textContent = 'Add New Godown';
        document.getElementById('godown-name-input').value = '';
        document.getElementById('godown-location-input').value = '';
        document.getElementById('godown-contact-input').value = '';
        document.getElementById('godown-modal').classList.add('active');
      });
    }

    const saveBtn = document.getElementById('btn-save-godown');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name = document.getElementById('godown-name-input').value.trim();
        const location = document.getElementById('godown-location-input').value.trim();
        const contact = document.getElementById('godown-contact-input').value.trim();
        const phone = document.getElementById('godown-phone-input') ? document.getElementById('godown-phone-input').value.trim() : '';

        if (!name) {
          alert('Godown name is required.');
          return;
        }

        try {
          if (editingGodownId) {
            await window.sinaAdminDB.updateGodown(editingGodownId, { name, location, contact_person: contact, contact_phone: phone });
          } else {
            await window.sinaAdminDB.saveGodown({ name, location, contact_person: contact, contact_phone: phone });
          }
          window.closeGodownModal();
          await loadGodownsData();
        } catch (err) {
          console.error('Error saving godown:', err);
          alert('Error saving godown: ' + err.message);
        }
      });
    }

    const filter = document.getElementById('godown-filter');
    if (filter) {
      filter.addEventListener('change', () => {
        renderInventory(filter.value);
      });
    }

    // Close modal on backdrop click
    const modal = document.getElementById('godown-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeGodownModal();
      });
    }
  }

  window.closeGodownModal = function() {
    const modal = document.getElementById('godown-modal');
    if (modal) modal.classList.remove('active');
    editingGodownId = null;
  };

  window.editGodown = function(id) {
    const gd = allGodowns.find(g => g.id === id);
    if (!gd) return;
    editingGodownId = id;
    document.getElementById('godown-modal-title').textContent = 'Edit Godown';
    document.getElementById('godown-name-input').value = gd.name || '';
    document.getElementById('godown-location-input').value = gd.location || '';
    document.getElementById('godown-contact-input').value = gd.contact_person || '';
    if (document.getElementById('godown-phone-input')) {
      document.getElementById('godown-phone-input').value = gd.contact_phone || '';
    }
    document.getElementById('godown-modal').classList.add('active');
  };

  window.deactivateGodown = async function(id) {
    if (!confirm('Are you sure you want to deactivate this godown? It will be hidden from the active list.')) return;
    try {
      await window.sinaAdminDB.updateGodown(id, { is_active: false });
      await loadGodownsData();
    } catch (err) {
      alert('Error deactivating godown: ' + err.message);
    }
  };

  window.viewInventory = function(id) {
    const filter = document.getElementById('godown-filter');
    if (filter) filter.value = id;
    renderInventory(id);
    document.getElementById('godown-inventory-section').scrollIntoView({ behavior: 'smooth' });
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
