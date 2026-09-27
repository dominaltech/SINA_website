// SINA Admin - Godowns & Warehouses Management Controller
(function() {
  let allGodowns = [];
  let allEntries = [];
  let editingGodownId = null;
  let selectedGodownId = 'all';

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
      if (window.sinaAdminDB && typeof window.sinaAdminDB.getProcurementEntries === 'function') {
        allEntries = await window.sinaAdminDB.getProcurementEntries();
      } else if (window.sinaAdminDB && typeof window.sinaAdminDB.getEntries === 'function') {
        allEntries = await window.sinaAdminDB.getEntries();
      } else {
        allEntries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      }
    } catch (err) {
      console.warn('[Godowns] Error in loadGodownsData, using cache:', err);
      allGodowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      allEntries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
    }

    renderGodownPills();
    renderCurrentView();
  }

  // 1. Render Top Horizontal Scrollable Pill Tabs
  function renderGodownPills() {
    const bar = document.getElementById('godown-pills-bar');
    if (!bar) return;

    let html = `
      <button type="button" class="godown-pill-btn ${selectedGodownId === 'all' ? 'active' : ''}" onclick="window.selectGodown('all')" style="${getPillStyle(selectedGodownId === 'all')}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        All Godowns (Combined)
      </button>
    `;

    allGodowns.forEach(gd => {
      const isSelected = selectedGodownId === gd.id;
      html += `
        <button type="button" class="godown-pill-btn ${isSelected ? 'active' : ''}" onclick="window.selectGodown('${gd.id}')" style="${getPillStyle(isSelected)}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          ${escapeHtml(gd.name)}
        </button>
      `;
    });

    bar.innerHTML = html;
  }

  function getPillStyle(isActive) {
    if (isActive) {
      return 'background: var(--purple-primary, #7E22CE); color: #FFFFFF; border: 1.5px solid var(--purple-primary, #7E22CE); padding: 7px 16px; border-radius: 20px; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; box-shadow: 0 2px 6px rgba(126, 34, 206, 0.3); display: inline-flex; align-items: center;';
    } else {
      return 'background: var(--bg-primary, #FFFFFF); color: var(--text-primary, #1E293B); border: 1.5px solid var(--border-color, #E2E8F0); padding: 7px 16px; border-radius: 20px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center;';
    }
  }

  window.selectGodown = function(id) {
    selectedGodownId = id;
    renderGodownPills();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function renderCurrentView() {
    const combinedView = document.getElementById('godowns-combined-view');
    const detailView = document.getElementById('godown-detail-view');

    if (selectedGodownId === 'all') {
      if (combinedView) combinedView.style.display = 'block';
      if (detailView) detailView.style.display = 'none';
      renderGodownsList();
      renderCombinedInventory();
    } else {
      if (combinedView) combinedView.style.display = 'none';
      if (detailView) detailView.style.display = 'block';
      renderSingleGodownView(selectedGodownId);
    }
  }

  // 2. Combined View: Godowns list with cards
  function renderGodownsList() {
    const container = document.getElementById('godowns-list-container');
    if (!container) return;

    if (allGodowns.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-secondary); background: var(--bg-primary); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom: 8px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <p style="font-weight: 600;">No godowns configured yet.</p>
          <p style="font-size: 0.8rem;">Click "Add Godown" to create your first warehouse.</p>
        </div>`;
      return;
    }

    let html = '';
    allGodowns.forEach(gd => {
      const entriesForGd = allEntries.filter(e => e.godown_id === gd.id || e.godown_name === gd.name);
      const entryCount = entriesForGd.length;
      const totalVal = entriesForGd.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);

      html += `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid var(--purple-primary); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--purple-primary); margin: 0;">${escapeHtml(gd.name)}</h4>
              ${gd.location ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">📍 ${escapeHtml(gd.location)}</div>` : ''}
              ${gd.contact_person ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">👤 Manager: <strong>${escapeHtml(gd.contact_person)}</strong></div>` : ''}
              ${gd.contact_phone ? `
                <div style="font-size: 0.82rem; margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                  <span>📞 <strong>${escapeHtml(gd.contact_phone)}</strong></span>
                  <a href="tel:${gd.contact_phone}" onclick="window.FlutterBridge && window.FlutterBridge.postMessage(JSON.stringify({action:'MAKE_CALL',phone:'${gd.contact_phone}'}))" class="btn btn-sm" style="background: #22C55E; color: #FFFFFF; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-decoration: none; font-size: 0.72rem;">
                    Call Manager
                  </a>
                </div>
              ` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${entryCount} purchase entries</div>
              <div style="font-size: 1.05rem; font-weight: 900; color: var(--brand-green, #1E513A); margin-top: 2px;">₹${totalVal.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-color); flex-wrap: wrap;">
            <button type="button" class="btn btn-outline-purple btn-sm" onclick="window.selectGodown('${gd.id}')" style="font-weight: 700;">
              📦 View Inventory & Entries &rarr;
            </button>
            <button type="button" class="btn btn-outline-green btn-sm" onclick="window.editGodown('${gd.id}')">Edit</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.deactivateGodown('${gd.id}')">Deactivate</button>
            <button type="button" class="btn btn-sm" style="background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5;" onclick="window.deleteGodownConfirm('${gd.id}', '${escapeHtml(gd.name)}')">Delete</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  }

  // 3. Combined Commodity Breakdown Table
  function renderCombinedInventory() {
    const container = document.getElementById('inventory-table-container');
    if (!container) return;

    if (allEntries.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 16px;">No entries found across godowns.</p>';
      return;
    }

    renderStockTable(allEntries, container, 'All Godowns (Combined)');
  }

  // 4. Dedicated Single Godown View
  function renderSingleGodownView(godownId) {
    const gd = allGodowns.find(g => g.id === godownId);
    if (!gd) {
      window.selectGodown('all');
      return;
    }

    const entriesForGd = allEntries.filter(e => e.godown_id === gd.id || e.godown_name === gd.name);
    const totalVal = entriesForGd.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);

    // Render Godown Header Card
    const headerCard = document.getElementById('godown-detail-header-card');
    if (headerCard) {
      headerCard.innerHTML = `
        <div class="card" style="background: linear-gradient(135deg, #FAF5FF, #F3E8FF); border: 1.5px solid var(--purple-border); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.selectGodown('all')" style="margin-bottom: 8px; font-weight: 700; padding: 4px 10px; font-size: 0.75rem;">
                &larr; Back to All Godowns
              </button>
              <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--purple-primary); margin: 0;">
                📍 ${escapeHtml(gd.name)}
              </h2>
              ${gd.location ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;"><strong>Address:</strong> ${escapeHtml(gd.location)}</div>` : ''}
              <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                👤 Manager: <strong>${escapeHtml(gd.contact_person || 'Assigned Manager')}</strong>
                ${gd.contact_phone ? ` &bull; 📞 <a href="tel:${gd.contact_phone}" class="text-purple font-bold">${escapeHtml(gd.contact_phone)}</a>` : ''}
              </div>
            </div>
            <div style="text-align: right; background: #FFFFFF; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--purple-border);">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Stock Valuation</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: var(--brand-green, #1E513A);">₹${totalVal.toLocaleString('en-IN')}</div>
              <div style="font-size: 0.75rem; color: var(--purple-primary); font-weight: 700; margin-top: 2px;">${entriesForGd.length} Purchase Entries</div>
            </div>
          </div>
        </div>
      `;
    }

    // Update count badge
    const badge = document.getElementById('godown-entries-count-badge');
    if (badge) badge.textContent = `${entriesForGd.length} Entries`;

    // Render Detailed Purchase Entry Cards
    const entriesContainer = document.getElementById('godown-entries-cards-container');
    if (entriesContainer) {
      if (entriesForGd.length === 0) {
        entriesContainer.innerHTML = `
          <div class="text-center text-muted" style="padding: 32px; background: var(--bg-primary); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style="font-weight: 700; margin: 0;">No purchase entries received at this godown yet.</p>
            <p style="font-size: 0.78rem; margin-top: 4px;">When representatives submit entries routed to this godown, their full breakdown will appear here.</p>
          </div>
        `;
      } else {
        let entriesHtml = '';
        entriesForGd.forEach(entry => {
          const dateStr = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
          const items = entry.items || entry.procurement_items || [];
          const totalAmt = parseFloat(entry.total_amount || 0);
          const paymentMode = (entry.payment_mode || 'Cash').toUpperCase();

          entriesHtml += `
            <div class="card entry-box-card" style="margin-bottom: 14px; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; box-shadow: var(--shadow-sm); background: var(--bg-primary);">
              <!-- Entry Header -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: var(--purple-primary); font-size: 0.95rem;">${escapeHtml(entry.bill_number || ('#G' + (entry.id || '').slice(0, 6).toUpperCase()))}</strong>
                    <span class="status-badge ${entry.status === 'verified' ? 'active' : 'inactive'}" style="font-size: 0.7rem;">
                      ${(entry.status || 'Verified').toUpperCase()}
                    </span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">📅 ${dateStr}</div>
                </div>
                <div style="text-align: right;">
                  <span class="badge" style="background: var(--purple-tint); color: var(--purple-primary); font-weight: 700; font-size: 0.72rem;">
                    Mode: ${paymentMode}
                  </span>
                  <div style="font-size: 1.05rem; font-weight: 900; color: var(--brand-green, #1E513A); margin-top: 2px;">
                    ₹${totalAmt.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <!-- Vendor & Representative Details -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--bg-secondary); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; margin-bottom: 10px;">
                <div>
                  <span class="text-muted" style="font-size: 0.7rem; display: block;">Seller / Merchant Firm:</span>
                  <strong style="color: var(--text-primary);">${escapeHtml(entry.firm_name || 'Direct Seller')}</strong>
                </div>
                <div>
                  <span class="text-muted" style="font-size: 0.7rem; display: block;">Purchased By Rep:</span>
                  <strong style="color: var(--purple-primary);">${escapeHtml(entry.rep_name || 'Field Rep')}</strong>
                </div>
              </div>

              <!-- Items Breakdown Inside this Entry Box -->
              <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                  <thead>
                    <tr style="background: var(--purple-tint); text-align: left; color: var(--purple-dark);">
                      <th style="padding: 6px 8px; font-weight: 700;">Item / Commodity</th>
                      <th style="padding: 6px 8px; font-weight: 700;">Subtype / Category</th>
                      <th style="padding: 6px 8px; font-weight: 700; text-align: right;">Pieces / Qty</th>
                      <th style="padding: 6px 8px; font-weight: 700; text-align: right;">Rate (₹)</th>
                      <th style="padding: 6px 8px; font-weight: 700; text-align: right;">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>`;

          if (items.length > 0) {
            items.forEach(it => {
              const unit = it.unit === 'per_piece' ? 'Pcs' : it.unit === 'per_bag' ? 'Bags' : it.unit === 'per_kg' ? 'Kg' : (it.unit || 'Units');
              const qty = parseFloat(it.quantity) || 0;
              const rate = parseFloat(it.rate) || 0;
              const lineTotal = parseFloat(it.line_total) || (qty * rate);

              entriesHtml += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(it.product_name || it.type || 'Goods')}</td>
                  <td style="padding: 6px 8px; color: var(--text-secondary);">${escapeHtml(it.category_name || '-')}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${qty.toLocaleString('en-IN')} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.72rem;">${unit}</span></td>
                  <td style="padding: 6px 8px; text-align: right; color: var(--text-secondary);">₹${rate.toLocaleString('en-IN')}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 800; color: var(--purple-primary);">₹${lineTotal.toLocaleString('en-IN')}</td>
                </tr>`;
            });
          } else {
            const unit = entry.unit === 'per_piece' ? 'Pcs' : entry.unit === 'per_bag' ? 'Bags' : entry.unit === 'per_kg' ? 'Kg' : (entry.unit || 'Units');
            const qty = parseFloat(entry.quantity) || 1;
            const rate = parseFloat(entry.rate) || 0;
            entriesHtml += `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(entry.type || entry.category_name || 'General Commodity')}</td>
                <td style="padding: 6px 8px; color: var(--text-secondary);">${escapeHtml(entry.category_name || '-')}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${qty.toLocaleString('en-IN')} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.72rem;">${unit}</span></td>
                <td style="padding: 6px 8px; text-align: right; color: var(--text-secondary);">₹${rate.toLocaleString('en-IN')}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 800; color: var(--purple-primary);">₹${totalAmt.toLocaleString('en-IN')}</td>
              </tr>`;
          }

          entriesHtml += `
                  </tbody>
                </table>
              </div>
            </div>`;
        });
        entriesContainer.innerHTML = entriesHtml;
      }
    }

    // Render Godown Total Stock Summary (At the end)
    const stockContainer = document.getElementById('godown-stock-summary-container');
    if (stockContainer) {
      renderStockTable(entriesForGd, stockContainer, gd.name);
    }
  }

  // Generic Stock Summary Table Generator
  function renderStockTable(entries, container, scopeTitle) {
    if (entries.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 16px;">No inventory recorded for this view.</p>';
      return;
    }

    const productMap = {};
    let grandTotalPieces = 0;
    let grandTotalKgs = 0;
    let grandTotalBags = 0;

    entries.forEach(entry => {
      const items = entry.items || entry.procurement_items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const key = (it.product_name || it.type || 'Commodity').trim();
          const unit = it.unit || 'per_kg';
          const qty = parseFloat(it.quantity) || 0;
          const val = parseFloat(it.line_total) || (qty * (parseFloat(it.rate) || 0));

          if (!productMap[key]) {
            productMap[key] = {
              name: key,
              category: it.category_name || 'General',
              unit: unit,
              totalQty: 0,
              totalValue: 0
            };
          }
          productMap[key].totalQty += qty;
          productMap[key].totalValue += val;

          if (unit === 'per_piece') grandTotalPieces += qty;
          else if (unit === 'per_bag') grandTotalBags += qty;
          else grandTotalKgs += qty;
        });
      } else {
        const key = (entry.type || entry.category_name || 'Commodity').trim();
        const unit = entry.unit || 'per_kg';
        const qty = parseFloat(entry.quantity) || 0;
        const val = parseFloat(entry.total_amount) || 0;

        if (!productMap[key]) {
          productMap[key] = {
            name: key,
            category: entry.category_name || 'General',
            unit: unit,
            totalQty: 0,
            totalValue: 0
          };
        }
        productMap[key].totalQty += qty;
        productMap[key].totalValue += val;

        if (unit === 'per_piece') grandTotalPieces += qty;
        else if (unit === 'per_bag') grandTotalBags += qty;
        else grandTotalKgs += qty;
      }
    });

    const products = Object.values(productMap).sort((a, b) => b.totalValue - a.totalValue);
    const grandTotalValuation = products.reduce((s, p) => s + p.totalValue, 0);

    let tableHtml = `
      <div class="card" style="padding: 14px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
          ${grandTotalPieces > 0 ? `<span class="badge" style="background: #E0E7FF; color: #3730A3; font-weight: 800; padding: 4px 10px;">Total Pieces: ${grandTotalPieces.toLocaleString('en-IN')} Pcs</span>` : ''}
          ${grandTotalBags > 0 ? `<span class="badge" style="background: #FEF3C7; color: #92400E; font-weight: 800; padding: 4px 10px;">Total Bags: ${grandTotalBags.toLocaleString('en-IN')} Bags</span>` : ''}
          ${grandTotalKgs > 0 ? `<span class="badge" style="background: #DCFCE7; color: #166534; font-weight: 800; padding: 4px 10px;">Total Weight: ${grandTotalKgs.toLocaleString('en-IN')} Kg</span>` : ''}
        </div>
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: var(--purple-tint); text-align: left;">
                <th style="padding: 10px 12px; font-weight: 700;">Commodity / Product</th>
                <th style="padding: 10px 12px; font-weight: 700;">Subtype / Category</th>
                <th style="padding: 10px 12px; font-weight: 700; text-align: right;">Total Quantity & Pieces</th>
                <th style="padding: 10px 12px; font-weight: 700; text-align: right;">Total Valuation</th>
              </tr>
            </thead>
            <tbody>`;

    products.forEach(p => {
      const unitLabel = p.unit === 'per_piece' ? 'Pieces' : p.unit === 'per_bag' ? 'Bags' : p.unit === 'per_kg' ? 'Kg' : p.unit;
      tableHtml += `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px 12px; font-weight: 700; color: var(--text-primary);">${escapeHtml(p.name)}</td>
              <td style="padding: 10px 12px; color: var(--text-secondary); font-size: 0.8rem;">${escapeHtml(p.category)}</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: var(--purple-primary);">
                ${p.totalQty.toLocaleString('en-IN')} <span style="font-weight: 600; color: var(--text-secondary); font-size: 0.78rem;">${unitLabel}</span>
              </td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 900; color: var(--brand-green, #1E513A);">
                ₹${p.totalValue.toLocaleString('en-IN')}
              </td>
            </tr>`;
    });

    tableHtml += `
            </tbody>
            <tfoot>
              <tr style="background: var(--purple-tint); font-weight: 800; border-top: 2px solid var(--purple-border);">
                <td colspan="3" style="padding: 10px 12px; font-weight: 800; color: var(--purple-dark);">Grand Total Valuation (${escapeHtml(scopeTitle)})</td>
                <td style="padding: 10px 12px; text-align: right; color: var(--brand-green, #1E513A); font-size: 1rem; font-weight: 900;">₹${grandTotalValuation.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
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
        if (document.getElementById('godown-phone-input')) {
          document.getElementById('godown-phone-input').value = '';
        }
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

  window.deleteGodownConfirm = async function(id, name) {
    if (!confirm(`Are you sure you want to permanently delete warehouse "${name}"?`)) return;
    try {
      await window.sinaAdminDB.deleteGodown(id);
      alert(`Warehouse "${name}" deleted.`);
      await loadGodownsData();
    } catch (err) {
      alert('Error deleting godown: ' + err.message);
    }
  };

  window.viewInventory = function(id) {
    window.selectGodown(id);
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
