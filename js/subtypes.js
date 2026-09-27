// SINA Admin - Subtypes & Daily Rates Inline Spreadsheet Controller (Zero Popups)
(function() {
  let typeId = null;
  let sourceId = null;
  let currentType = null;
  let currentSource = null;
  let currentCategory = null;
  let allSubtypes = [];
  let deletedIds = [];
  let hasUnsavedChanges = false;

  async function init() {
    const params = new URLSearchParams(window.location.search);
    typeId = params.get('type_id');
    sourceId = params.get('source_id');

    if (!typeId) {
      alert('Missing type_id parameter. Returning to catalog.');
      window.location.href = 'catalog.html';
      return;
    }

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
      const types = await window.sinaDB.getProductTypes();
      currentType = types.find(t => t.id === typeId);

      const sources = await window.sinaDB.getProcurementSources();
      currentSource = sources.find(s => s.id === (sourceId || currentType?.source_id));

      const categories = await window.sinaDB.getCategories();
      currentCategory = categories.find(c => c.id === (currentSource?.category_id || currentType?.category_id));

      allSubtypes = await window.sinaDB.getProductSubtypes(typeId);

      updateBreadcrumbs();
      renderSpreadsheetRows();
    } catch (err) {
      console.error('Failed to load subtypes data:', err);
      showToast('Error loading subtypes: ' + err.message, 'error');
    }
  }

  function updateBreadcrumbs() {
    const catEl = document.getElementById('breadcrumb-category');
    const srcEl = document.getElementById('breadcrumb-source');
    const typeEl = document.getElementById('breadcrumb-type');
    const titleEl = document.getElementById('page-type-title');

    if (catEl) catEl.textContent = currentCategory ? currentCategory.name : 'Category';
    if (srcEl) srcEl.textContent = currentSource ? currentSource.name : 'All Sources';
    if (typeEl) typeEl.textContent = currentType ? currentType.name : 'Type';
    if (titleEl && currentType) {
      titleEl.textContent = `${currentType.name} — Subtypes & Daily Rates`;
    }
  }

  function renderSpreadsheetRows() {
    const tbody = document.getElementById('spreadsheet-tbody');
    if (!tbody) return;

    if (!allSubtypes || allSubtypes.length === 0) {
      tbody.innerHTML = `
        <tr id="empty-placeholder-row">
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-secondary);">
            <div style="font-weight: 700;">No Subtypes Configured for this Type</div>
            <div style="font-size: 0.85rem; margin-top: 4px;">Click "+ Add New Subtype Row" above to enter products and daily rates.</div>
          </td>
        </tr>`;
      return;
    }

    let html = '';
    allSubtypes.forEach((st, idx) => {
      html += createRowHtml(st, idx + 1);
    });

    tbody.innerHTML = html;
    attachCellChangeListeners();
    updateUnsavedStatus(false);
  }

  function createRowHtml(st, rowNum) {
    const id = st.id || ('new_' + Math.random().toString(36).substring(2, 9));
    const name = st.name || '';
    const nameMr = st.name_mr || '';
    const unit = st.unit || 'per_piece';
    const spec = st.avg_spec || '';
    const rate = st.max_buy_price != null ? parseFloat(st.max_buy_price).toFixed(2) : '0.00';

    return `
      <tr data-id="${id}" class="subtype-row">
        <td style="text-align: center; font-weight: 700; color: var(--text-secondary); font-size: 0.8rem;" class="row-num">${rowNum}</td>
        <td>
          <input type="text" class="cell-input field-name" placeholder="Subtype Name (English)" value="${escapeHtml(name)}">
        </td>
        <td>
          <input type="text" class="cell-input field-name-mr" placeholder="मराठी नाव" value="${escapeHtml(nameMr)}">
        </td>
        <td>
          <select class="cell-select field-unit">
            <option value="per_piece" ${unit === 'per_piece' ? 'selected' : ''}>Per Piece (नग)</option>
            <option value="per_bag" ${unit === 'per_bag' ? 'selected' : ''}>Per Bag (बोरी)</option>
            <option value="per_kg" ${unit === 'per_kg' ? 'selected' : ''}>Per Kg (किलो)</option>
            <option value="per_dozen" ${unit === 'per_dozen' ? 'selected' : ''}>Per Dozen (डझन)</option>
          </select>
        </td>
        <td>
          <input type="text" class="cell-input field-spec" placeholder="e.g. 420g avg / 240 bottles" value="${escapeHtml(spec)}">
        </td>
        <td>
          <input type="number" step="0.01" min="0" class="cell-input price-cell field-rate" placeholder="0.00" value="${rate}">
        </td>
        <td style="text-align: center;">
          <button type="button" class="icon-btn btn-delete-row" title="Delete Subtype" style="color: #DC2626; padding: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </td>
      </tr>`;
  }

  function attachCellChangeListeners() {
    const rows = document.querySelectorAll('.subtype-row');
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input, select');
      inputs.forEach(inp => {
        inp.oninput = () => {
          row.classList.add('row-modified');
          updateUnsavedStatus(true);
        };
      });

      const delBtn = row.querySelector('.btn-delete-row');
      if (delBtn) {
        delBtn.onclick = () => {
          deleteRow(row);
        };
      }
    });
  }

  function deleteRow(row) {
    const id = row.getAttribute('data-id');
    if (id && !id.startsWith('new_')) {
      deletedIds.push(id);
    }
    row.remove();
    renumberRows();
    updateUnsavedStatus(true);
  }

  function renumberRows() {
    const rows = document.querySelectorAll('.subtype-row');
    rows.forEach((r, idx) => {
      const numCell = r.querySelector('.row-num');
      if (numCell) numCell.textContent = (idx + 1).toString();
    });
  }

  function addNewRow() {
    const emptyRow = document.getElementById('empty-placeholder-row');
    if (emptyRow) emptyRow.remove();

    const tbody = document.getElementById('spreadsheet-tbody');
    if (!tbody) return;

    const rowNum = tbody.querySelectorAll('.subtype-row').length + 1;
    const newSubtype = {
      id: null,
      name: '',
      name_mr: '',
      unit: 'per_piece',
      avg_spec: '',
      max_buy_price: 0.00
    };

    const tempDiv = document.createElement('tbody');
    tempDiv.innerHTML = createRowHtml(newSubtype, rowNum);
    const newTr = tempDiv.firstElementChild;
    newTr.classList.add('row-modified');

    tbody.appendChild(newTr);
    attachCellChangeListeners();
    updateUnsavedStatus(true);

    const nameInp = newTr.querySelector('.field-name');
    if (nameInp) {
      nameInp.focus();
    }
  }

  function updateUnsavedStatus(isUnsaved) {
    hasUnsavedChanges = isUnsaved;
    const badge = document.getElementById('modified-count-badge');
    const saveBtn = document.getElementById('btn-save-all-subtypes');
    if (badge) {
      badge.style.display = isUnsaved ? 'inline-block' : 'none';
    }
    if (saveBtn) {
      if (isUnsaved) {
        saveBtn.style.animation = 'pulse 1.5s infinite';
      } else {
        saveBtn.style.animation = 'none';
      }
    }
  }

  async function saveAllSubtypes() {
    const rows = document.querySelectorAll('.subtype-row');
    if (rows.length === 0 && deletedIds.length === 0) {
      showToast('No subtypes to save.', 'info');
      return;
    }

    const saveBtn = document.getElementById('btn-save-all-subtypes');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Saving All...';
    }

    try {
      // 1. Process deletions
      for (const delId of deletedIds) {
        try {
          await window.sinaDB.deleteProductSubtype(delId);
        } catch (delErr) {
          console.warn('Delete subtype err:', delErr);
        }
      }
      deletedIds = [];

      // 2. Collect payloads
      const payloads = [];
      let validationError = null;

      rows.forEach((r, idx) => {
        const id = r.getAttribute('data-id');
        const name = r.querySelector('.field-name')?.value.trim();
        const nameMr = r.querySelector('.field-name-mr')?.value.trim();
        const unit = r.querySelector('.field-unit')?.value;
        const avgSpec = r.querySelector('.field-spec')?.value.trim();
        const rate = parseFloat(r.querySelector('.field-rate')?.value) || 0;

        if (!name) {
          validationError = `Row #${idx + 1} has an empty Subtype Name. Please enter a name or delete the row.`;
          return;
        }

        const item = {
          type_id: typeId,
          source_id: sourceId || currentType?.source_id,
          name: name,
          name_mr: nameMr || null,
          name_hi: null,
          unit: unit || 'per_piece',
          avg_spec: avgSpec || null,
          max_buy_price: rate,
          default_rate: rate,
          is_active: true
        };

        if (id && !id.startsWith('new_')) {
          item.id = id;
        }

        payloads.push(item);
      });

      if (validationError) {
        alert(validationError);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = 'Save All Changes';
        }
        return;
      }

      // 3. Batch save to Supabase
      if (payloads.length > 0) {
        await window.sinaDB.saveProductSubtypesBatch(payloads);

        if (window.dispatchPushNotification) {
          window.dispatchPushNotification({
            target_role: 'representative',
            title: 'Procurement Rates Updated!',
            body: `Admin updated daily buying prices for ${currentType?.name || 'materials'}. Tap to view updated rates.`,
            data: { url: 'entry.html', screen: 'entry.html' }
          });
        }
      }

      showToast(`Success! All ${payloads.length} subtypes and daily rates saved.`, 'success');
      await loadData();
    } catch (err) {
      console.error('Error saving all subtypes:', err);
      alert('Error saving subtypes: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save All Changes`;
      }
    }
  }

  function setupEventListeners() {
    const addRowBtn = document.getElementById('btn-add-row');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        addNewRow();
      });
    }

    const saveAllBtn = document.getElementById('btn-save-all-subtypes');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', async () => {
        await saveAllSubtypes();
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
