// SINA Admin - Procurement Receipts & Vouchers Controller
(function() {
  let allEntries = [];
  let allFirms = [];
  let currentVoucherEntry = null;

  // Default format settings
  let receiptSettings = {
    showLogo: true,
    subtitle: 'Official Goods Procurement Voucher',
    showAddress: true,
    showPhone: true,
    footerTerms: 'All weighbridge weights final. Goods received in good condition. System generated voucher.'
  };

  async function init() {
    loadSavedSettings();
    await loadData();
    setupEventListeners();

    // Check if URL has ?entry_id=... to auto-open preview
    const params = new URLSearchParams(window.location.search);
    const targetEntryId = params.get('entry_id');
    if (targetEntryId) {
      const match = allEntries.find(e => e.id === targetEntryId);
      if (match) {
        window.openVoucherModal(match);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshCurrentPageData = async function() {
    await loadData();
  };

  function loadSavedSettings() {
    try {
      const saved = localStorage.getItem('sina_receipt_settings');
      if (saved) {
        receiptSettings = Object.assign(receiptSettings, JSON.parse(saved));
      }
    } catch (e) {}
  }

  async function loadData() {
    try {
      allEntries = await window.sinaDB.getProcurementEntries();
      allFirms = await window.sinaDB.getPurchasingFirms();
      populateFirmFilter();
      renderReceiptsList();
    } catch (err) {
      console.error('Failed to load receipts data:', err);
      showToast('Error loading receipts: ' + err.message, 'error');
    }
  }

  function populateFirmFilter() {
    const sel = document.getElementById('filter-firm-select');
    if (!sel) return;

    let opts = '<option value="all">All Purchasing Firms</option>';
    allFirms.forEach(f => {
      opts += `<option value="${f.id}">${f.firm_name}</option>`;
    });
    sel.innerHTML = opts;
  }

  function renderReceiptsList() {
    const container = document.getElementById('receipts-list-container');
    if (!container) return;

    const searchTerm = document.getElementById('search-receipt-input')?.value.trim().toLowerCase() || '';
    const firmFilter = document.getElementById('filter-firm-select')?.value || 'all';
    const gstFilter = document.getElementById('filter-gst-select')?.value || 'all';

    let filtered = allEntries.filter(e => {
      if (firmFilter !== 'all' && e.our_firm_id !== firmFilter) return false;
      if (gstFilter === 'gst' && !e.is_gst) return false;
      if (gstFilter === 'nogst' && e.is_gst) return false;

      if (searchTerm) {
        const text = `${e.id || ''} ${e.firm_name || ''} ${e.contact_person || ''} ${e.rep_name || ''} ${e.our_firm_name || ''}`.toLowerCase();
        if (!text.includes(searchTerm)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px; color: var(--text-secondary);">
          <div style="font-weight: 700;">No Receipts Found</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">Try changing the search query or filters above.</div>
        </div>`;
      return;
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    let html = '';
    filtered.forEach(e => {
      const dt = e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const netTotal = parseFloat(e.total_amount) || 0;
      const subtotal = parseFloat(e.subtotal_amount != null ? e.subtotal_amount : e.total_amount) || 0;
      const ourFirm = e.our_firm_name || 'SINA Procurement';
      const itemsCount = (e.procurement_items && e.procurement_items.length) || (e.items && e.items.length) || 1;
      const voucherNum = e.bill_number || ((e.id && e.id.length > 8) ? ('VCH-' + e.id.slice(0, 8).toUpperCase()) : (e.id || 'VCH-0001'));

      html += `
        <div class="card" style="padding: 16px; border-left: 4px solid var(--green-primary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-family: monospace; font-weight: 800; font-size: 0.85rem; color: #1E293B; background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">
                ${voucherNum}
              </span>
              <span style="font-size: 0.78rem; color: var(--text-secondary);">${dt}</span>
              ${e.is_gst ? '<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.7rem; font-weight: 800;">GST (9%)</span>' : '<span class="badge" style="background: #F3F4F6; color: #4B5563; font-size: 0.7rem;">Non-GST</span>'}
            </div>

            <div style="font-size: 1.02rem; font-weight: 800; color: var(--text-primary);">
              ${e.firm_name || 'Seller Firm'}
              <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-secondary);">(${e.source || 'General Source'})</span>
            </div>

            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
              Buyer: <strong>${ourFirm}</strong> &bull; Rep: <strong>${e.rep_name || 'Rep'}</strong> &bull; ${itemsCount} Goods Items
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="text-align: right;">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Net Paid</div>
              <div style="font-size: 1.2rem; font-weight: 900; color: var(--green-dark);">
                ₹${netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.previewReceipt('${e.id}')" style="padding: 6px 12px; font-weight: 700; font-size: 0.8rem;">
                Download / View
              </button>
            </div>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  window.previewReceipt = function(entryId) {
    const entry = allEntries.find(e => e.id === entryId);
    if (!entry) return;
    openVoucherModal(entry);
  };

  window.openVoucherModal = function(entry) {
    currentVoucherEntry = entry;
    const modal = document.getElementById('voucher-preview-modal');
    const container = document.getElementById('voucher-render-element');
    if (!modal || !container) return;

    container.innerHTML = generateVoucherHtml(entry);
    modal.classList.add('active');
    modal.style.display = 'flex';
  };

  window.closeVoucherModal = function() {
    const modal = document.getElementById('voucher-preview-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  function generateVoucherHtml(e) {
    const dt = e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const voucherNum = e.bill_number || ((e.id && e.id.length > 8) ? ('VCH-' + e.id.slice(0, 8).toUpperCase()) : (e.id || 'VCH-0001'));

    // Matching Purchasing Firm
    const firm = allFirms.find(f => f.id === e.our_firm_id || f.firm_name === e.our_firm_name) || {
      firm_name: e.our_firm_name || 'SINA Agro Industries Ltd.',
      gst_number: e.our_firm_gst || '',
      address: '',
      phone: ''
    };

    const subtotal = parseFloat(e.subtotal_amount != null ? e.subtotal_amount : e.total_amount) || 0;
    const gstAmount = e.is_gst ? (parseFloat(e.gst_amount) || (subtotal * 0.09)) : 0;
    const netTotal = subtotal + gstAmount;

    // Items list
    const items = (Array.isArray(e.procurement_items) && e.procurement_items.length > 0)
      ? e.procurement_items
      : ((Array.isArray(e.items) && e.items.length > 0)
        ? e.items
        : [{
            product_name: e.source || 'Goods',
            subtypes: Array.isArray(e.subtypes) ? e.subtypes.join(', ') : e.subtypes,
            quantity: 1,
            unit: 'unit',
            rate: subtotal,
            line_total: subtotal
          }]);

    let itemsTableRows = '';
    items.forEach((item, idx) => {
      const pName = item.subtypes || item.product_name || 'Goods';
      const qty = parseFloat(item.quantity) || 0;
      const unit = formatUnitLabel(item.unit);
      const rate = parseFloat(item.rate) || 0;
      const lineTotal = parseFloat(item.line_total != null ? item.line_total : (qty * rate)) || 0;

      itemsTableRows += `
        <tr>
          <td style="text-align: center; width: 30px;">${idx + 1}</td>
          <td>
            <strong>${pName}</strong>
            ${item.avg_spec ? `<div style="font-size: 0.72rem; color: #64748B;">(${item.avg_spec})</div>` : ''}
          </td>
          <td style="text-align: center;">${qty.toLocaleString('en-IN')} ${unit}</td>
          <td style="text-align: right;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: 700;">₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    });

    return `
      <div class="voucher-header">
        ${receiptSettings.showLogo ? '<img src="assets/logo.png" alt="SINA" style="width: 44px; height: 44px; margin-bottom: 4px; object-fit: contain;">' : ''}
        <div class="voucher-firm-name">${firm.firm_name}</div>
        ${firm.gst_number ? `<div class="voucher-firm-gst">GSTIN: ${firm.gst_number}</div>` : ''}
        ${(receiptSettings.showAddress && firm.address) ? `<div class="voucher-firm-opt">${firm.address}</div>` : ''}
        ${(receiptSettings.showPhone && (firm.phone || firm.mobile)) ? `<div class="voucher-firm-opt">Tel: ${firm.phone || firm.mobile}</div>` : ''}
        <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
          ${receiptSettings.subtitle || 'Goods Procurement Voucher'}
        </div>
      </div>

      <div class="voucher-meta-grid">
        <div><strong>Voucher No:</strong> ${voucherNum}</div>
        <div><strong>Date & Time:</strong> ${dt}</div>
        <div><strong>Seller / Supplier:</strong> ${e.firm_name || '—'}</div>
        <div><strong>Seller Contact:</strong> ${e.contact_person || '—'} (${e.mobile || '—'})</div>
        <div><strong>Source:</strong> ${e.source || 'General'}</div>
        <div><strong>Field Representative:</strong> ${e.rep_name || 'Staff'}</div>
      </div>

      <table class="voucher-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Item / Commodity</th>
            <th style="text-align: center;">Quantity</th>
            <th style="text-align: right;">Rate (₹)</th>
            <th style="text-align: right;">Subtotal (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsTableRows}
        </tbody>
      </table>

      <div class="voucher-total-row">
        <div class="voucher-total-box">
          <div style="display: flex; justify-content: space-between; color: #475569;">
            <span>Subtotal:</span>
            <strong style="color: #0F172A;">₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          ${e.is_gst ? `
          <div style="display: flex; justify-content: space-between; color: #C2410C;">
            <span>GST (9%):</span>
            <strong>+ ₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 900; color: #166534; border-top: 2px solid #E2E8F0; padding-top: 6px; margin-top: 4px;">
            <span>Net Total:</span>
            <span>₹${netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div class="voucher-footer">
        <div style="max-width: 340px;">
          ${receiptSettings.footerTerms ? `<div>${receiptSettings.footerTerms}</div>` : ''}
        </div>
        <div style="text-align: center; border-top: 1px solid #94A3B8; padding-top: 4px; min-width: 140px;">
          <strong>Authorized Signatory</strong>
        </div>
      </div>`;
  }

  function formatUnitLabel(unit) {
    if (!unit) return 'pcs';
    if (unit === 'per_piece') return 'pcs';
    if (unit === 'per_bag') return 'bags';
    if (unit === 'per_kg') return 'kg';
    if (unit === 'per_dozen') return 'doz';
    return unit.replace('per_', '');
  }

  // ─── Helper: load all images in el as blob object URLs to avoid canvas taint ───
  async function _preloadImagesForCanvas(el) {
    const imgs = Array.from(el.querySelectorAll('img'));
    const restoreList = [];
    await Promise.all(imgs.map(async (img) => {
      const originalSrc = img.src;
      if (!originalSrc || originalSrc.startsWith('blob:') || originalSrc.startsWith('data:')) return;
      try {
        const resp = await fetch(originalSrc, { mode: 'cors', cache: 'force-cache' });
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        restoreList.push({ img, originalSrc, blobUrl });
        img.src = blobUrl;
        img.crossOrigin = 'anonymous';
        // Wait for image to load from blob
        await new Promise(resolve => {
          if (img.complete) { resolve(); return; }
          img.onload = resolve;
          img.onerror = resolve;
        });
      } catch (e) {
        // If CORS fetch fails, set crossOrigin and hope for the best
        img.crossOrigin = 'anonymous';
      }
    }));
    return restoreList;
  }

  function _restoreImages(restoreList) {
    restoreList.forEach(({ img, originalSrc, blobUrl }) => {
      img.src = originalSrc;
      URL.revokeObjectURL(blobUrl);
    });
  }

  // DOWNLOAD AS IMAGE (PNG)
  window.downloadAsImage = async function() {
    const el = document.getElementById('voucher-render-element');
    if (!el || !currentVoucherEntry) return;

    const btn = document.getElementById('btn-download-image');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Generating Image...';
    }

    let restoreList = [];
    try {
      // Pre-load all images as safe blob URLs to avoid canvas tainting
      restoreList = await _preloadImagesForCanvas(el);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        logging: false
      });

      const billNum = currentVoucherEntry.bill_number || ((currentVoucherEntry.id && currentVoucherEntry.id.length > 8) ? currentVoucherEntry.id.slice(0, 8).toUpperCase() : 'receipt');
      const filename = `SINA_Voucher_${billNum}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      if (window.FlutterBridge) {
        window.FlutterBridge.postMessage(JSON.stringify({
          action: 'SAVE_BASE64_FILE',
          base64: dataUrl,
          filename: filename,
          fileType: 'image'
        }));
        showToast('Saving Receipt to Phone Gallery...', 'info');
      } else {
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('Receipt Image downloaded!', 'success');
        }, 'image/png');
      }
    } catch (err) {
      console.error('Image generation failed:', err);
      showToast('Failed to generate image: ' + err.message, 'error');
      alert('Failed to generate image: ' + err.message);
    } finally {
      _restoreImages(restoreList);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Download as Image (PNG)`;
      }
    }
  };

  // DOWNLOAD AS PDF
  window.downloadAsPdf = async function() {
    const el = document.getElementById('voucher-render-element');
    if (!el || !currentVoucherEntry) return;

    const btn = document.getElementById('btn-download-pdf');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Generating PDF...';
    }

    let restoreList = [];
    try {
      // Pre-load all images as safe blob URLs to avoid canvas tainting
      restoreList = await _preloadImagesForCanvas(el);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

      const billNum = currentVoucherEntry.bill_number || ((currentVoucherEntry.id && currentVoucherEntry.id.length > 8) ? currentVoucherEntry.id.slice(0, 8).toUpperCase() : 'receipt');
      const filename = `SINA_Voucher_${billNum}.pdf`;

      if (window.FlutterBridge) {
        const pdfDataUri = pdf.output('datauristring');
        window.FlutterBridge.postMessage(JSON.stringify({
          action: 'SAVE_BASE64_FILE',
          base64: pdfDataUri,
          filename: filename,
          fileType: 'pdf'
        }));
        showToast('Saving Receipt PDF to Downloads...', 'info');
      } else {
        pdf.save(filename);
        showToast('Receipt PDF downloaded!', 'success');
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      _restoreImages(restoreList);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download as PDF`;
      }
    }
  };

  // PRINT RECEIPT
  window.printReceipt = function() {
    window.print();
  };

  function setupEventListeners() {
    const searchInp = document.getElementById('search-receipt-input');
    if (searchInp) {
      searchInp.addEventListener('input', () => renderReceiptsList());
    }

    const firmSel = document.getElementById('filter-firm-select');
    if (firmSel) {
      firmSel.addEventListener('change', () => renderReceiptsList());
    }

    const gstSel = document.getElementById('filter-gst-select');
    if (gstSel) {
      gstSel.addEventListener('change', () => renderReceiptsList());
    }

    const pdfBtn = document.getElementById('btn-download-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => window.downloadAsPdf());
    }

    const imgBtn = document.getElementById('btn-download-image');
    if (imgBtn) {
      imgBtn.addEventListener('click', () => window.downloadAsImage());
    }

    const printBtn = document.getElementById('btn-print-voucher');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.printReceipt());
    }

    const settingsBtn = document.getElementById('btn-receipt-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => openReceiptSettingsModal());
    }

    const saveSettingsBtn = document.getElementById('btn-save-receipt-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => saveReceiptSettingsFromModal());
    }
  }

  window.openReceiptSettingsModal = function() {
    const modal = document.getElementById('receipt-settings-modal');
    if (!modal) return;

    document.getElementById('setting-show-logo').checked = receiptSettings.showLogo !== false;
    document.getElementById('setting-subtitle').value = receiptSettings.subtitle || '';
    document.getElementById('setting-show-address').checked = receiptSettings.showAddress !== false;
    document.getElementById('setting-show-phone').checked = receiptSettings.showPhone !== false;
    document.getElementById('setting-footer-terms').value = receiptSettings.footerTerms || '';

    modal.classList.add('active');
    modal.style.display = 'flex';
  };

  window.closeReceiptSettingsModal = function() {
    const modal = document.getElementById('receipt-settings-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  function saveReceiptSettingsFromModal() {
    receiptSettings.showLogo = document.getElementById('setting-show-logo').checked;
    receiptSettings.subtitle = document.getElementById('setting-subtitle').value.trim();
    receiptSettings.showAddress = document.getElementById('setting-show-address').checked;
    receiptSettings.showPhone = document.getElementById('setting-show-phone').checked;
    receiptSettings.footerTerms = document.getElementById('setting-footer-terms').value.trim();

    localStorage.setItem('sina_receipt_settings', JSON.stringify(receiptSettings));
    showToast('Receipt format settings saved!', 'success');
    closeReceiptSettingsModal();

    if (currentVoucherEntry) {
      const container = document.getElementById('voucher-render-element');
      if (container) container.innerHTML = generateVoucherHtml(currentVoucherEntry);
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
