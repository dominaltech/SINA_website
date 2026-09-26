// SINA Admin - Payment Verification & Approvals Controller
(function() {
  let pendingEntries = [];
  let allPurchasingFirms = [];
  let allBankAccounts = [];

  async function init() {
    const admin = window.sinaAdminAuth.requireAdmin();
    if (!admin) return;

    await loadApprovals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.refreshAdminData = async function() {
    await loadApprovals();
  };

  async function loadApprovals() {
    try {
      const all = (await window.sinaAdminDB.getProcurementEntries()) || [];
      try {
        allPurchasingFirms = (await window.sinaAdminDB.getPurchasingFirms()) || [];
      } catch (e) {
        console.warn('Failed to load purchasing firms:', e);
        allPurchasingFirms = [];
      }
      try {
        allBankAccounts = (await (window.sinaAdminDB.getBankAccounts ? window.sinaAdminDB.getBankAccounts() : window.sinaAdminDB.getCompanyBankAccounts())) || [];
      } catch (e) {
        console.warn('Failed to load bank accounts:', e);
        allBankAccounts = [];
      }
      if (!Array.isArray(allPurchasingFirms)) allPurchasingFirms = [];
      if (!Array.isArray(allBankAccounts)) allBankAccounts = [];

      // Include all entries: UPI, Bank Transfer, Cash, or pending verification
      pendingEntries = Array.isArray(all) ? all.filter(e => 
        e.payment_mode === 'upi' || 
        e.payment_mode === 'bank_transfer' || 
        e.payment_mode === 'cash' ||
        e.status === 'pending' || 
        e.status === 'pending_approval'
      ) : [];

      // Sort pending requests to the absolute top, followed by descending creation date
      pendingEntries.sort((a, b) => {
        const aPending = (a.status === 'pending' || a.status === 'pending_approval') ? 1 : 0;
        const bPending = (b.status === 'pending' || b.status === 'pending_approval') ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      renderApprovalsTable();

      // Handle deeplink focus if entry_id query param passed
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('entry_id');
      if (targetId) {
        if (!pendingEntries.some(e => e.id === targetId)) {
          const targeted = (all || []).find(e => e.id === targetId);
          if (targeted) {
            pendingEntries.unshift(targeted);
            renderApprovalsTable();
          }
        }
        setTimeout(() => window.focusApprovalEntry(targetId), 300);
      }
    } catch (err) {
      console.error('Error loading approvals:', err);
    }
  }

  // Live Auto-Refresh Listener on Realtime Events
  if (window.sinaAdminDB && window.sinaAdminDB.onNewActivity) {
    window.sinaAdminDB.onNewActivity(() => {
      loadApprovals();
    });
  }

  function renderApprovalsTable() {
    const container = document.getElementById('approvals-container');
    if (!container) return;

    if (pendingEntries.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 36px 16px; border: 1px dashed var(--border-color);">
          <h4 style="color: var(--green-primary); font-size: 1.15rem; font-weight: 800; margin: 0 0 6px 0;">All Clear!</h4>
          <p class="text-muted" style="margin: 0;">No pending payments or transaction requests awaiting approval.</p>
        </div>
      `;
      return;
    }

    let html = '';
    pendingEntries.forEach(e => {
      const isVerified = e.status === 'verified' || e.status === 'completed';
      const hasImages = e.images && e.images.length > 0;
      const amountFloat = parseFloat(e.total_amount || 0);
      const items = e.items && e.items.length > 0 ? e.items : null;
      const billNum = e.bill_number || ('G' + (e.id || '').slice(0, 6).toUpperCase());

      // NPCI Standard UPI deep link: prefilled amount, editable before launching
      const upiId = e.upi_id || '';
      const firmName = e.firm_name || 'Merchant';
      const initialUpiUrl = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(firmName)}&am=${amountFloat.toFixed(2)}&cu=INR&tn=${encodeURIComponent('SINA Procurement ' + firmName)}` : '#';

      html += `
        <div id="approval-card-${e.id}" class="card" style="margin-bottom: 16px; border-left: 4px solid ${isVerified ? 'var(--green-primary)' : 'var(--orange-primary)'}; box-shadow: var(--shadow-sm); transition: all 0.3s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--text-primary);">${escapeHtml(e.firm_name)}</h3>
                <span class="badge" style="background: #EDE9FE; color: #6D28D9; font-weight: 800; font-size: 0.75rem; padding: 2px 7px; border-radius: 4px;">
                  Bill #${billNum}
                </span>
              </div>
              <div class="text-muted" style="font-size: 0.82rem; margin-top: 2px;">
                Rep: <strong>${escapeHtml(e.rep_name || 'Representative')}</strong> &bull; Contact: ${escapeHtml(e.contact_person)} (<a href="tel:${e.mobile}" style="color: var(--green-dark); font-weight: 700;">${e.mobile}</a>)
              </div>
            </div>
            <div style="text-align: right;">
              <span class="record-total" style="font-size: 1.25rem; font-weight: 900; color: var(--green-dark);">₹${amountFloat.toLocaleString('en-IN')}</span>
              <div style="margin-top: 4px;">
                <span class="status-badge ${isVerified ? 'completed' : 'pending'}">${isVerified ? 'VERIFIED & PAID' : 'PENDING APPROVAL'}</span>
              </div>
            </div>
          </div>

          <!-- Order Items Details -->
          <div style="background: var(--bg-secondary); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-bottom: 12px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span><strong>Payment Mode:</strong> ${e.payment_mode.toUpperCase()}</span>
              <span class="text-muted">${new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            ${items ? `
              <div style="margin-top: 6px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                <div style="font-weight: 700; color: var(--green-dark); margin-bottom: 4px;">Items (${items.length}):</div>
                ${items.map(it => `
                  <div style="display: flex; justify-content: space-between; font-size: 0.82rem; padding: 2px 0;">
                    <span>${escapeHtml(it.product_name || it.type)} (${it.quantity} ${(it.unit || '').replace('per_', '')} @ ₹${it.rate})</span>
                    <strong>₹${parseFloat(it.line_total || 0).toLocaleString('en-IN')}</strong>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div><strong>Item:</strong> ${escapeHtml(e.type || e.category_name || 'Goods')} (${e.quantity} ${(e.unit || '').replace('per_', '')} @ ₹${e.rate})</div>
            `}
          </div>

          <!-- OUR PURCHASING FIRM & PAYING BANK ACCOUNT SELECTORS (ADMIN CONTROL) -->
          <div style="background: #F8FAFC; border: 2px solid #CBD5E1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size: 0.75rem; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M9 21V11h6v10M12 3l9 4H3l9-4z"/></svg>
              Select Company Firm & Paying Bank Account
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #1E293B; display: block; margin-bottom: 4px;">
                  🏢 Our Purchasing Firm:
                </label>
                <select id="purchasing-firm-sel-${e.id}" class="form-select" style="font-size: 0.88rem; font-weight: 700; background-color: #FFFFFF; border: 1.5px solid #94A3B8; color: #0F172A; padding: 8px 12px; border-radius: 6px; width: 100%; cursor: pointer;" ${isVerified ? 'disabled' : ''}>
                  ${allPurchasingFirms.length === 0 ? '<option value="">No firms registered</option>' : ''}
                  ${allPurchasingFirms.map(f => {
                    const isSelected = (e.our_firm_id === f.id) || (!e.our_firm_id && f.is_active !== false);
                    return `<option value="${f.id}" data-name="${escapeHtml(f.firm_name)}" data-gst="${escapeHtml(f.gst_number || '')}" ${isSelected ? 'selected' : ''}>
                      ${escapeHtml(f.firm_name)} ${f.gst_number ? `(${f.gst_number})` : ''}
                    </option>`;
                  }).join('')}
                </select>
              </div>
              <div>
                <label style="font-size: 0.8rem; font-weight: 700; color: #1E293B; display: block; margin-bottom: 4px;">
                  🏦 Paying Bank Account:
                </label>
                <select id="paying-bank-sel-${e.id}" class="form-select" style="font-size: 0.88rem; font-weight: 700; background-color: #FFFFFF; border: 1.5px solid #94A3B8; color: #0F172A; padding: 8px 12px; border-radius: 6px; width: 100%; cursor: pointer;" ${isVerified ? 'disabled' : ''}>
                  ${allBankAccounts.length === 0 ? '<option value="">No bank accounts registered</option>' : ''}
                  ${allBankAccounts.map((b, idx) => {
                    const isSelected = (e.bank_account_id === b.id) || (!e.bank_account_id && idx === 0);
                    return `<option value="${b.id}" data-name="${escapeHtml(b.bank_name)}" ${isSelected ? 'selected' : ''}>
                      ${escapeHtml(b.bank_name)} ${b.account_number ? `(...${b.account_number.slice(-4)})` : ''}
                    </option>`;
                  }).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- UPI ACTION SECTION WITH EDITABLE AMOUNT -->
          ${e.payment_mode === 'upi' ? `
            <div style="background: var(--green-tint); border: 1.5px solid var(--green-border); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 0.84rem; font-weight: 800; color: var(--green-dark);">UPI Payment Settlement</span>
                <span class="badge" style="background: var(--orange-tint); color: var(--orange-dark); border: 1px solid var(--orange-border); font-size: 0.72rem; font-weight: 700;">Editable Amount</span>
              </div>

              <!-- Editable Amount & Payee Row -->
              <div style="background: var(--bg-primary); padding: 10px 12px; border-radius: var(--radius-sm); margin-bottom: 10px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Payee UPI ID:</div>
                    <strong style="font-size: 0.95rem; color: var(--green-dark);">${escapeHtml(e.upi_id || 'N/A')}</strong>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="copyText('${escapeHtml(e.upi_id || '')}', 'UPI ID copied to clipboard')" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 700;">
                      Copy UPI ID
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-amt-${e.id}" onclick="copyCurrentAmount('${e.id}')" style="padding: 4px 8px; font-size: 0.75rem; font-weight: 700;">
                      Copy ₹${amountFloat.toFixed(2)}
                    </button>
                  </div>
                </div>

                <!-- Editable Amount Input -->
                <div style="display: flex; align-items: center; gap: 10px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                  <label for="pay-amt-${e.id}" style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap;">
                    Settlement Amount (₹):
                  </label>
                  <input type="number" id="pay-amt-${e.id}" class="form-input" value="${amountFloat.toFixed(2)}" min="1" step="any" oninput="updateDynamicUpiLink('${e.id}', '${escapeHtml(e.upi_id || '')}', '${escapeHtml(firmName)}')" style="width: 140px; font-weight: 800; font-size: 1.05rem; color: var(--green-dark); padding: 5px 8px;" ${isVerified ? 'disabled' : ''}>
                </div>
              </div>

              <!-- PhonePe Direct Deep Link Button -->
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <a href="${initialUpiUrl}" id="phonepe-btn-${e.id}" onclick="onPhonePeClick(event, '${e.id}', '${escapeHtml(e.upi_id || '')}', '${amountFloat.toFixed(2)}')" class="btn btn-primary btn-block" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; font-weight: 800; text-decoration: none; font-size: 0.95rem;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Pay via PhonePe / UPI (<span id="phonepe-amt-display-${e.id}">₹${amountFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>)
                </a>
              </div>

              <!-- UTR Input & Confirmation -->
              <div style="border-top: 1px dashed var(--green-border); padding-top: 10px;">
                <label class="form-label" style="font-size: 0.8rem; margin-bottom: 6px; font-weight: 700; color: var(--green-dark);">
                  ${isVerified ? 'Verified UTR / Transaction Reference No.' : 'Enter UTR / Transaction No. (After PhonePe Payment):'}
                </label>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                  <input type="text" id="utr-input-${e.id}" class="form-input" placeholder="e.g. 428198765432" value="${escapeHtml(e.upi_utr || '')}" ${isVerified ? 'readonly' : ''} style="flex: 1; font-size: 0.95rem; font-weight: 700;">
                  ${!isVerified ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="pasteUtr('${e.id}')" style="white-space: nowrap; padding: 8px 14px; font-weight: 700;">
                      Paste
                    </button>
                  ` : `
                    <span class="status-badge completed" style="display: flex; align-items: center; font-weight: 800;">Sent to Rep</span>
                  `}
                </div>
                ${!isVerified ? `
                  <button type="button" class="btn btn-primary btn-block" onclick="confirmUpiPayment('${e.id}')" style="padding: 10px; font-weight: 800; font-size: 0.92rem;">
                    Confirm & Send to Rep &rarr;
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- BANK TRANSFER PROOFS & ATTACHED SLIPS -->
          ${hasImages ? `
            <div style="margin-bottom: 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Uploaded Passbook / Cheque Proofs (${e.images.length}):</span>
                <span style="font-size: 0.7rem; color: var(--green-dark); font-weight: 700;">Tap image to view & download &rarr;</span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${e.images.map((img, idx) => `
                  <div style="position: relative; display: inline-block;">
                    <img src="${img}" style="width: 65px; height: 65px; object-fit: cover; border-radius: 6px; border: 1.5px solid var(--green-border); cursor: pointer;" onclick="openApprovalImg('${img}', 'Proof Slip ${idx + 1}', 'SINA_slip_${e.id}_${idx + 1}')" alt="Payment Proof">
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Bank Transfer Action Buttons -->
          ${e.payment_mode === 'bank_transfer' ? `
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
              ${!isVerified ? `
                <button class="btn btn-primary btn-sm" onclick="approveBankPayment('${e.id}')" style="font-weight: 700;">
                  Approve Bank Transfer
                </button>
                <button class="btn btn-secondary btn-sm" onclick="rejectPayment('${e.id}')" style="font-weight: 700;">
                  Reject / Flag
                </button>
              ` : `
                <span class="status-badge completed">Verified & Settled</span>
              `}
            </div>
          ` : ''}

          <!-- Cash Payment Action / Verification -->
          ${e.payment_mode === 'cash' ? `
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
              ${!isVerified ? `
                <button class="btn btn-primary btn-sm" onclick="approveCashPayment('${e.id}')" style="font-weight: 700;">
                  Verify & Log Cash Voucher
                </button>
              ` : `
                <span class="status-badge completed">Cash Settled</span>
              `}
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // DYNAMIC UPI LINK UPDATE ON AMOUNT CHANGE
  window.updateDynamicUpiLink = function(entryId, upiId, firmName) {
    const amtInput = document.getElementById(`pay-amt-${entryId}`);
    const phonepeBtn = document.getElementById(`phonepe-btn-${entryId}`);
    const amtDisplay = document.getElementById(`phonepe-amt-display-${entryId}`);
    const copyBtn = document.getElementById(`btn-copy-amt-${entryId}`);

    if (!amtInput) return;
    const currentVal = parseFloat(amtInput.value) || 0;

    if (amtDisplay) {
      amtDisplay.textContent = '₹' + currentVal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    if (copyBtn) {
      copyBtn.textContent = `Copy ₹${currentVal.toFixed(2)}`;
    }

    if (phonepeBtn && upiId) {
      phonepeBtn.href = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(firmName)}&am=${currentVal.toFixed(2)}&cu=INR&tn=${encodeURIComponent('SINA Procurement ' + firmName)}`;
    }
  };

  window.copyCurrentAmount = function(entryId) {
    const amtInput = document.getElementById(`pay-amt-${entryId}`);
    if (amtInput) {
      copyText(parseFloat(amtInput.value || 0).toFixed(2), 'Amount copied to clipboard');
    }
  };

  window.onPhonePeClick = function(event, entryId, upiId, defaultAmt) {
    const amtInput = document.getElementById(`pay-amt-${entryId}`);
    const currentAmt = (amtInput && parseFloat(amtInput.value)) ? parseFloat(amtInput.value) : parseFloat(defaultAmt);

    // Dynamically update href right before launching PhonePe app
    const btn = document.getElementById(`phonepe-btn-${entryId}`);
    const entry = pendingEntries.find(e => e.id === entryId);
    const firmName = (entry && entry.firm_name) ? entry.firm_name : 'Merchant';
    if (btn && upiId) {
      btn.href = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(firmName)}&am=${currentAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('SINA Procurement ' + firmName)}`;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentAmt.toFixed(2)).catch(() => {});
    }

    if (window.showToast) {
      window.showToast(`Launching PhonePe for ₹${currentAmt.toFixed(2)}...`, 'info');
    }
  };

  window.pasteUtr = async function(entryId) {
    const input = document.getElementById(`utr-input-${entryId}`);
    if (!input) return;

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const digitsOnly = text.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 10) {
          input.value = digitsOnly;
        } else if (text.trim().length > 0) {
          input.value = text.trim();
        }
        input.focus();
      } else {
        input.focus();
        input.select();
      }
    } catch (e) {
      input.focus();
    }
  };

  function getSelectedFirmAndBank(id) {
    const pfSel = document.getElementById(`purchasing-firm-sel-${id}`);
    const bankSel = document.getElementById(`paying-bank-sel-${id}`);
    let ourFirmId = pfSel ? pfSel.value : null;
    let ourFirmName = pfSel && pfSel.selectedOptions[0] ? pfSel.selectedOptions[0].dataset.name : null;
    let ourFirmGst = pfSel && pfSel.selectedOptions[0] ? pfSel.selectedOptions[0].dataset.gst : null;
    let bankAccountId = bankSel ? bankSel.value : null;
    let bankAccountName = bankSel && bankSel.selectedOptions[0] ? bankSel.selectedOptions[0].dataset.name : null;
    return { ourFirmId, ourFirmName, ourFirmGst, bankAccountId, bankAccountName };
  }

  window.confirmUpiPayment = async function(id) {
    const utrInput = document.getElementById(`utr-input-${id}`);
    const amtInput = document.getElementById(`pay-amt-${id}`);
    const utrVal = utrInput ? utrInput.value.trim() : '';
    const amtVal = amtInput ? parseFloat(amtInput.value) : null;

    if (!utrVal) {
      alert('Please enter or paste the 12-digit UPI UTR / Transaction Reference number after completing the payment in PhonePe.');
      if (utrInput) utrInput.focus();
      return;
    }

    const btn = event?.target || document.querySelector(`button[onclick*="confirmUpiPayment('${id}')"]`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Confirming & Syncing...';
    }

    try {
      const entry = pendingEntries.find(e => e.id === id);
      const { ourFirmId, ourFirmName, ourFirmGst, bankAccountId, bankAccountName } = getSelectedFirmAndBank(id);

      if (entry) {
        entry.upi_utr = utrVal;
        entry.status = 'verified';
        if (amtVal && amtVal > 0) entry.total_amount = amtVal;
        entry.our_firm_id = ourFirmId;
        entry.our_firm_name = ourFirmName;
        entry.our_firm_gst = ourFirmGst;
        entry.bank_account_id = bankAccountId;
        entry.bank_account_name = bankAccountName;
      }

      await window.sinaAdminDB.updateEntryPayment(id, {
        status: 'verified',
        upi_utr: utrVal,
        amount: amtVal || (entry ? entry.total_amount : 0),
        our_firm_id: ourFirmId,
        our_firm_name: ourFirmName,
        our_firm_gst: ourFirmGst,
        bank_account_id: bankAccountId,
        bank_account_name: bankAccountName,
        representative_id: entry ? entry.representative_id : null,
        firm_name: entry ? entry.firm_name : 'Firm'
      });

      // Send UTR push notification to Representative
      if (window.dispatchPushNotification) {
        window.dispatchPushNotification({
          user_id: (entry && entry.representative_id) ? entry.representative_id : null,
          target_role: 'representative',
          title: 'UTR ID Received!',
          body: `Payment verified for ${entry ? (entry.firm_name || 'Purchase') : 'Purchase'}. UTR: ${utrVal}`,
          data: { url: 'records.html' }
        });
      }

      alert(`Payment of UTR ${utrVal} confirmed and synchronized to representative's app!`);
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert('Error updating payment: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirm & Send to Rep →';
      }
    }
  };

  window.approveBankPayment = async function(id) {
    if (!confirm('Are you sure you want to approve and settle this bank transfer?')) return;
    const entry = pendingEntries.find(e => e.id === id);
    const { ourFirmId, ourFirmName, ourFirmGst, bankAccountId, bankAccountName } = getSelectedFirmAndBank(id);

    try {
      if (entry) {
        entry.status = 'verified';
        entry.our_firm_id = ourFirmId;
        entry.our_firm_name = ourFirmName;
        entry.our_firm_gst = ourFirmGst;
        entry.bank_account_id = bankAccountId;
        entry.bank_account_name = bankAccountName;
      }

      await window.sinaAdminDB.updateEntryPayment(id, {
        status: 'verified',
        our_firm_id: ourFirmId,
        our_firm_name: ourFirmName,
        our_firm_gst: ourFirmGst,
        bank_account_id: bankAccountId,
        bank_account_name: bankAccountName,
        representative_id: entry ? entry.representative_id : null,
        firm_name: entry ? entry.firm_name : 'Firm'
      });

      if (window.dispatchPushNotification) {
        window.dispatchPushNotification({
          user_id: (entry && entry.representative_id) ? entry.representative_id : null,
          target_role: 'representative',
          title: 'Bank Transfer Approved!',
          body: `Bank payment verified for ${entry ? (entry.firm_name || 'Purchase') : 'Purchase'}. Tap to view in Records.`,
          data: { url: 'records.html' }
        });
      }

      alert('Bank transfer verified and logged as settled.');
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert('Error approving bank transfer: ' + err.message);
    }
  };

  window.approveCashPayment = async function(id) {
    if (!confirm('Confirm and log cash voucher for this purchase?')) return;
    const entry = pendingEntries.find(e => e.id === id);
    const { ourFirmId, ourFirmName, ourFirmGst, bankAccountId, bankAccountName } = getSelectedFirmAndBank(id);

    try {
      if (entry) {
        entry.status = 'verified';
        entry.our_firm_id = ourFirmId;
        entry.our_firm_name = ourFirmName;
        entry.our_firm_gst = ourFirmGst;
        entry.bank_account_id = bankAccountId;
        entry.bank_account_name = bankAccountName;
      }

      await window.sinaAdminDB.updateEntryPayment(id, {
        status: 'verified',
        our_firm_id: ourFirmId,
        our_firm_name: ourFirmName,
        our_firm_gst: ourFirmGst,
        bank_account_id: bankAccountId,
        bank_account_name: bankAccountName,
        representative_id: entry ? entry.representative_id : null,
        firm_name: entry ? entry.firm_name : 'Firm'
      });

      alert('Cash purchase verified and logged under selected purchasing firm and account.');
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert('Error approving cash entry: ' + err.message);
    }
  };

  window.rejectPayment = async function(id) {
    const reason = prompt('Please enter the reason for rejecting/flagging this payment submission:');
    if (!reason) return;
    const entry = pendingEntries.find(e => e.id === id);

    try {
      await window.sinaAdminDB.updateEntryStatus(id, 'rejected');

      if (window.dispatchPushNotification && entry && entry.representative_id) {
        window.dispatchPushNotification({
          user_id: entry.representative_id,
          target_role: 'representative',
          title: 'Payment Flagged / Rejected',
          body: `Payment for ${entry.firm_name || 'Purchase'} was flagged: ${reason}`,
          data: { url: 'records.html' }
        });
      }

      alert('Payment submission flagged and marked rejected.');
      await loadApprovals();
    } catch (err) {
      console.error(err);
      alert('Error rejecting payment: ' + err.message);
    }
  };

  window.focusApprovalEntry = function(targetId) {
    if (!targetId) return;
    const card = document.getElementById(`approval-card-${targetId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.outline = '3px solid #16A34A';
      card.style.boxShadow = '0 0 24px rgba(22, 163, 74, 0.45)';
      setTimeout(() => {
        card.style.transition = 'all 1.5s';
        card.style.outline = 'none';
        card.style.boxShadow = 'var(--shadow-sm)';
      }, 3500);
    }
  };

  window.copyText = function(text, toastMsg) {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert(toastMsg || 'Copied!');
      }).catch(() => {
        fallbackCopy(text, toastMsg);
      });
    } else {
      fallbackCopy(text, toastMsg);
    }
  };

  function fallbackCopy(text, msg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert(msg || 'Copied!');
  }

  let currentApprovalDownloadName = 'SINA_Proof.jpg';

  window.openApprovalImg = function(imgSrc, title, defaultFilename) {
    const modal = document.getElementById('approval-img-modal');
    const imgEl = document.getElementById('approval-full-img');
    const titleEl = document.getElementById('approval-modal-title');
    if (modal && imgEl) {
      imgEl.src = imgSrc;
      if (titleEl) titleEl.textContent = title || 'Passbook / Cheque Document Audit';
      currentApprovalDownloadName = (defaultFilename ? defaultFilename + '.jpg' : 'SINA_Proof_' + Date.now() + '.jpg');
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  };

  window.downloadCurrentApprovalImg = async function() {
    const imgEl = document.getElementById('approval-full-img');
    if (!imgEl || !imgEl.src) return;

    let base64Data = imgEl.src;
    // If image is a Supabase Storage bucket URL, convert to Base64 blob for seamless native Gallery saving
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      try {
        const resp = await fetch(base64Data);
        const blob = await resp.blob();
        base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Could not convert bucket image to base64, using raw URL:', err);
      }
    }

    // Check if running inside Flutter app
    if (window.FlutterBridge) {
      window.FlutterBridge.postMessage(JSON.stringify({
        action: 'SAVE_BASE64_FILE',
        base64: base64Data,
        filename: currentApprovalDownloadName || ('SINA_Proof_' + Date.now() + '.jpg'),
        fileType: 'image'
      }));
      if (window.showToast) window.showToast('Saving image to Phone Gallery...', 'info');
      return;
    }

    // Web browser fallback
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = currentApprovalDownloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (window.showToast) window.showToast('Document downloaded to computer', 'success');
  };

  window.closeApprovalImg = function() {
    const modal = document.getElementById('approval-img-modal');
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
