// SINA Admin - Settings & Permissions Controller
(function() {
  async function init() {
    const admin = window.sinaAdminAuth ? window.sinaAdminAuth.requireAdmin() : null;
    if (!admin) return;

    initPermissionControls();
    initPwaInstallControls();
    checkAdminPermissions();
    await loadAdminSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function initPermissionControls() {
    // 1. Notification Toggle
    const notifToggle = document.getElementById('admin-toggle-notif');
    if (notifToggle) {
      notifToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          requestAdminPermission('notification');
        } else {
          if (confirm('To revoke notification access, please adjust it in Android System Settings. Open settings now?')) {
            openAdminOsSettings();
          }
          checkAdminPermissions();
        }
      });
    }

    // 2. Location Toggle
    const locToggle = document.getElementById('admin-toggle-location');
    if (locToggle) {
      locToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          requestAdminPermission('location');
        } else {
          if (confirm('To revoke location access, please adjust it in Android System Settings. Open settings now?')) {
            openAdminOsSettings();
          }
          checkAdminPermissions();
        }
      });
    }

    // 3. Camera Toggle
    const camToggle = document.getElementById('admin-toggle-camera');
    if (camToggle) {
      camToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          requestAdminPermission('camera');
        } else {
          if (confirm('To revoke camera access, please adjust it in Android System Settings. Open settings now?')) {
            openAdminOsSettings();
          }
          checkAdminPermissions();
        }
      });
    }

    // Backward compatible button listeners
    const notifBtn = document.getElementById('admin-btn-req-notif');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => requestAdminPermission('notification'));
    }
    const locBtn = document.getElementById('admin-btn-req-location');
    if (locBtn) {
      locBtn.addEventListener('click', () => requestAdminPermission('location'));
    }
    const camBtn = document.getElementById('admin-btn-req-camera');
    if (camBtn) {
      camBtn.addEventListener('click', () => requestAdminPermission('camera'));
    }

    // 4. Open Android OS App Settings
    const osBtn = document.getElementById('admin-btn-open-os-settings');
    if (osBtn) {
      osBtn.addEventListener('click', openAdminOsSettings);
    }
  }

  function openAdminOsSettings() {
    if (window.FlutterBridge) {
      window.FlutterBridge.postMessage(JSON.stringify({ action: 'OPEN_APP_SETTINGS' }));
    } else {
      alert('Device app settings are accessible in your phone Settings -> Apps -> SINA Admin.');
    }
  }

  function requestAdminPermission(type) {
    if (type === 'notification') {
      if (window.FlutterBridge) {
        window.FlutterBridge.postMessage(JSON.stringify({ action: 'REQUEST_PERMISSION', permission: 'notification' }));
      }
      if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        Notification.requestPermission().then(res => {
          updateAdminBadge('notification', res === 'granted');
          if (res === 'granted' && window.subscribeUserToPush) {
            window.subscribeUserToPush();
          }
        });
      }
    } else if (type === 'location') {
      if (window.FlutterBridge) {
        window.FlutterBridge.postMessage(JSON.stringify({ action: 'REQUEST_PERMISSION', permission: 'location' }));
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => updateAdminBadge('location', true),
          () => updateAdminBadge('location', false),
          { timeout: 8000, enableHighAccuracy: true }
        );
      }
    } else if (type === 'camera') {
      if (window.FlutterBridge) {
        window.FlutterBridge.postMessage(JSON.stringify({ action: 'REQUEST_PERMISSION', permission: 'camera' }));
      }
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            stream.getTracks().forEach(t => t.stop());
            updateAdminBadge('camera', true);
          })
          .catch(() => updateAdminBadge('camera', false));
      }
    }
  }

  function checkAdminPermissions() {
    if (window.FlutterBridge) {
      window.FlutterBridge.postMessage(JSON.stringify({ action: 'CHECK_PERMISSIONS' }));
    }

    if (typeof Notification !== 'undefined') {
      updateAdminBadge('notification', Notification.permission === 'granted');
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(res => {
        updateAdminBadge('location', res.state === 'granted');
        res.onchange = () => updateAdminBadge('location', res.state === 'granted');
      }).catch(() => {});
    }
  }

  function updateAdminBadge(type, isGranted) {
    // 1. Update toggle switches
    const toggleId = type === 'notification' ? 'admin-toggle-notif' : `admin-toggle-${type}`;
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.checked = !!isGranted;
    }

    // 2. Backward compatibility with buttons
    const btnId = type === 'notification' ? 'admin-btn-req-notif' : `admin-btn-req-${type}`;
    const btn = document.getElementById(btnId);
    if (btn) {
      if (isGranted) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Already Allowed`;
        btn.className = 'btn btn-sm';
        btn.style.cssText = 'padding: 6px 14px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; border-radius: var(--radius-sm); background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; cursor: default; display: inline-flex; align-items: center; gap: 4px;';
        btn.disabled = true;
      } else {
        const label = type === 'location' ? 'Allow Location' : (type === 'notification' ? 'Allow Notification' : 'Allow Camera');
        btn.innerHTML = label;
        btn.className = 'btn btn-outline-purple btn-sm';
        btn.style.cssText = 'padding: 6px 14px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; border-radius: var(--radius-sm); display: inline-flex; align-items: center;';
        btn.disabled = false;
      }
    }
  }

  window.refreshAdminData = async function() {
    checkAdminPermissions();
    await loadAdminSettings();
  };
  window.refreshCurrentPageData = window.refreshAdminData;

  async function loadAdminSettings() {
    if (!window.sinaAdminDB) return;
    try {
      const settings = await window.sinaAdminDB.getSettings();
      const chk = document.getElementById('policy-expense-receipt');
      if (chk) {
        chk.checked = !!settings.require_expense_receipt;
        if (!chk._listenerAttached) {
          chk._listenerAttached = true;
          chk.addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            await window.sinaAdminDB.setSetting('require_expense_receipt', isChecked);
            console.log('[Admin Settings] Saved require_expense_receipt:', isChecked);
          });
        }
      }
    } catch (err) {
      console.warn('Could not load admin settings:', err);
    }
  }

  window._onPermissionsStatus = function(statusMap) {
    if (statusMap.location !== undefined) updateAdminBadge('location', statusMap.location);
    if (statusMap.notification !== undefined) updateAdminBadge('notification', statusMap.notification);
    if (statusMap.camera !== undefined) updateAdminBadge('camera', statusMap.camera);
  };

  window._onPermissionResult = function(perm, isGranted) {
    updateAdminBadge(perm, isGranted);
  };

  // PWA Installation Controller
  function initPwaInstallControls() {
    const installBtn = document.getElementById('btn-install-pwa');
    const installText = document.getElementById('btn-install-pwa-text');
    const installDesc = document.getElementById('pwa-install-desc');
    const iosInstructions = document.getElementById('pwa-ios-instructions');
    const installHint = document.getElementById('pwa-install-hint');

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    function setAlreadyInstalled() {
      if (!installBtn) return;
      installBtn.disabled = true;
      installBtn.style.cssText = 'padding: 6px 14px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; border-radius: var(--radius-sm); background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; cursor: default; display: inline-flex; align-items: center; gap: 4px;';
      installBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> App Installed';
      if (installDesc) {
        installDesc.textContent = 'SINA Admin is installed and running in standalone app mode on this device.';
      }
      if (iosInstructions) iosInstructions.style.display = 'none';
      if (installHint) installHint.style.display = 'none';
    }

    if (isStandalone) {
      setAlreadyInstalled();
      return;
    }

    if (isIOS) {
      if (iosInstructions) iosInstructions.style.display = 'block';
      if (installBtn) {
        installBtn.style.background = 'var(--purple-primary)';
        if (installText) installText.textContent = 'iOS Guide';
        installBtn.onclick = () => {
          if (iosInstructions) {
            iosInstructions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            iosInstructions.style.outline = '2px solid var(--green-primary)';
            setTimeout(() => { iosInstructions.style.outline = 'none'; }, 1500);
          }
        };
      }
      return;
    }

    function updateInstallState() {
      if (window.deferredPrompt) {
        if (installBtn) {
          installBtn.disabled = false;
          installBtn.style.display = 'inline-flex';
          installBtn.className = 'btn btn-sm btn-primary';
          if (installText) installText.textContent = 'Install App';
        }
        if (installHint) {
          installHint.style.display = 'none';
        }
      } else {
        if (installHint) {
          installHint.style.display = 'block';
          installHint.innerHTML = 'Tip: You can also install directly by clicking the <strong>Install</strong> or <strong>App Available</strong> icon (⊕) in your browser address bar.';
        }
      }
    }

    updateInstallState();

    window.addEventListener('pwa-prompt-available', updateInstallState);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      updateInstallState();
    });

    window.addEventListener('appinstalled', () => {
      window.deferredPrompt = null;
      setAlreadyInstalled();
    });

    window.addEventListener('pwa-app-installed', () => {
      setAlreadyInstalled();
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (window.deferredPrompt) {
          window.deferredPrompt.prompt();
          const choice = await window.deferredPrompt.userChoice;
          console.log('[PWA] User choice outcome:', choice ? choice.outcome : '');
          if (choice && choice.outcome === 'accepted') {
            setAlreadyInstalled();
          }
          window.deferredPrompt = null;
        } else {
          alert('To install SINA Admin on Desktop/Android, click the "Install" icon in your browser address bar or use the browser menu (⋮ -> "Install SINA Admin").');
        }
      });
    }
  }
})();
