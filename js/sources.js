// SINA Admin - Procurement Sources Controller
(function() {
  let allCategories = [];
  let allSources = [];
  let allTypes = [];
  let selectedCategoryFilter = 'all';

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
      allCategories = await window.sinaDB.getCategories();
      allSources = await window.sinaDB.getProcurementSources();
      allTypes = await window.sinaDB.getProductTypes();
      populateCategoryDropdowns();
      renderSourcesCards();
    } catch (err) {
      console.error('Failed to load sources data:', err);
      showToast('Error loading sources: ' + err.message, 'error');
    }
  }

  function populateCategoryDropdowns() {
    const filterSel = document.getElementById('source-cat-filter');
    const modalSel = document.getElementById('src-category-select');

    if (filterSel) {
      let opts = '<option value="all">All Categories</option>';
      allCategories.forEach(c => {
        opts += `<option value="${c.id}" ${selectedCategoryFilter === c.id ? 'selected' : ''}>${c.name}</option>`;
      });
      filterSel.innerHTML = opts;
    }

    if (modalSel) {
      let mOpts = '<option value="" disabled selected>Select Category...</option>';
      allCategories.forEach(c => {
        mOpts += `<option value="${c.id}">${c.name}</option>`;
      });
      modalSel.innerHTML = mOpts;
    }
  }

  function renderSourcesCards() {
    const container = document.getElementById('sources-container');
    if (!container) return;

    let filtered = allSources;
    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(s => s.category_id === selectedCategoryFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <div style="font-weight: 700;">No Sources Found</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">Click "+ Add Source" to add procurement sources for this category.</div>
        </div>`;
      return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;">';
    filtered.forEach(src => {
      const cat = allCategories.find(c => c.id === src.category_id);
      const catName = cat ? cat.name : 'General';
      const sourceTypes = allTypes.filter(t => t.source_id === src.id);

      html += `
        <div class="card" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <span class="badge" style="background: #E0F2FE; color: #0369A1; font-size: 0.72rem; font-weight: 700; margin-bottom: 4px; display: inline-block;">
                ${catName}
              </span>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0;">${src.name}</h3>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.editSource('${src.id}')" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.deleteSource('${src.id}')" style="padding: 4px 8px; font-size: 0.75rem; color: #DC2626;">Delete</button>
            </div>
          </div>

          <!-- Localization details -->
          <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; margin: 10px 0; display: flex; flex-direction: column; gap: 3px;">
            <div><strong>मराठी (Marathi):</strong> ${src.name_mr || '—'}</div>
            <div><strong>हिन्दी (Hindi):</strong> ${src.name_hi || '—'}</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 6px;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              <strong>${sourceTypes.length}</strong> Types Configured
            </div>
            <a href="catalog.html?source_id=${src.id}" class="btn btn-outline-green btn-sm" style="padding: 4px 10px; font-size: 0.78rem; text-decoration: none;">
              Manage Types &rarr;
            </a>
          </div>
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function setupEventListeners() {
    const addBtn = document.getElementById('btn-add-source');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openSourceModal();
      });
    }

    const saveBtn = document.getElementById('btn-save-source');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await saveSourceFromModal();
      });
    }

    const filterSel = document.getElementById('source-cat-filter');
    if (filterSel) {
      filterSel.addEventListener('change', () => {
        selectedCategoryFilter = filterSel.value;
        renderSourcesCards();
      });
    }
  }

  window.openSourceModal = function(src = null) {
    const modal = document.getElementById('source-modal');
    const title = document.getElementById('modal-source-title');
    const idInp = document.getElementById('src-id-input');
    const catSel = document.getElementById('src-category-select');
    const nameInp = document.getElementById('src-name-input');
    const mrInp = document.getElementById('src-name-mr-input');
    const hiInp = document.getElementById('src-name-hi-input');

    if (!modal) return;

    if (src) {
      if (title) title.textContent = 'Edit Procurement Source';
      if (idInp) idInp.value = src.id || '';
      if (catSel) catSel.value = src.category_id || '';
      if (nameInp) nameInp.value = src.name || '';
      if (mrInp) mrInp.value = src.name_mr || '';
      if (hiInp) hiInp.value = src.name_hi || '';
    } else {
      if (title) title.textContent = 'Add Procurement Source';
      if (idInp) idInp.value = '';
      if (catSel) catSel.value = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : (allCategories[0]?.id || '');
      if (nameInp) nameInp.value = '';
      if (mrInp) mrInp.value = '';
      if (hiInp) hiInp.value = '';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
  };

  window.closeSourceModal = function() {
    const modal = document.getElementById('source-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  window.editSource = function(id) {
    const src = allSources.find(s => s.id === id);
    if (src) openSourceModal(src);
  };

  window.deleteSource = async function(id) {
    if (!confirm('Are you sure you want to delete this procurement source? All types and subtypes under this source will be affected.')) return;
    try {
      await window.sinaDB.deleteProcurementSource(id);
      showToast('Source deleted', 'info');
      await loadData();
    } catch (err) {
      alert('Failed to delete source: ' + err.message);
    }
  };

  async function saveSourceFromModal() {
    const id = document.getElementById('src-id-input')?.value.trim();
    const categoryId = document.getElementById('src-category-select')?.value;
    const name = document.getElementById('src-name-input')?.value.trim();
    const nameMr = document.getElementById('src-name-mr-input')?.value.trim();
    const nameHi = document.getElementById('src-name-hi-input')?.value.trim();

    if (!categoryId) {
      alert('Please select a Category.');
      return;
    }
    if (!name) {
      alert('Please enter Source Name in English (e.g. Bar/Dhaba/Wineshop).');
      return;
    }

    const payload = {
      category_id: categoryId,
      name: name,
      name_mr: nameMr || null,
      name_hi: nameHi || null,
      is_active: true
    };

    try {
      if (id) {
        payload.id = id;
      }
      await window.sinaDB.saveProcurementSource(payload);
      showToast('Source saved successfully!', 'success');
      closeSourceModal();
      await loadData();
    } catch (err) {
      alert('Failed to save source: ' + err.message);
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
