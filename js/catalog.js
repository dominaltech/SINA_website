// SINA Admin - Product & Category Master Controller
(function() {
  let categories = [];
  let products = [];

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await loadCatalog();
    setupProductSearch();
    setupAddCategoryModal();
    setupAddProductModal();
    setupEditProductModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadCatalog();
  };

  function setupProductSearch() {
    const searchInput = document.getElementById('product-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', renderProductsTable);
    }
  }

  let selectedCategoryId = null;

  async function loadCatalog() {
    categories = await window.sinaAdminDB.getCategories();
    products = await window.sinaAdminDB.getProducts();

    renderCategoriesList();
    renderCategorySelectorBoxes();
    renderSelectedCategoryTypes();
    renderSourcesTypesQuickGrid();
    renderProductsTable();
    populateCategoryDropdown();
  }

  function renderCategorySelectorBoxes() {
    const container = document.getElementById('category-selector-boxes');
    if (!container) return;

    if (!categories || categories.length === 0) {
      container.innerHTML = '<div style="font-size: 0.85rem; color: #64748B;">No categories found. Click "+ Add Category" above.</div>';
      return;
    }

    if (!selectedCategoryId || !categories.some(c => c.id === selectedCategoryId)) {
      selectedCategoryId = categories[0].id;
    }

    container.innerHTML = categories.map(cat => {
      const isSelected = cat.id === selectedCategoryId;
      const bg = isSelected ? '#166534' : '#F1F5F9';
      const color = isSelected ? '#FFFFFF' : '#334155';
      const border = isSelected ? '#166534' : '#CBD5E1';
      const shadow = isSelected ? '0 2px 6px rgba(22, 101, 52, 0.3)' : 'none';

      return `
        <button type="button" 
          onclick="window.selectCatalogCategory('${cat.id}')"
          style="background: ${bg}; color: ${color}; border: 1.5px solid ${border}; padding: 7px 14px; border-radius: 8px; font-size: 0.88rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: ${shadow}; transition: all 0.15s ease;">
          <span>${escapeHtml(cat.name)}</span>
          ${cat.name_mr ? `<span style="font-size: 0.72rem; opacity: 0.85; font-weight: 500;">(${escapeHtml(cat.name_mr)})</span>` : ''}
        </button>
      `;
    }).join('');
  }

  window.selectCatalogCategory = function(catId) {
    selectedCategoryId = catId;
    renderCategorySelectorBoxes();
    renderSelectedCategoryTypes();
  };

  async function renderSelectedCategoryTypes() {
    const displayEl = document.getElementById('category-types-display');
    if (!displayEl) return;

    const currentCat = categories.find(c => c.id === selectedCategoryId);
    if (!currentCat) {
      displayEl.innerHTML = '<div style="font-size: 0.85rem; color: #64748B; text-align: center;">Select a category above.</div>';
      return;
    }

    try {
      const types = await window.sinaAdminDB.getProductTypes();
      let matchingTypes = (types || []).filter(t => {
        return (t.category_id && t.category_id === currentCat.id) ||
               (t.category_name && t.category_name.toLowerCase() === currentCat.name.toLowerCase());
      });

      if (matchingTypes.length === 0) {
        const catProducts = products.filter(p => p.category_id === currentCat.id);
        const distinctTypeNames = [...new Set(catProducts.map(p => p.type || p.name).filter(Boolean))];
        matchingTypes = distinctTypeNames.map((name, idx) => ({
          id: 'type_' + currentCat.id + '_' + idx,
          name: name,
          category_id: currentCat.id,
          category_name: currentCat.name
        }));
      }

      let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #166534; letter-spacing: 0.5px;">Types in Category:</span>
            <strong style="font-size: 1rem; color: #0F172A; margin-left: 6px;">${escapeHtml(currentCat.name)}</strong>
          </div>
          <button type="button" class="btn btn-outline-green btn-xs" onclick="window.promptAddNewType('${currentCat.id}', '${escapeHtml(currentCat.name)}')" style="font-size: 0.75rem; padding: 4px 10px; font-weight: 700;">
            + Add Type
          </button>
        </div>
      `;

      if (matchingTypes.length === 0) {
        html += `
          <div style="text-align: center; padding: 20px; color: #64748B;">
            <div style="font-size: 0.9rem; font-weight: 600;">No Types Configured for ${escapeHtml(currentCat.name)}</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">Click "+ Add Type" above to define types and their purchase daily rates.</div>
          </div>
        `;
      } else {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">';
        matchingTypes.forEach(t => {
          html += `
            <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #0F172A;">${escapeHtml(t.name)}</div>
                <div style="font-size: 0.75rem; color: #64748B; margin-top: 2px;">Category: ${escapeHtml(currentCat.name)}</div>
              </div>
              <a href="subtypes.html?type_id=${t.id}&type_name=${encodeURIComponent(t.name)}" class="btn btn-primary btn-sm" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 700; text-decoration: none; white-space: nowrap;">
                Edit Subtypes &rarr;
              </a>
            </div>
          `;
        });
        html += '</div>';
      }

      displayEl.innerHTML = html;
    } catch (e) {
      console.warn('Error loading category types:', e);
      displayEl.innerHTML = `<div style="color: #DC2626; font-size: 0.85rem;">Error loading types: ${e.message}</div>`;
    }
  }

  window.promptAddNewType = async function(catId, catName) {
    const typeName = prompt(`Enter new Type name for ${catName} (e.g. Broken, Solid, Grade A):`);
    if (!typeName || !typeName.trim()) return;
    try {
      await window.sinaAdminDB.saveProductType({
        category_id: catId,
        category_name: catName,
        name: typeName.trim()
      });
      alert(`Type "${typeName.trim()}" added to ${catName}.`);
      await renderSelectedCategoryTypes();
    } catch (err) {
      alert('Error creating type: ' + err.message);
    }
  };

  function renderCategoriesList() {
    const listEl = document.getElementById('categories-chip-list');
    if (!listEl) return;

    if (!categories || categories.length === 0) {
      listEl.innerHTML = '<span class="text-muted">No categories added yet.</span>';
      return;
    }

    listEl.innerHTML = categories.map(c => `
      <div style="display: inline-flex; align-items: center; background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 6px; padding: 4px 8px; margin: 3px; font-size: 0.82rem; font-weight: 600; color: #1E293B;">
        <span>${escapeHtml(c.name)}</span>
        ${c.name_mr ? `<span style="font-size: 0.72rem; color: #64748B; margin-left: 4px;">(${escapeHtml(c.name_mr)})</span>` : ''}
        <button type="button" onclick="window.openEditCategoryModal('${c.id}')" title="Edit Category" style="background: transparent; border: none; cursor: pointer; margin-left: 6px; padding: 2px 4px; color: #166534; font-size: 0.85rem; display: flex; align-items: center; border-radius: 4px;">
          ✏️
        </button>
      </div>
    `).join('');
  }

  window.openEditCategoryModal = function(catId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const modal = document.getElementById('edit-cat-modal');
    if (!modal) return;
    document.getElementById('edit-cat-id').value = cat.id;
    document.getElementById('edit_cat_name').value = cat.name || '';
    document.getElementById('edit_cat_mr').value = cat.name_mr || '';
    document.getElementById('edit_cat_hi').value = cat.name_hi || '';
    modal.classList.add('active');
  };

  window.closeEditCategoryModal = function() {
    const modal = document.getElementById('edit-cat-modal');
    if (modal) modal.classList.remove('active');
  };

  window.saveEditedCategory = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-cat-id').value;
    const name = document.getElementById('edit_cat_name').value.trim();
    const nameMr = document.getElementById('edit_cat_mr').value.trim();
    const nameHi = document.getElementById('edit_cat_hi').value.trim();

    if (!name) {
      alert('Category Name (English) is required.');
      return;
    }

    try {
      await window.sinaAdminDB.updateCategory(id, {
        name: name,
        name_mr: nameMr,
        name_hi: nameHi
      });
      alert(`Category "${name}" updated successfully.`);
      window.closeEditCategoryModal();
      await loadCatalog();
    } catch (err) {
      alert('Error updating category: ' + err.message);
    }
  };

  function renderProductsTable() {
    const tbody = document.getElementById('products-table-tbody');
    if (!tbody) return;

    const query = document.getElementById('product-search-input')?.value.trim().toLowerCase() || '';

    let filtered = products.filter(p => {
      const cat = categories.find(c => c.id === p.category_id);
      const catName = cat ? cat.name.toLowerCase() : 'general';
      return !query || 
        p.name.toLowerCase().includes(query) || 
        (p.type && p.type.toLowerCase().includes(query)) ||
        catName.includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No products found matching your search.</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id);
      const unitLabel = getUnitLabel(p.default_unit);
      const isFieldAdded = p.type === 'Field Added' || !p.category_id;
      const defRate = parseFloat(p.default_rate || 0);
      const maxPrice = parseFloat(p.max_buy_price || p.default_rate || 0);

      html += `
        <tr>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            ${isFieldAdded ? '<span class="status-badge pending" style="margin-left: 6px; font-size: 0.7rem;">Field Added</span>' : ''}
          </td>
          <td>${escapeHtml(p.type || 'Standard')}</td>
          <td><span class="status-badge active">${escapeHtml(cat ? cat.name : 'General')}</span></td>
          <td><span style="font-weight: 600; color: var(--text-secondary);">${unitLabel}</span></td>
          <td><strong>₹${defRate.toLocaleString('en-IN')}</strong></td>
          <td><strong style="color: #E65100; font-weight: 800;">₹${maxPrice.toLocaleString('en-IN')}</strong></td>
          <td style="white-space: nowrap;">
            <button type="button" class="btn btn-outline-green btn-sm" onclick="window.openEditProductModal('${p.id}')" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;">
              Edit
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteProductItem('${p.id}')" style="padding: 4px 8px; font-size: 0.75rem;">
              Delete
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function getUnitLabel(u) {
    switch (u) {
      case 'per_kg': return 'Per Kg';
      case 'per_piece': return 'Per Piece';
      case 'per_dozen': return 'Per Dozen';
      case 'per_box': return 'Per Box';
      case 'per_bag': return 'Per Bag';
      case 'per_quintal': return 'Per Quintal';
      case 'per_litre': return 'Per Litre';
      default: return u || 'Per Kg';
    }
  }

  function populateCategoryDropdown() {
    const addSelect = document.getElementById('prod_category_select');
    const editSelect = document.getElementById('edit_prod_category');

    const options = ['<option value="">-- Choose Category --</option>']
      .concat(categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`))
      .join('');

    if (addSelect) addSelect.innerHTML = options;
    if (editSelect) editSelect.innerHTML = options;
  }

  function setupAddCategoryModal() {
    const openBtn = document.getElementById('btn-open-add-cat');
    const modal = document.getElementById('add-cat-modal');
    const closeBtn = document.getElementById('btn-close-cat-modal');
    const form = document.getElementById('add-cat-form');

    if (!openBtn || !modal) return;
    openBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new_cat_name')?.value.trim();
        if (!name) return;
        await window.sinaAdminDB.addCategory(name);
        alert(`Category "${name}" added.`);
        modal.classList.remove('active');
        form.reset();
        await loadCatalog();
      });
    }
  }

  function setupAddProductModal() {
    const openBtn = document.getElementById('btn-open-add-prod');
    const modal = document.getElementById('add-prod-modal');
    const closeBtn = document.getElementById('btn-close-prod-modal');
    const form = document.getElementById('add-prod-form');
    const unitSelect = document.getElementById('new_prod_unit');

    if (unitSelect) {
      unitSelect.addEventListener('change', () => {
        const uLabel = getUnitLabel(unitSelect.value);
        const rateHint = document.getElementById('new_rate_unit_hint');
        const maxHint = document.getElementById('new_max_unit_hint');
        if (rateHint) rateHint.textContent = `Rate in ₹ ${uLabel}`;
        if (maxHint) maxHint.textContent = `⚠️ Field reps cannot enter a rate higher than this price ${uLabel}.`;
      });
    }

    if (!openBtn || !modal) return;
    openBtn.addEventListener('click', () => modal.classList.add('active'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new_prod_name')?.value.trim();
        const type = document.getElementById('new_prod_type')?.value.trim();
        const categoryId = document.getElementById('prod_category_select')?.value;
        const unit = document.getElementById('new_prod_unit')?.value || 'per_kg';
        const rate = parseFloat(document.getElementById('new_prod_rate')?.value) || 0;
        const maxPrice = parseFloat(document.getElementById('new_prod_max_price')?.value) || rate;

        if (!name || !categoryId) {
          alert('Product name and category are required.');
          return;
        }

        if (maxPrice < rate) {
          if (!confirm(`Notice: Maximum buy price (₹${maxPrice}) is lower than the default rate (₹${rate}). Proceed anyway?`)) {
            return;
          }
        }

        await window.sinaAdminDB.addProduct({
          name,
          type,
          category_id: categoryId,
          default_unit: unit,
          default_rate: rate,
          max_buy_price: maxPrice
        });

        alert(`Product "${name}" with max buy price ₹${maxPrice} (${getUnitLabel(unit)}) added.`);
        modal.classList.remove('active');
        form.reset();
        await loadCatalog();
      });
    }
  }

  function setupEditProductModal() {
    const modal = document.getElementById('edit-prod-modal');
    const closeBtn = document.getElementById('btn-close-edit-prod-modal');
    const form = document.getElementById('edit-prod-form');
    const unitSelect = document.getElementById('edit_prod_unit');

    if (unitSelect) {
      unitSelect.addEventListener('change', () => {
        const uLabel = getUnitLabel(unitSelect.value);
        const rateHint = document.getElementById('edit_rate_unit_hint');
        const maxHint = document.getElementById('edit_max_unit_hint');
        if (rateHint) rateHint.textContent = `Rate in ₹ ${uLabel}`;
        if (maxHint) maxHint.textContent = `⚠️ Field reps cannot enter a rate higher than this price ${uLabel}.`;
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (form && modal) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit_prod_id')?.value;
        const name = document.getElementById('edit_prod_name')?.value.trim();
        const type = document.getElementById('edit_prod_type')?.value.trim();
        const categoryId = document.getElementById('edit_prod_category')?.value;
        const unit = document.getElementById('edit_prod_unit')?.value || 'per_kg';
        const rate = parseFloat(document.getElementById('edit_prod_rate')?.value) || 0;
        const maxPrice = parseFloat(document.getElementById('edit_prod_max_price')?.value) || rate;

        if (!id || !name || !categoryId) {
          alert('Missing required fields.');
          return;
        }

        await window.sinaAdminDB.updateProduct(id, {
          name,
          type,
          category_id: categoryId,
          default_unit: unit,
          default_rate: rate,
          max_buy_price: maxPrice
        });

        alert(`Product "${name}" updated. Max buy price is now ₹${maxPrice} (${getUnitLabel(unit)}).`);
        modal.classList.remove('active');
        await loadCatalog();
      });
    }
  }

  window.openEditProductModal = function(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const modal = document.getElementById('edit-prod-modal');
    if (!modal) return;

    populateCategoryDropdown();

    document.getElementById('edit_prod_id').value = prod.id;
    document.getElementById('edit_prod_name').value = prod.name;
    document.getElementById('edit_prod_type').value = prod.type || '';
    document.getElementById('edit_prod_category').value = prod.category_id || '';
    document.getElementById('edit_prod_unit').value = prod.default_unit || 'per_kg';
    document.getElementById('edit_prod_rate').value = prod.default_rate || '';
    document.getElementById('edit_prod_max_price').value = prod.max_buy_price || prod.default_rate || '';

    const uLabel = getUnitLabel(prod.default_unit || 'per_kg');
    const rateHint = document.getElementById('edit_rate_unit_hint');
    const maxHint = document.getElementById('edit_max_unit_hint');
    if (rateHint) rateHint.textContent = `Rate in ₹ ${uLabel}`;
    if (maxHint) maxHint.textContent = `⚠️ Field reps cannot enter a rate higher than this price ${uLabel}.`;

    modal.classList.add('active');
  };

  window.deleteProductItem = async function(id) {
    if (confirm('Delete this product from catalog?')) {
      await window.sinaAdminDB.deleteProduct(id);
      await loadCatalog();
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
