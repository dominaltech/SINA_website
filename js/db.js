// SINA Admin - Data Layer & Real-Time Sync Engine
(function() {
  class SINA_AdminDB {
    constructor() {
      this.channel = null;
      this.activityListeners = [];
      this.initBroadcast();
      this.initStorage();
      this.initSupabaseRealtime();
    }

    initBroadcast() {
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel(window.SINA_CONFIG.BROADCAST_CHANNEL);
        this.channel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      }

      window.addEventListener('storage', (e) => {
        if (e.key === 'sina_last_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.handleIncomingBroadcast(data);
          } catch (err) {}
        }
      });
    }

    handleIncomingBroadcast(data) {
      if (!data) return;

      if (data.type === 'PRODUCT_ADDED' && data.payload) {
        const products = JSON.parse(localStorage.getItem('sina_products') || '[]');
        if (!products.some(p => p.id === data.payload.id || (p.name.toLowerCase() === data.payload.name.toLowerCase() && p.type === data.payload.type))) {
          products.push(data.payload);
          localStorage.setItem('sina_products', JSON.stringify(products));
        }
      } else if (data.type === 'CATEGORY_ADDED' && data.payload) {
        const categories = JSON.parse(localStorage.getItem('sina_categories') || '[]');
        if (!categories.some(c => c.id === data.payload.id || c.name.toLowerCase() === data.payload.name.toLowerCase())) {
          categories.push(data.payload);
          localStorage.setItem('sina_categories', JSON.stringify(categories));
        }
      }

      // Add to notifications log
      const notifications = JSON.parse(localStorage.getItem('sina_admin_notifications') || '[]');
      const notif = {
        id: 'notif_' + Date.now(),
        type: data.type,
        payload: data.payload,
        timestamp: data.timestamp || Date.now(),
        read: false
      };
      notifications.unshift(notif);
      localStorage.setItem('sina_admin_notifications', JSON.stringify(notifications));

      // Trigger all registered listeners
      this.activityListeners.forEach(listener => {
        try { listener(notif); } catch (e) { console.error(e); }
      });
    }

    broadcast(type, payload) {
      if (this.channel) {
        try {
          this.channel.postMessage({ type, payload, timestamp: Date.now() });
        } catch (e) {}
      }
      localStorage.setItem('sina_last_event', JSON.stringify({ type, payload, timestamp: Date.now() }));
    }

    onNewActivity(callback) {
      this.activityListeners.push(callback);
    }

    initStorage() {
      if (!localStorage.getItem('sina_profiles')) {
        localStorage.setItem('sina_profiles', JSON.stringify([]));
      }
    }

    initSupabaseRealtime() {
      try {
        if (!window.SINA_CONFIG || !window.SINA_CONFIG.SUPABASE_URL || !window.SINA_CONFIG.SUPABASE_ANON_KEY) return;
        const wsUrl = window.SINA_CONFIG.SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + window.SINA_CONFIG.SUPABASE_ANON_KEY + '&vsn=1.0.0';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[SINA Admin Realtime] WebSocket connected');
          const joinMsg = {
            topic: 'realtime:public',
            event: 'phx_join',
            payload: {
              config: {
                postgres_changes: [
                  { event: '*', schema: 'public', table: 'procurement_entries' },
                  { event: '*', schema: 'public', table: 'expenses' },
                  { event: '*', schema: 'public', table: 'daily_floats' },
                  { event: '*', schema: 'public', table: 'notifications' },
                  { event: '*', schema: 'public', table: 'app_settings' },
                  { event: '*', schema: 'public', table: 'godowns' },
                  { event: '*', schema: 'public', table: 'rep_locations' }
                ]
              }
            },
            ref: '1'
          };
          ws.send(JSON.stringify(joinMsg));

          if (this._hbInterval) clearInterval(this._hbInterval);
          this._hbInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: Date.now().toString() }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'postgres_changes' && msg.payload && msg.payload.data) {
              const table = msg.payload.data.table;
              const record = msg.payload.data.record || msg.payload.data.old_record;
              const eventType = msg.payload.data.type || 'UPDATE';
              this.handleRealtimeChange(table, record, eventType);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          console.log('[SINA Admin Realtime] WebSocket disconnected. Reconnecting in 4s...');
          setTimeout(() => this.initSupabaseRealtime(), 4000);
        };

        ws.onerror = (err) => console.warn('[SINA Admin Realtime] WebSocket error:', err);
      } catch (err) {
        console.warn('[SINA Admin Realtime] Init error:', err);
      }

      // Fast 5-second polling fallback so sync NEVER fails even on flaky mobile networks
      if (!this._pollingInitialized) {
        this._pollingInitialized = true;
        setInterval(async () => {
          try {
            if (window.refreshAdminData) {
              await window.refreshAdminData();
            }
          } catch (e) {}
        }, 5000);
      }
    }

    async getSettings() {
      try {
        const res = await this.supabaseRequest('app_settings?select=*&limit=1');
        if (res && res.length > 0) {
          localStorage.setItem('sina_app_settings', JSON.stringify(res[0]));
          return res[0];
        }
      } catch (e) {}
      const saved = localStorage.getItem('sina_app_settings');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
      return { require_expense_receipt: false };
    }

    async setSetting(key, val) {
      let current = {};
      try {
        const saved = localStorage.getItem('sina_app_settings');
        if (saved) current = JSON.parse(saved);
      } catch (e) {}
      current[key] = val;
      localStorage.setItem('sina_app_settings', JSON.stringify(current));

      try {
        await this.supabaseRequest('app_settings', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: 1, ...current, updated_at: new Date().toISOString() })
        });
      } catch (e) {}

      this.broadcast('SETTING_UPDATED', current);
      return current;
    }

    async getEntries() {
      return this.getProcurementEntries();
    }

    // Supabase HTTP helper
    async supabaseRequest(endpoint, options = {}) {
      try {
        const url = `${window.SINA_CONFIG.SUPABASE_URL}/rest/v1/${endpoint}`;
        const headers = {
          'apikey': window.SINA_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.SINA_CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': options.prefer || 'return=representation',
          ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`Supabase error ${response.status}`);
        return await response.json();
      } catch (err) {
        return null;
      }
    }

    normalizeEntry(row) {
      const firstItem = (row.procurement_items && row.procurement_items.length > 0) ? row.procurement_items[0] : null;
      const images = (row.payment_attachments && Array.isArray(row.payment_attachments))
        ? row.payment_attachments.map(att => att.file_url)
        : (Array.isArray(row.images) ? row.images : []);

      const repName = row.profiles?.name || row.rep_name || 'Representative';

      return {
        ...row,
        id: row.id,
        representative_id: row.representative_id,
        rep_name: repName,
        firm_id: row.firm_id,
        firm_name: row.firm_name,
        contact_person: row.contact_person,
        mobile: row.mobile,
        address: row.address,
        category_name: firstItem ? (firstItem.category_name || row.category_name || '') : (row.category_name || ''),
        type: firstItem ? (firstItem.product_name || firstItem.type) : (row.type || ''),
        quantity: firstItem ? parseFloat(firstItem.quantity) : (parseFloat(row.quantity) || 0),
        unit: firstItem ? firstItem.unit : (row.unit || 'per_kg'),
        rate: firstItem ? parseFloat(firstItem.rate) : (parseFloat(row.rate) || 0),
        total_amount: parseFloat(row.total_amount) || 0,
        payment_mode: row.payment_mode,
        cash_amount: parseFloat(row.cash_amount) || 0,
        upi_id: row.upi_id || '',
        upi_utr: row.upi_utr || '',
        images: images,
        status: row.status,
        created_at: row.created_at,
        items: row.procurement_items || [],
        godown_id: row.godown_id || null,
        godown_name: row.godown_name || null,
        our_firm_id: row.our_firm_id || null,
        our_firm_name: row.our_firm_name || null,
        our_firm_gst: row.our_firm_gst || null,
        bank_account_id: row.bank_account_id || null,
        bank_account_name: row.bank_account_name || null,
        bill_number: row.bill_number || ('G' + (row.id || '').slice(0, 6).toUpperCase())
      };
    }

    // 1. REPRESENTATIVES & PASSWORD MANAGEMENT
    async getRepresentatives() {
      const remote = await this.supabaseRequest('profiles?role=eq.representative&order=created_at.asc');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        localStorage.setItem('sina_profiles', JSON.stringify(remote));
        return remote;
      }
      const profiles = JSON.parse(localStorage.getItem('sina_profiles') || '[]');
      return profiles.filter(p => p.role === 'representative');
    }

    async getRepresentativeById(id) {
      const remote = await this.supabaseRequest(`profiles?id=eq.${id}&select=*`);
      if (remote && Array.isArray(remote) && remote.length > 0) {
        return remote[0];
      }
      const reps = await this.getRepresentatives();
      return reps.find(r => r.id === id);
    }

    async addRepresentative(data) {
      const payload = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        password_hash: data.password.trim(),
        role: 'representative',
        assigned_route: data.assigned_route ? data.assigned_route.trim() : 'General Territory',
        status: 'active'
      };

      const remote = await this.supabaseRequest('profiles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const newRep = (remote && Array.isArray(remote) && remote[0]) ? remote[0] : {
        id: 'rep_' + Date.now(),
        ...payload,
        created_at: new Date().toISOString()
      };

      const profiles = JSON.parse(localStorage.getItem('sina_profiles') || '[]');
      profiles.push(newRep);
      localStorage.setItem('sina_profiles', JSON.stringify(profiles));

      return newRep;
    }

    async updateRepresentative(id, updateData) {
      // Supabase update
      await this.supabaseRequest(`profiles?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updateData, updated_at: new Date().toISOString() })
      });

      const profiles = JSON.parse(localStorage.getItem('sina_profiles') || '[]');
      const index = profiles.findIndex(p => p.id === id);
      if (index !== -1) {
        profiles[index] = { ...profiles[index], ...updateData, updated_at: new Date().toISOString() };
        localStorage.setItem('sina_profiles', JSON.stringify(profiles));
        return profiles[index];
      }
      return updateData;
    }

    async updateRepresentativePassword(id, newPassword) {
      const trimmed = newPassword.trim();
      return this.updateRepresentative(id, { password_hash: trimmed });
    }

    // 2. CATEGORIES & PRODUCTS MASTER
    async getCategories() {
      const remote = await this.supabaseRequest('categories?select=*&order=name.asc');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        localStorage.setItem('sina_categories', JSON.stringify(remote));
        return remote;
      }
      return JSON.parse(localStorage.getItem('sina_categories') || '[]');
    }

    async addCategory(name) {
      const categories = await this.getCategories();
      const existing = categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
      if (existing) return existing;

      const newCat = { id: 'c_' + Date.now(), name: name.trim() };
      categories.push(newCat);
      localStorage.setItem('sina_categories', JSON.stringify(categories));

      this.supabaseRequest('categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCat.name })
      });

      this.broadcast('CATEGORY_ADDED', newCat);
      return newCat;
    }

    async updateCategory(id, data) {
      const categories = await this.getCategories();
      const target = categories.find(c => c.id === id);
      if (target) {
        if (data.name) target.name = data.name.trim();
        if (data.name_mr !== undefined) target.name_mr = data.name_mr ? data.name_mr.trim() : null;
        if (data.name_hi !== undefined) target.name_hi = data.name_hi ? data.name_hi.trim() : null;
        if (data.is_active !== undefined) target.is_active = data.is_active;
        localStorage.setItem('sina_categories', JSON.stringify(categories));
      }

      try {
        await this.supabaseRequest(`categories?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name ? data.name.trim() : undefined,
            name_mr: data.name_mr !== undefined ? data.name_mr : undefined,
            name_hi: data.name_hi !== undefined ? data.name_hi : undefined,
            is_active: data.is_active !== undefined ? data.is_active : undefined
          })
        });
      } catch (e) {
        console.warn('Supabase updateCategory fallback to local:', e);
      }

      this.broadcast('CATEGORY_UPDATED', { id, ...data });
      return target;
    }

    async getProducts() {
      const remote = await this.supabaseRequest('products?select=*&is_active=eq.true&order=name.asc');
      const local = JSON.parse(localStorage.getItem('sina_products') || '[]');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        const merged = remote.map(r => {
          const l = local.find(p => p.id === r.id);
          const maxP = r.max_buy_price != null 
            ? parseFloat(r.max_buy_price) 
            : (l && l.max_buy_price != null ? parseFloat(l.max_buy_price) : parseFloat(r.default_rate || 0));
          return {
            ...r,
            default_rate: parseFloat(r.default_rate || 0),
            max_buy_price: maxP
          };
        });
        localStorage.setItem('sina_products', JSON.stringify(merged));
        return merged;
      }
      return local;
    }

    // PROCUREMENT SOURCES (Mandi, Bar/Dhaba, Dealer, etc.)
    async getProcurementSources(categoryId = null) {
      try {
        let query = 'procurement_sources?select=*&is_active=eq.true&order=name.asc';
        if (categoryId) query += `&category_id=eq.${categoryId}`;
        const remote = await this.supabaseRequest(query);
        if (remote && Array.isArray(remote)) {
          localStorage.setItem('sina_sources', JSON.stringify(remote));
          return remote;
        }
      } catch (e) {
        console.warn('Could not fetch procurement sources:', e);
      }
      return JSON.parse(localStorage.getItem('sina_sources') || '[]');
    }

    async saveProcurementSource(source) {
      const payload = {
        name: source.name.trim(),
        name_mr: source.name_mr ? source.name_mr.trim() : null,
        name_hi: source.name_hi ? source.name_hi.trim() : null,
        category_id: source.category_id || null,
        description: source.description || null,
        is_active: source.is_active !== false
      };
      if (source.id && !source.id.startsWith('src_')) {
        await this.supabaseRequest(`procurement_sources?id=eq.${source.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        return { ...payload, id: source.id };
      } else {
        const res = await this.supabaseRequest('procurement_sources', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return (res && res[0]) ? res[0] : { ...payload, id: 'src_' + Date.now() };
      }
    }

    async deleteProcurementSource(id) {
      return this.supabaseRequest(`procurement_sources?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false })
      });
    }

    // PRODUCT TYPES
    async getProductTypes(categoryId = null, sourceId = null) {
      try {
        let query = 'product_types?select=*&is_active=eq.true&order=name.asc';
        if (categoryId) query += `&category_id=eq.${categoryId}`;
        if (sourceId) query += `&source_id=eq.${sourceId}`;
        const remote = await this.supabaseRequest(query);
        if (remote && Array.isArray(remote)) {
          localStorage.setItem('sina_product_types', JSON.stringify(remote));
          return remote;
        }
      } catch (e) {
        console.warn('Could not fetch product types:', e);
      }
      const local = JSON.parse(localStorage.getItem('sina_product_types') || '[]');
      return local.filter(t => (!categoryId || t.category_id === categoryId) && (!sourceId || t.source_id === sourceId));
    }

    async saveProductType(type) {
      const payload = {
        category_id: type.category_id,
        source_id: type.source_id || null,
        category_name: type.category_name || 'Glass',
        name: type.name.trim(),
        name_mr: type.name_mr ? type.name_mr.trim() : null,
        name_hi: type.name_hi ? type.name_hi.trim() : null,
        is_active: type.is_active !== false
      };
      if (type.id && !type.id.startsWith('type_')) {
        await this.supabaseRequest(`product_types?id=eq.${type.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        return { ...payload, id: type.id };
      } else {
        const res = await this.supabaseRequest('product_types', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return (res && res[0]) ? res[0] : { ...payload, id: 'type_' + Date.now() };
      }
    }

    // PRODUCT SUBTYPES (WITH UNIT, SPEC & SOURCE-SPECIFIC MAX BUY PRICE)
    async getProductSubtypes(typeId = null, sourceId = null) {
      try {
        let query = 'product_subtypes?select=*&is_active=eq.true&order=name.asc';
        if (typeId) query += `&type_id=eq.${typeId}`;
        if (sourceId) query += `&source_id=eq.${sourceId}`;
        const remote = await this.supabaseRequest(query);
        if (remote && Array.isArray(remote)) {
          localStorage.setItem('sina_product_subtypes', JSON.stringify(remote));
          return remote;
        }
      } catch (e) {
        console.warn('Could not fetch product subtypes:', e);
      }
      const local = JSON.parse(localStorage.getItem('sina_product_subtypes') || '[]');
      return local.filter(s => (!typeId || s.type_id === typeId) && (!sourceId || s.source_id === sourceId));
    }

    async saveProductSubtypesBatch(subtypes) {
      for (const sub of subtypes) {
        const payload = {
          type_id: sub.type_id,
          source_id: sub.source_id || null,
          name: sub.name.trim(),
          name_mr: sub.name_mr ? sub.name_mr.trim() : null,
          name_hi: sub.name_hi ? sub.name_hi.trim() : null,
          unit: sub.unit || 'per_piece',
          avg_spec: sub.avg_spec || null,
          max_buy_price: parseFloat(sub.max_buy_price || 0),
          is_active: sub.is_active !== false
        };
        if (sub.id && !sub.id.startsWith('sub_')) {
          await this.supabaseRequest(`product_subtypes?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
        } else {
          await this.supabaseRequest('product_subtypes', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
      }
      return true;
    }

    async deleteProductSubtype(id) {
      return this.supabaseRequest(`product_subtypes?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false })
      });
    }

    // COMPANY BANK ACCOUNTS
    async getCompanyBankAccounts() {
      try {
        const remote = await this.supabaseRequest('company_bank_accounts?select=*&is_active=eq.true&order=bank_name.asc');
        if (remote && Array.isArray(remote)) {
          localStorage.setItem('sina_company_bank_accounts', JSON.stringify(remote));
          return remote;
        }
      } catch (e) {
        console.warn('Could not fetch company bank accounts:', e);
      }
      return JSON.parse(localStorage.getItem('sina_company_bank_accounts') || '[]');
    }

    async saveCompanyBankAccount(acc) {
      const payload = {
        bank_name: acc.bank_name.trim(),
        account_number: acc.account_number ? acc.account_number.trim() : null,
        ifsc_code: acc.ifsc_code ? acc.ifsc_code.trim() : null,
        account_holder: acc.account_holder ? acc.account_holder.trim() : null,
        branch: acc.branch ? acc.branch.trim() : null,
        is_active: acc.is_active !== false
      };
      if (acc.id && !acc.id.startsWith('bank_')) {
        await this.supabaseRequest(`company_bank_accounts?id=eq.${acc.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        return { ...payload, id: acc.id };
      } else {
        const res = await this.supabaseRequest('company_bank_accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return (res && res[0]) ? res[0] : { ...payload, id: 'bank_' + Date.now() };
      }
    }

    async updateCompanyBankAccount(id, data) {
      return this.supabaseRequest(`company_bank_accounts?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }

    // PURCHASING FIRMS (Our Company Entities)
    async getPurchasingFirms() {
      try {
        const remote = await this.supabaseRequest('purchasing_firms?select=*&is_active=eq.true&order=firm_name.asc');
        if (remote && Array.isArray(remote)) {
          localStorage.setItem('sina_purchasing_firms', JSON.stringify(remote));
          return remote;
        }
      } catch (e) {
        console.warn('Could not fetch purchasing firms:', e);
      }
      return JSON.parse(localStorage.getItem('sina_purchasing_firms') || '[]');
    }

    async savePurchasingFirm(firm) {
      const payload = {
        firm_name: firm.firm_name.trim(),
        gst_number: firm.gst_number ? firm.gst_number.trim().toUpperCase() : '',
        address: firm.address ? firm.address.trim() : null,
        contact_person: firm.contact_person ? firm.contact_person.trim() : null,
        mobile: firm.mobile ? firm.mobile.trim() : null,
        is_active: firm.is_active !== false
      };
      if (firm.id && !firm.id.startsWith('pf_')) {
        await this.supabaseRequest(`purchasing_firms?id=eq.${firm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        return { ...payload, id: firm.id };
      } else {
        const res = await this.supabaseRequest('purchasing_firms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return (res && res[0]) ? res[0] : { ...payload, id: 'pf_' + Date.now() };
      }
    }

    async updatePurchasingFirm(id, data) {
      return this.supabaseRequest(`purchasing_firms?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }

    // GODOWNS (Warehouses)
    async getGodowns() {
      const remote = await this.supabaseRequest('godowns?select=*&is_active=eq.true&order=name.asc');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        localStorage.setItem('sina_godowns', JSON.stringify(remote));
        return remote;
      }
      const local = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      if (local.length === 0) {
        const defaults = [
          { id: 'gd_default_1', name: 'Godown 1 (Central Mandi)', location: 'APMC Yard, Gate 2', contact_person: 'Suresh Patel', is_active: true },
          { id: 'gd_default_2', name: 'Godown 2 (North Warehouse)', location: 'Plot 14, Industrial Area', contact_person: 'Ramesh Kumar', is_active: true }
        ];
        localStorage.setItem('sina_godowns', JSON.stringify(defaults));
        return defaults;
      }
      return local;
    }

    async saveGodown(godown) {
      const payload = {
        name: godown.name.trim(),
        location: godown.location || null,
        contact_person: godown.contact_person || null,
        contact_phone: godown.contact_phone || null,
        is_active: true
      };
      let remote = null;
      try {
        remote = await this.supabaseRequest('godowns', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('Supabase godown insert failed:', err);
      }
      const newGd = (remote && Array.isArray(remote) && remote[0]) ? remote[0] : {
        id: 'gd_' + Date.now(),
        ...payload,
        created_at: new Date().toISOString()
      };
      const godowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      godowns.push(newGd);
      localStorage.setItem('sina_godowns', JSON.stringify(godowns));
      return newGd;
    }

    async updateGodown(godownId, updates) {
      const payload = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.contact_person !== undefined) payload.contact_person = updates.contact_person;
      if (updates.contact_phone !== undefined) payload.contact_phone = updates.contact_phone;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;
      payload.updated_at = new Date().toISOString();
      if (godownId && godownId.length === 36) {
        try {
          await this.supabaseRequest(`godowns?id=eq.${godownId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.warn('Supabase godown update failed:', err);
        }
      }
      const godowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
      const idx = godowns.findIndex(g => g.id === godownId);
      if (idx !== -1) {
        godowns[idx] = { ...godowns[idx], ...payload };
      }
      if (updates.is_active === false) {
        localStorage.setItem('sina_godowns', JSON.stringify(godowns.filter(g => g.is_active !== false)));
      } else {
        localStorage.setItem('sina_godowns', JSON.stringify(godowns));
      }
      return godowns[idx] || null;
    }

    async getSettings() {
      try {
        const remote = await this.supabaseRequest('app_settings?select=*');
        if (remote && Array.isArray(remote) && remote.length > 0) {
          const map = {};
          remote.forEach(item => {
            map[item.key] = (item.value === 'true' || item.value === true);
          });
          localStorage.setItem('sina_admin_settings', JSON.stringify(map));
          return map;
        }
      } catch (e) {
        console.warn('Could not fetch remote app_settings, using local:', e);
      }
      return JSON.parse(localStorage.getItem('sina_admin_settings') || '{"require_expense_receipt": false}');
    }

    async setSetting(key, val) {
      const local = JSON.parse(localStorage.getItem('sina_admin_settings') || '{}');
      local[key] = !!val;
      localStorage.setItem('sina_admin_settings', JSON.stringify(local));

      try {
        await this.supabaseRequest('app_settings', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({
            key: key,
            value: String(val),
            updated_at: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn('Could not sync setting to Supabase app_settings:', e);
      }
      return local;
    }

    async addProduct(product) {
      const products = await this.getProducts();
      const defaultRate = parseFloat(product.default_rate) || 0;
      const maxBuyPrice = parseFloat(product.max_buy_price) || defaultRate;

      const newProd = {
        id: 'p_' + Date.now(),
        category_id: product.category_id || 'c1',
        name: product.name.trim(),
        type: product.type ? product.type.trim() : 'Standard',
        default_unit: product.default_unit || 'per_kg',
        default_rate: defaultRate,
        max_buy_price: maxBuyPrice
      };
      products.push(newProd);
      localStorage.setItem('sina_products', JSON.stringify(products));

      // Attempt remote save to Supabase (with max_buy_price, fallback if column not yet migrated)
      try {
        const remote = await this.supabaseRequest('products', {
          method: 'POST',
          body: JSON.stringify({
            category_id: newProd.category_id,
            name: newProd.name,
            type: newProd.type,
            default_unit: newProd.default_unit,
            default_rate: newProd.default_rate,
            max_buy_price: newProd.max_buy_price
          })
        });
        if (remote && Array.isArray(remote) && remote[0]?.id) {
          newProd.id = remote[0].id;
        }
      } catch (err) {
        console.warn('Could not post with max_buy_price, trying fallback:', err);
        try {
          await this.supabaseRequest('products', {
            method: 'POST',
            body: JSON.stringify({
              category_id: newProd.category_id,
              name: newProd.name,
              type: newProd.type,
              default_unit: newProd.default_unit,
              default_rate: newProd.default_rate
            })
          });
        } catch (inner) {
          console.warn('Failed fallback product insert:', inner);
        }
      }

      this.broadcast('PRODUCT_ADDED', newProd);
      return newProd;
    }

    async updateProduct(id, updates) {
      const products = await this.getProducts();
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...updates };
        if (updates.default_rate !== undefined) products[idx].default_rate = parseFloat(updates.default_rate) || 0;
        if (updates.max_buy_price !== undefined) products[idx].max_buy_price = parseFloat(updates.max_buy_price) || 0;
        localStorage.setItem('sina_products', JSON.stringify(products));
      }

      const patchPayload = {};
      if (updates.name !== undefined) patchPayload.name = updates.name.trim();
      if (updates.category_id !== undefined) patchPayload.category_id = updates.category_id;
      if (updates.type !== undefined) patchPayload.type = updates.type.trim();
      if (updates.default_unit !== undefined) patchPayload.default_unit = updates.default_unit;
      if (updates.default_rate !== undefined) patchPayload.default_rate = parseFloat(updates.default_rate) || 0;
      if (updates.max_buy_price !== undefined) patchPayload.max_buy_price = parseFloat(updates.max_buy_price) || 0;

      try {
        await this.supabaseRequest(`products?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload)
        });
      } catch (err) {
        console.warn('Failed patching product with max_buy_price, trying fallback without it:', err);
        const fallback = { ...patchPayload };
        delete fallback.max_buy_price;
        try {
          await this.supabaseRequest(`products?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(fallback)
          });
        } catch (inner) {
          console.warn('Failed fallback product patch:', inner);
        }
      }

      this.broadcast('PRODUCT_UPDATED', { id, ...updates });
      return products[idx] || updates;
    }

    async deleteProduct(id) {
      let products = await this.getProducts();
      products = products.filter(p => p.id !== id);
      localStorage.setItem('sina_products', JSON.stringify(products));

      this.supabaseRequest(`products?id=eq.${id}`, {
        method: 'DELETE'
      });

      this.broadcast('PRODUCT_DELETED', { id });
    }

    // 3. PROCUREMENT ENTRIES & APPROVALS
    async getProcurementEntries(repId = null) {
      let query = 'procurement_entries?select=*,procurement_items(*),payment_attachments(*),profiles(name,phone)&order=created_at.desc';
      if (repId) {
        query += `&representative_id=eq.${repId}`;
      }
      const remote = await this.supabaseRequest(query);
      const local = JSON.parse(localStorage.getItem('sina_entries') || '[]');

      if (remote && Array.isArray(remote)) {
        const normalized = remote.map(row => this.normalizeEntry(row));
        // Keep pending local entries that aren't yet in remote (offline created)
        const pendingLocals = local.filter(l => l.id && l.id.startsWith('entry_') && !normalized.some(r => r.id === l.id));
        const combined = [...pendingLocals, ...normalized];
        combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        localStorage.setItem('sina_entries', JSON.stringify(combined));
        return repId ? combined.filter(e => e.representative_id === repId) : combined;
      }

      // Offline fallback
      const offlineEntries = repId ? local.filter(e => e.representative_id === repId) : local;
      return [...offlineEntries].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    async deleteProcurementEntry(entryId) {
      const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      const target = entries.find(e => e.id === entryId);
      const filtered = entries.filter(e => e.id !== entryId);
      localStorage.setItem('sina_entries', JSON.stringify(filtered));

      try {
        await this.supabaseRequest(`procurement_entries?id=eq.${entryId}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('Error deleting procurement entry from Supabase:', err);
      }

      this.broadcast('ENTRY_DELETED', { entryId });

      if (target && target.representative_id && window.dispatchPushNotification) {
        window.dispatchPushNotification({
          user_id: target.representative_id,
          target_role: 'representative',
          title: 'Purchase Order Removed',
          body: `Order for ${target.firm_name || 'Vendor'} (₹${parseFloat(target.total_amount || 0).toLocaleString('en-IN')}) was removed by Operations Admin.`,
          data: { url: 'records.html', screen: 'records.html' }
        });
      }
      return true;
    }

    async deleteProcurementEntriesBatch(entryIds) {
      if (!Array.isArray(entryIds) || entryIds.length === 0) return true;
      const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      const targets = entries.filter(e => entryIds.includes(e.id));
      const filtered = entries.filter(e => !entryIds.includes(e.id));
      localStorage.setItem('sina_entries', JSON.stringify(filtered));

      try {
        await this.supabaseRequest(`procurement_entries?id=in.(${entryIds.join(',')})`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('Error batch deleting procurement entries from Supabase:', err);
      }

      this.broadcast('ENTRIES_BATCH_DELETED', { entryIds });

      const repMap = new Map();
      targets.forEach(t => {
        if (t.representative_id) {
          const count = (repMap.get(t.representative_id) || 0) + 1;
          repMap.set(t.representative_id, count);
        }
      });

      repMap.forEach((count, repId) => {
        if (window.dispatchPushNotification) {
          window.dispatchPushNotification({
            user_id: repId,
            target_role: 'representative',
            title: 'Orders Removed by Admin',
            body: `${count} purchase record(s) were removed by Operations Admin.`,
            data: { url: 'records.html', screen: 'records.html' }
          });
        }
      });

      return true;
    }

    async updateProcurementEntryFull(entryId, updates) {
      const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      const idx = entries.findIndex(e => e.id === entryId);
      const patchPayload = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (idx !== -1) {
        entries[idx] = { ...entries[idx], ...patchPayload };
        localStorage.setItem('sina_entries', JSON.stringify(entries));
      }

      try {
        await this.supabaseRequest(`procurement_entries?id=eq.${entryId}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload)
        });
      } catch (err) {
        console.warn('Error updating procurement entry in Supabase:', err);
      }

      this.broadcast('ENTRY_UPDATED', { entryId, ...patchPayload });

      const target = idx !== -1 ? entries[idx] : null;
      if (target && target.representative_id && window.dispatchPushNotification) {
        window.dispatchPushNotification({
          user_id: target.representative_id,
          target_role: 'representative',
          title: 'Order Modified by Admin',
          body: `Order for ${target.firm_name || 'Vendor'} was modified by Operations Admin.`,
          data: { url: 'records.html', screen: 'records.html' }
        });
      }

      return target || patchPayload;
    }

    async updateEntryStatus(entryId, newStatus) {
      // Update local cache
      const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      const target = entries.find(e => e.id === entryId);
      if (target) {
        target.status = newStatus;
        localStorage.setItem('sina_entries', JSON.stringify(entries));
      }

      // Update Supabase
      await this.supabaseRequest(`procurement_entries?id=eq.${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, updated_at: new Date().toISOString() })
      });

      this.broadcast('ENTRY_STATUS_UPDATED', { entryId, status: newStatus });
      return target;
    }

    async updateEntryPayment(entryId, data) {
      const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
      const target = entries.find(e => e.id === entryId);
      const patchPayload = {
        status: data.status || 'verified',
        upi_utr: data.upi_utr || null,
        updated_at: new Date().toISOString()
      };
      if (data.amount && parseFloat(data.amount) > 0) {
        patchPayload.total_amount = parseFloat(data.amount);
      }
      if (data.our_firm_id) patchPayload.our_firm_id = data.our_firm_id;
      if (data.our_firm_name) patchPayload.our_firm_name = data.our_firm_name;
      if (data.our_firm_gst) patchPayload.our_firm_gst = data.our_firm_gst;
      if (data.bank_account_id) patchPayload.bank_account_id = data.bank_account_id;
      if (data.bank_account_name) patchPayload.bank_account_name = data.bank_account_name;

      if (target) {
        if (data.status) target.status = data.status;
        if (data.upi_utr) target.upi_utr = data.upi_utr;
        if (patchPayload.total_amount) target.total_amount = patchPayload.total_amount;
        if (data.our_firm_id) target.our_firm_id = data.our_firm_id;
        if (data.our_firm_name) target.our_firm_name = data.our_firm_name;
        if (data.our_firm_gst) target.our_firm_gst = data.our_firm_gst;
        if (data.bank_account_id) target.bank_account_id = data.bank_account_id;
        if (data.bank_account_name) target.bank_account_name = data.bank_account_name;
        localStorage.setItem('sina_entries', JSON.stringify(entries));
      }

      const patchRes = await this.supabaseRequest(`procurement_entries?id=eq.${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(patchPayload)
      });

      // If entry doesn't exist on remote table yet (e.g. entry_... from notifications fallback), insert it!
      if (!patchRes || (Array.isArray(patchRes) && patchRes.length === 0)) {
        if (target) {
          const insertPayload = {
            representative_id: target.representative_id || (data.representative_id || null),
            firm_name: target.firm_name || data.firm_name || 'Vendor',
            contact_person: target.contact_person || '',
            mobile: target.mobile || '',
            address: target.address || '',
            total_amount: parseFloat(patchPayload.total_amount || target.total_amount || 0),
            payment_mode: target.payment_mode || 'upi',
            upi_id: target.upi_id || null,
            upi_utr: patchPayload.upi_utr || null,
            status: patchPayload.status || 'verified',
            our_firm_id: patchPayload.our_firm_id || null,
            our_firm_name: patchPayload.our_firm_name || null,
            our_firm_gst: patchPayload.our_firm_gst || null,
            bank_account_id: patchPayload.bank_account_id || null,
            bank_account_name: patchPayload.bank_account_name || null
          };
          try {
            await this.supabaseRequest('procurement_entries', {
              method: 'POST',
              body: JSON.stringify(insertPayload)
            });
          } catch (ie) {}
        }
      }

      // Post notification to representative so they receive instant heads-up & badge
      const repId = data.representative_id || (target ? target.representative_id : null);
      if (repId) {
        const firmName = data.firm_name || (target ? target.firm_name : 'Firm');
        const amt = data.amount || (target ? target.total_amount : 0);
        const amtStr = '\u20b9' + parseFloat(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const notifBody = `Payment of ${amtStr} for ${firmName} confirmed (UTR: ${data.upi_utr || 'Settled'}). Tap to view in Records.`;
        // Write to notifications table for in-app badge
        this.supabaseRequest('notifications', {
          method: 'POST',
          body: JSON.stringify({
            user_id: repId,
            target_role: 'representative',
            title: 'UPI Payment Approved!',
            message: notifBody,
            body: notifBody,
            type: 'payment_approved',
            data: { entry_id: entryId, screen: 'records.html', utr: data.upi_utr, amount: amt }
          })
        }).catch(err => console.warn('Rep notification write error:', err));

        // Call send-push edge function to deliver push even when user app is CLOSED
        const config = window.SINA_CONFIG;
        if (config && config.SUPABASE_URL) {
          fetch(`${config.SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              user_id: repId,
              title: 'UPI Payment Approved! \u2705',
              body: notifBody,
              data: { url: 'records.html', utr: data.upi_utr, entry_id: entryId }
            })
          }).catch(err => console.warn('[Push] send-push to rep error:', err));
        }
      }

      this.broadcast('ENTRY_STATUS_UPDATED', { entryId, status: data.status || 'verified', upi_utr: data.upi_utr, amount: data.amount });
      return target;
    }

    // 3a. APP SETTINGS (Mandatory receipt photo toggle)
    async getSettings() {
      const remote = await this.supabaseRequest('app_settings?select=*');
      if (remote && Array.isArray(remote)) {
        const map = {};
        remote.forEach(s => { map[s.key] = s.value; });
        localStorage.setItem('sina_app_settings', JSON.stringify(map));
        return map;
      }
      return JSON.parse(localStorage.getItem('sina_app_settings') || '{"require_expense_receipt":"false"}');
    }

    async setSetting(key, value) {
      await this.supabaseRequest(`app_settings?on_conflict=key`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ key, value: String(value), updated_at: new Date().toISOString() })
      });
      const settings = await this.getSettings();
      settings[key] = String(value);
      localStorage.setItem('sina_app_settings', JSON.stringify(settings));
      this.broadcast('SETTING_UPDATED', { key, value: String(value) });
      return settings;
    }

    // 3b. OPERATIONAL ANALYTICS DATA GENERATOR
    async getAnalyticsData(timeframe = 'all') {
      const allEntries = await this.getProcurementEntries();
      const allExpenses = await this.getExpenses();
      const allFloats = await this.getDailyFloats();
      const profiles = await this.getRepresentatives();

      // Filter by timeframe
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const filterByTime = (itemDateStr) => {
        if (!itemDateStr) return false;
        if (timeframe === 'all') return true;
        const d = new Date(itemDateStr);
        if (timeframe === 'today') {
          return itemDateStr.startsWith(todayStr);
        } else if (timeframe === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= sevenDaysAgo;
        } else if (timeframe === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return d >= thirtyDaysAgo;
        }
        return true;
      };

      const entries = allEntries.filter(e => filterByTime(e.created_at));
      const expenses = allExpenses.filter(e => filterByTime(e.created_at || e.date));

      // 1. Overview KPIs
      const totalSpend = entries.reduce((acc, e) => acc + (parseFloat(e.total_amount) || 0), 0);
      const totalVisits = entries.length;
      const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
      const totalGoodsQty = entries.reduce((acc, e) => acc + (parseFloat(e.quantity) || 0), 0);
      const avgBill = totalVisits > 0 ? (totalSpend / totalVisits) : 0;

      // 2. Representative Rankings
      const repMap = new Map();
      profiles.forEach(p => {
        repMap.set(p.id, {
          id: p.id,
          name: p.name,
          route: p.assigned_route || 'All Routes',
          visits: 0,
          spend: 0,
          qty: 0,
          expenses: 0
        });
      });

      entries.forEach(e => {
        const repId = e.representative_id;
        if (!repId) return;
        if (!repMap.has(repId)) {
          repMap.set(repId, { id: repId, name: e.rep_name || 'Representative', route: 'General', visits: 0, spend: 0, qty: 0, expenses: 0 });
        }
        const r = repMap.get(repId);
        r.visits += 1;
        r.spend += parseFloat(e.total_amount) || 0;
        r.qty += parseFloat(e.quantity) || 0;
      });

      expenses.forEach(exp => {
        const repId = exp.representative_id;
        if (repMap.has(repId)) {
          repMap.get(repId).expenses += parseFloat(exp.amount) || 0;
        }
      });

      const repRankings = Array.from(repMap.values()).sort((a, b) => b.spend - a.spend);

      // 3. Top Merchant Firms
      const firmsMap = new Map();
      entries.forEach(e => {
        const firmName = e.firm_name.trim();
        if (!firmsMap.has(firmName)) {
          firmsMap.set(firmName, {
            firm_name: firmName,
            contact_person: e.contact_person,
            mobile: e.mobile,
            address: e.address,
            total_spent: 0,
            visits_count: 0,
            total_qty: 0,
            reps: new Set()
          });
        }
        const f = firmsMap.get(firmName);
        f.total_spent += parseFloat(e.total_amount) || 0;
        f.visits_count += 1;
        f.total_qty += parseFloat(e.quantity) || 0;
        if (e.rep_name) f.reps.add(e.rep_name);
      });

      const topFirms = Array.from(firmsMap.values())
        .map(f => ({ ...f, reps: Array.from(f.reps).join(', ') }))
        .sort((a, b) => b.total_spent - a.total_spent);

      // 4. Commodity / Product Analysis
      const commMap = new Map();
      entries.forEach(e => {
        // Multi-items or single item
        const items = e.items && e.items.length > 0 ? e.items : [{
          product_name: e.type || e.product_name || e.category_name || 'Goods',
          category_name: e.category_name || 'General',
          quantity: e.quantity || 1,
          unit: e.unit || 'per_kg',
          line_total: e.total_amount || 0,
          rate: e.rate || 0
        }];

        items.forEach(it => {
          const key = (it.product_name || it.type || 'Goods').trim();
          if (!commMap.has(key)) {
            commMap.set(key, {
              name: key,
              category: it.category_name || 'General',
              unit: it.unit || 'per_kg',
              total_qty: 0,
              total_spend: 0,
              entries_count: 0
            });
          }
          const c = commMap.get(key);
          c.total_qty += parseFloat(it.quantity) || 0;
          c.total_spend += parseFloat(it.line_total) || 0;
          c.entries_count += 1;
        });
      });

      const commodities = Array.from(commMap.values())
        .map(c => ({
          ...c,
          avg_rate: c.total_qty > 0 ? (c.total_spend / c.total_qty) : 0
        }))
        .sort((a, b) => b.total_spend - a.total_spend);

      // 5. Payment Mode Distribution
      const modeMap = {
        cash: { mode: 'Cash', count: 0, total: 0 },
        upi: { mode: 'UPI', count: 0, total: 0 },
        bank_transfer: { mode: 'Bank Transfer', count: 0, total: 0 }
      };

      entries.forEach(e => {
        const m = e.payment_mode || 'cash';
        if (modeMap[m]) {
          modeMap[m].count += 1;
          modeMap[m].total += parseFloat(e.total_amount) || 0;
        }
      });

      const paymentModes = Object.values(modeMap).map(m => ({
        ...m,
        pct: totalSpend > 0 ? ((m.total / totalSpend) * 100).toFixed(1) : '0'
      }));

      // 6. Expense Breakdown by Category
      const expCatMap = {};
      expenses.forEach(exp => {
        const cat = exp.category || 'misc';
        if (!expCatMap[cat]) {
          expCatMap[cat] = { category: cat, count: 0, total: 0 };
        }
        expCatMap[cat].count += 1;
        expCatMap[cat].total += parseFloat(exp.amount) || 0;
      });

      const expenseBreakdown = Object.values(expCatMap).sort((a, b) => b.total - a.total);

      return {
        overview: { totalSpend, totalVisits, totalGoodsQty, totalExpenses, avgBill },
        repRankings,
        topFirms,
        commodities,
        paymentModes,
        expenseBreakdown
      };
    }

    // 3b. FIRMS DIRECTORY & REPRESENTATIVE SPENDING SUMMARY
    async getFirmsSummary() {
      const entries = await this.getProcurementEntries();
      const savedFirms = JSON.parse(localStorage.getItem('sina_firms') || '[]');
      const firmsMap = new Map();

      // Initialize with known registered firms
      savedFirms.forEach(f => {
        const key = f.firm_name.trim().toLowerCase();
        firmsMap.set(key, {
          id: f.id || 'f_' + Math.random().toString(36).substr(2, 9),
          firm_name: f.firm_name.trim(),
          contact_person: f.contact_person || '',
          mobile: f.mobile || '',
          address: f.address || '',
          total_visits: 0,
          total_spent: 0,
          last_visited: null,
          visits: []
        });
      });

      // Aggregate procurement entries per firm
      entries.forEach(entry => {
        const firmName = (entry.firm_name || 'Unnamed Firm').trim();
        const key = firmName.toLowerCase();

        let firm = firmsMap.get(key);
        if (!firm) {
          firm = {
            id: entry.firm_id || 'f_' + Math.random().toString(36).substr(2, 9),
            firm_name: firmName,
            contact_person: entry.contact_person || '',
            mobile: entry.mobile || '',
            address: entry.address || '',
            total_visits: 0,
            total_spent: 0,
            last_visited: null,
            visits: []
          };
          firmsMap.set(key, firm);
        }

        if (entry.contact_person && !firm.contact_person) firm.contact_person = entry.contact_person;
        if (entry.mobile && !firm.mobile) firm.mobile = entry.mobile;
        if (entry.address && !firm.address) firm.address = entry.address;

        const amount = parseFloat(entry.total_amount || 0);
        firm.total_visits += 1;
        firm.total_spent += amount;

        const visitTime = new Date(entry.created_at).getTime();
        if (!firm.last_visited || visitTime > new Date(firm.last_visited).getTime()) {
          firm.last_visited = entry.created_at;
        }

        firm.visits.push({
          id: entry.id,
          rep_id: entry.representative_id,
          rep_name: entry.rep_name || 'Representative',
          created_at: entry.created_at,
          amount: amount,
          item_name: entry.type || entry.category_name || 'Goods',
          quantity: entry.quantity,
          unit: entry.unit,
          rate: entry.rate,
          payment_mode: entry.payment_mode || 'cash',
          status: entry.status || 'completed'
        });
      });

      const result = Array.from(firmsMap.values());
      result.forEach(f => {
        f.visits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      result.sort((a, b) => b.total_spent - a.total_spent);
      return result;
    }

    async addFirm(firmData) {
      const savedFirms = JSON.parse(localStorage.getItem('sina_firms') || '[]');
      const cleanName = firmData.firm_name.trim();
      const newFirm = {
        id: 'firm_' + Date.now(),
        firm_name: cleanName,
        contact_person: (firmData.contact_person || '').trim(),
        mobile: (firmData.mobile || '').trim(),
        address: (firmData.address || '').trim(),
        upi_id: (firmData.upi_id || '').trim(),
        created_at: new Date().toISOString()
      };
      savedFirms.push(newFirm);
      localStorage.setItem('sina_firms', JSON.stringify(savedFirms));

      // Attempt Supabase insert
      try {
        await this.supabaseRequest('firms', {
          method: 'POST',
          body: JSON.stringify({
            firm_name: newFirm.firm_name,
            contact_person: newFirm.contact_person,
            mobile: newFirm.mobile,
            address: newFirm.address
          })
        });
      } catch (err) {
        console.warn('Could not push firm to Supabase:', err);
      }

      this.broadcast('FIRM_ADDED', newFirm);
      return newFirm;
    }

    async updateFirm(oldFirmName, updatedData) {
      const savedFirms = JSON.parse(localStorage.getItem('sina_firms') || '[]');
      const cleanOld = (oldFirmName || '').trim().toLowerCase();
      const idx = savedFirms.findIndex(f => (f.firm_name || '').trim().toLowerCase() === cleanOld);
      
      const updatedFirm = {
        firm_name: (updatedData.firm_name || oldFirmName).trim(),
        contact_person: (updatedData.contact_person || '').trim(),
        mobile: (updatedData.mobile || '').trim(),
        address: (updatedData.address || '').trim(),
        upi_id: (updatedData.upi_id || '').trim(),
        updated_at: new Date().toISOString()
      };

      if (idx !== -1) {
        savedFirms[idx] = { ...savedFirms[idx], ...updatedFirm };
      } else {
        savedFirms.push(updatedFirm);
      }
      localStorage.setItem('sina_firms', JSON.stringify(savedFirms));

      try {
        await this.supabaseRequest(`firms?firm_name=eq.${encodeURIComponent(oldFirmName.trim())}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firm_name: updatedFirm.firm_name,
            contact_person: updatedFirm.contact_person,
            mobile: updatedFirm.mobile,
            address: updatedFirm.address,
            upi_id: updatedFirm.upi_id
          })
        });
      } catch (err) {
        console.warn('Could not update firm in Supabase:', err);
      }

      this.broadcast('FIRM_UPDATED', updatedFirm);
      return updatedFirm;
    }

    // 4. CASH FLOATS & EXPENSES
    async getDailyFloats() {
      const remote = await this.supabaseRequest('daily_floats?select=*&order=date.desc');
      if (remote && Array.isArray(remote)) {
        localStorage.setItem('sina_floats', JSON.stringify(remote));
        return remote;
      }
      return JSON.parse(localStorage.getItem('sina_floats') || '[]');
    }

    async issueDailyFloat(repId, amount, notes, date = null) {
      const targetDate = date ? String(date).trim() : new Date().toISOString().split('T')[0];
      const parsedAmount = parseFloat(amount) || 0;

      // Attempt Supabase upsert with explicit on_conflict param
      const remote = await this.supabaseRequest('daily_floats?on_conflict=representative_id,date', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          representative_id: repId,
          float_amount: parsedAmount,
          notes: notes || 'Daily cash given for field operations',
          date: targetDate
        })
      });

      const floatRecord = (remote && Array.isArray(remote) && remote[0]) ? remote[0] : {
        id: 'df_' + Date.now(),
        representative_id: repId,
        date: targetDate,
        float_amount: parsedAmount,
        notes: notes || 'Daily cash given for field operations'
      };

      const floats = await this.getDailyFloats();
      const existingIndex = floats.findIndex(f => f.representative_id === repId && f.date === targetDate);
      if (existingIndex !== -1) {
        floats[existingIndex] = floatRecord;
      } else {
        floats.unshift(floatRecord);
      }
      localStorage.setItem('sina_floats', JSON.stringify(floats));

      // Broadcast FLOAT_UPDATED in real time to SINA App
      const payload = { representative_id: repId, float_amount: parsedAmount, date: targetDate, notes };
      if (this.channel) {
        try {
          this.channel.postMessage({ type: 'FLOAT_UPDATED', payload, timestamp: Date.now() });
        } catch (e) {}
      }
      localStorage.setItem('sina_last_event', JSON.stringify({ type: 'FLOAT_UPDATED', payload, timestamp: Date.now() }));

      // Dispatch Web Push notification to Representative
      try {
        fetch(`${window.SINA_CONFIG.SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': window.SINA_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${window.SINA_CONFIG.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            user_id: repId,
            type: 'FLOAT_ASSIGNED',
            amount: parsedAmount,
            date: targetDate
          })
        }).catch(err => console.warn('Send push notification failed:', err));
      } catch (e) {}

      return floatRecord;
    }

    async getDailyFloatsByRep(repId) {
      const remote = await this.supabaseRequest(`daily_floats?representative_id=eq.${repId}&order=date.desc`);
      if (remote && Array.isArray(remote)) {
        return remote;
      }
      const floats = JSON.parse(localStorage.getItem('sina_floats') || '[]');
      return floats.filter(f => f.representative_id === repId).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async getExpenses(repId = null) {
      let query = 'expenses?select=*&order=created_at.desc';
      if (repId) query += `&representative_id=eq.${repId}`;
      const remote = await this.supabaseRequest(query);
      if (remote && Array.isArray(remote)) {
        localStorage.setItem('sina_expenses', JSON.stringify(remote));
        return remote;
      }
      const expenses = JSON.parse(localStorage.getItem('sina_expenses') || '[]');
      if (repId) return expenses.filter(e => e.representative_id === repId);
      return expenses;
    }

    // 5. CONSOLIDATED ADMIN METRICS (Dual-View: All vs Particular Rep)
    async getAdminDashboardMetrics(repId = null) {
      const today = new Date().toLocaleDateString('en-CA');
      const allEntries = await this.getProcurementEntries(repId);
      const allExpenses = await this.getExpenses(repId);
      const allFloats = await this.getDailyFloats();

      const isToday = (dateStr) => {
        if (!dateStr) return false;
        if (typeof dateStr === 'string' && dateStr.length === 10) return dateStr === today;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d.toLocaleDateString('en-CA') === today;
      };

      const todayEntries = allEntries.filter(e => isToday(e.created_at));
      const todayExpenses = allExpenses.filter(e => isToday(e.created_at || e.date));

      // 1. Total Cash Given Overall (All-time)
      let totalCashGivenOverall = 0;
      if (repId) {
        totalCashGivenOverall = allFloats
          .filter(f => String(f.representative_id) === String(repId))
          .reduce((acc, curr) => acc + (parseFloat(curr.float_amount) || 0), 0);
      } else {
        totalCashGivenOverall = allFloats
          .reduce((acc, curr) => acc + (parseFloat(curr.float_amount) || 0), 0);
      }

      // 2. Total Cash Given Today (Strictly today's float, default 0.00)
      let totalCashGivenToday = 0;
      if (repId) {
        const repFloat = allFloats.find(f => String(f.representative_id) === String(repId) && f.date === today);
        totalCashGivenToday = repFloat ? (parseFloat(repFloat.float_amount) || 0) : 0.00;
      } else {
        totalCashGivenToday = allFloats
          .filter(f => f.date === today)
          .reduce((acc, curr) => acc + (parseFloat(curr.float_amount) || 0), 0);
      }

      // 3. Multi-Day Cumulative Net Balance (All-Time Cash Inflow - All-Time Cash Spent - All-Time Expenses)
      let totalCashSpentOverall = 0;
      let totalExpensesOverall = 0;
      if (repId) {
        totalCashSpentOverall = allEntries
          .filter(e => String(e.representative_id) === String(repId) && e.payment_mode === 'cash')
          .reduce((acc, curr) => acc + (parseFloat(curr.cash_amount != null ? curr.cash_amount : curr.total_amount) || 0), 0);
        totalExpensesOverall = allExpenses
          .filter(e => String(e.representative_id) === String(repId))
          .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      } else {
        totalCashSpentOverall = allEntries
          .filter(e => e.payment_mode === 'cash')
          .reduce((acc, curr) => acc + (parseFloat(curr.cash_amount != null ? curr.cash_amount : curr.total_amount) || 0), 0);
        totalExpensesOverall = allExpenses
          .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      }

      const totalNetBalanceRemaining = Math.max(0, totalCashGivenOverall - totalCashSpentOverall - totalExpensesOverall);

      const totalProcurement = todayEntries.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const todayCashSpent = todayEntries.filter(e => e.payment_mode === 'cash').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const upiCollected = todayEntries.filter(e => e.payment_mode === 'upi').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const bankTransferCollected = todayEntries.filter(e => e.payment_mode === 'bank_transfer').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const totalExpenses = todayExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

      // Remaining cash in hand for today
      const netCashInHand = Math.max(0, totalCashGivenToday - todayCashSpent - totalExpenses);

      const pendingApprovalsCount = todayEntries.filter(e => e.status === 'pending_approval' || e.status === 'pending' || (e.payment_mode !== 'cash' && e.status !== 'verified')).length;

      return {
        todayVisitsCount: todayEntries.length,
        totalProcurement,
        totalCashGivenOverall,
        totalCashGivenToday,
        totalFloatDisbursed: totalCashGivenToday, // backwards compatibility
        todayCashSpent,
        totalCashSpentOverall,
        totalExpensesOverall,
        totalNetBalanceRemaining,
        upiCollected,
        bankTransferCollected,
        totalExpenses,
        netCashInHand,
        pendingApprovalsCount,
        recentEntries: (allEntries && allEntries.length > 0) ? allEntries.slice(0, 50) : todayEntries,
        recentExpenses: (allExpenses && allExpenses.length > 0) ? allExpenses.slice(0, 50) : todayExpenses
      };
    }

    // 5b. REPRESENTATIVE PURCHASES & CASH FOR SPECIFIC DATE (Calendar-driven)
    async getRepPurchasesAndCashForDate(repId, targetDate) {
      if (!targetDate) targetDate = new Date().toISOString().split('T')[0];
      const allEntries = await this.getProcurementEntries(repId);
      const allExpenses = await this.getExpenses(repId);
      const allFloats = await this.getDailyFloats();

      const dayEntries = allEntries.filter(e => e.created_at && e.created_at.startsWith(targetDate));
      const dayExpenses = allExpenses.filter(e => e.created_at && e.created_at.startsWith(targetDate));

      const floatRecord = allFloats.find(f => f.representative_id === repId && f.date === targetDate);
      const cashGiven = floatRecord ? (parseFloat(floatRecord.float_amount) || 0) : 0;
      const notes = floatRecord ? (floatRecord.notes || '') : '';

      const totalProcurement = dayEntries.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const cashSpent = dayEntries.filter(e => e.payment_mode === 'cash').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const upiSpent = dayEntries.filter(e => e.payment_mode === 'upi').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const bankSpent = dayEntries.filter(e => e.payment_mode === 'bank_transfer').reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
      const totalExpenses = dayExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

      const netCashBalance = Math.max(0, cashGiven - cashSpent - totalExpenses);

      return {
        date: targetDate,
        cashGiven,
        notes,
        hasFloatRecord: !!floatRecord,
        entries: dayEntries,
        expenses: dayExpenses,
        totalVisits: dayEntries.length,
        totalProcurement,
        cashSpent,
        upiSpent,
        bankSpent,
        totalExpenses,
        netCashBalance
      };
    }

    // 5c. GET ALL PURCHASES WITH MULTI-CRITERIA FILTERS
    async getAllPurchases(filters = {}) {
      const allEntries = await this.getProcurementEntries();
      let results = allEntries;

      // Filter by Date (YYYY-MM-DD)
      if (filters.date) {
        results = results.filter(e => e.created_at && e.created_at.startsWith(filters.date));
      }

      // Filter by Representative
      if (filters.repId) {
        results = results.filter(e => e.representative_id === filters.repId);
      }

      // Filter by Payment Mode
      if (filters.paymentMode && filters.paymentMode !== 'all') {
        results = results.filter(e => (e.payment_mode || 'cash').toLowerCase() === filters.paymentMode.toLowerCase());
      }

      // Filter by Search Query
      if (filters.search && filters.search.trim() !== '') {
        const q = filters.search.trim().toLowerCase();
        results = results.filter(e => {
          const firm = (e.firm_name || '').toLowerCase();
          const rep = (e.rep_name || '').toLowerCase();
          const contact = (e.contact_person || '').toLowerCase();
          const item = (e.type || e.category_name || '').toLowerCase();
          const mobile = (e.mobile || '').toLowerCase();
          const addr = (e.address || '').toLowerCase();
          return firm.includes(q) || rep.includes(q) || contact.includes(q) || item.includes(q) || mobile.includes(q) || addr.includes(q);
        });
      }

      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // 6. RESET ALL DATA (Make it like starting new)
    async resetAllData() {
      // Clear entries, expenses, notifications, floats to pure empty arrays
      localStorage.setItem('sina_entries', JSON.stringify([]));
      localStorage.setItem('sina_expenses', JSON.stringify([]));
      localStorage.setItem('sina_admin_notifications', JSON.stringify([]));
      localStorage.setItem('sina_floats', JSON.stringify([]));

      // Broadcast reset event across channels to instantly sync SINA App
      if (this.channel) {
        try {
          this.channel.postMessage({ type: 'SYSTEM_RESET', timestamp: Date.now() });
        } catch (e) {}
      }
      localStorage.setItem('sina_last_event', JSON.stringify({ type: 'SYSTEM_RESET', timestamp: Date.now() }));
    }

    showInAppBanner(title, body, url = 'approvals.html') {
      let banner = document.getElementById('sina-admin-inapp-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sina-admin-inapp-banner';
        banner.style.cssText = 'position:fixed; top:16px; left:16px; right:16px; z-index:99999; background:linear-gradient(135deg, #1b5e20, #2e7d32); color:#fff; padding:14px 18px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.35); display:flex; flex-direction:column; gap:4px; font-family:inherit; cursor:pointer; animation:sinaSlideDown 0.35s ease forwards;';
        document.body.appendChild(banner);
      }
      banner.onclick = () => { window.location.href = url; };
      banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.95rem; font-weight:800; display:flex; align-items:center; gap:6px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ${title}
          </strong>
          <span style="font-size:0.85rem; opacity:0.8; padding:2px 6px;" onclick="event.stopPropagation(); this.closest('#sina-admin-inapp-banner').remove();">✕</span>
        </div>
        <div style="font-size:0.82rem; opacity:0.95; line-height:1.3;">${body}</div>
      `;
      setTimeout(() => { if (banner && banner.parentNode) banner.remove(); }, 7000);
    }

    handleRealtimeChange(table, record) {
      if (!record) return;
      console.log('[SINA Admin Realtime] Event on table:', table, record);

      // 1. Update local storage based on table
      if (table === 'procurement_entries') {
        const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
        const norm = this.normalizeEntry(record);
        const idx = entries.findIndex(e => e.id === record.id);
        if (idx !== -1) {
          entries[idx] = { ...entries[idx], ...norm };
        } else {
          entries.unshift(norm);
        }
        entries.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        localStorage.setItem('sina_entries', JSON.stringify(entries));
      } else if (table === 'daily_floats') {
        const floats = JSON.parse(localStorage.getItem('sina_floats') || '[]');
        const idx = floats.findIndex(f => f.id === record.id);
        if (idx !== -1) {
          floats[idx] = { ...floats[idx], ...record };
        } else {
          floats.unshift(record);
        }
        localStorage.setItem('sina_floats', JSON.stringify(floats));
      } else if (table === 'firms') {
        const firms = JSON.parse(localStorage.getItem('sina_firms') || '[]');
        const idx = firms.findIndex(f => f.id === record.id);
        if (idx !== -1) {
          firms[idx] = { ...firms[idx], ...record };
        } else {
          firms.push(record);
        }
        localStorage.setItem('sina_firms', JSON.stringify(firms));
      } else if (table === 'products') {
        const prods = JSON.parse(localStorage.getItem('sina_products') || '[]');
        const idx = prods.findIndex(p => p.id === record.id);
        if (idx !== -1) {
          prods[idx] = { ...prods[idx], ...record };
        } else {
          prods.push(record);
        }
        localStorage.setItem('sina_products', JSON.stringify(prods));
      } else if (table === 'godowns') {
        const godowns = JSON.parse(localStorage.getItem('sina_godowns') || '[]');
        const idx = godowns.findIndex(g => g.id === record.id);
        if (idx !== -1) {
          godowns[idx] = { ...godowns[idx], ...record };
        } else if (record.is_active !== false) {
          godowns.push(record);
        }
        localStorage.setItem('sina_godowns', JSON.stringify(godowns.filter(g => g.is_active !== false)));
      } else if (table === 'expenses') {
        const expenses = JSON.parse(localStorage.getItem('sina_expenses') || '[]');
        const idx = expenses.findIndex(e => e.id === record.id);
        if (idx !== -1) {
          expenses[idx] = { ...expenses[idx], ...record };
        } else {
          expenses.unshift(record);
        }
        localStorage.setItem('sina_expenses', JSON.stringify(expenses));
      }

      // 2. Notification generation
      let notifTitle = 'Field Activity';
      let notifBody = 'New activity recorded in the field.';

      if (table === 'procurement_entries') {
        const amt = record.total_amount ? `₹${parseFloat(record.total_amount).toLocaleString('en-IN')}` : '';
        const mode = (record.payment_mode || '').toUpperCase();
        if (record.payment_mode === 'upi' && (record.status === 'pending' || record.status === 'pending_approval')) {
          notifTitle = `New UPI Payment Request: ${amt}`;
          notifBody = `${record.firm_name || 'Firm'}: ${amt} pending PhonePe approval. Tap to pay.`;
        } else {
          notifTitle = `New Purchase: ${amt}`;
          notifBody = `${record.firm_name || 'Firm'}: ${amt} via ${mode}`;
        }
      } else if (table === 'rep_locations') {
        notifTitle = 'Rep GPS Location';
        notifBody = `Field representative logged location at (${record.latitude}, ${record.longitude})`;
      } else if (table === 'expenses') {
        const expAmt = record.amount ? `₹${parseFloat(record.amount).toLocaleString('en-IN')}` : '';
        notifTitle = `New Field Expense: ${expAmt}`;
        notifBody = `${record.representative_name || 'Rep'}: ${record.category || 'Expense'} - ${expAmt}`;
      } else if (table === 'notifications') {
        notifTitle = record.title || notifTitle;
        notifBody = record.body || record.message || notifBody;

        // If notification contains order or approval data, immediately inject it into local sina_entries
        const d = record.data || {};
        const entryId = d.entry_id || record.entry_id || (d.url && d.url.match(/entry_id=([^&]+)/)?.[1]);
        if (entryId) {
          const entries = JSON.parse(localStorage.getItem('sina_entries') || '[]');
          if (!entries.some(e => e.id === entryId)) {
            const amt = parseFloat(d.amount || d.total_amount || 0);
            const repName = d.rep_name || (record.body ? record.body.split('•')[0].trim() : 'Field Rep');
            const firmName = d.firm_name || 'Vendor';
            const mode = (d.payment_mode || (record.title?.toLowerCase().includes('cash') ? 'cash' : 'upi')).toLowerCase();
            const isVerified = record.type === 'payment_approved' || (record.title && record.title.toLowerCase().includes('verified'));
            let billNum = d.bill_number;
            if (!billNum && record.title) {
              const bm = record.title.match(/\(([A-Z0-9]+)\)/i);
              if (bm && bm[1]) billNum = bm[1];
            }
            if (!billNum) billNum = 'G' + entryId.slice(0, 6).toUpperCase();

            entries.unshift({
              id: entryId,
              representative_id: record.user_id || d.representative_id || null,
              rep_name: repName,
              firm_name: firmName,
              contact_person: d.contact_person || '',
              mobile: d.mobile || '',
              address: d.address || '',
              total_amount: amt,
              payment_mode: mode,
              cash_amount: mode === 'cash' ? amt : 0,
              upi_id: d.upi_id || '',
              upi_utr: d.upi_utr || '',
              status: isVerified ? 'verified' : 'pending_approval',
              created_at: record.created_at || new Date().toISOString(),
              bill_number: billNum,
              items: d.items || [{ product_name: d.type || 'Goods', quantity: 1, rate: amt, line_total: amt }]
            });
            entries.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            localStorage.setItem('sina_entries', JSON.stringify(entries));
          }
        }
      }

      let bannerTargetUrl = (record.payment_mode === 'upi' || record.payment_mode === 'bank_transfer') ? 'approvals.html' : 'history.html';
      if (table === 'expenses') {
        bannerTargetUrl = record.representative_id ? `rep-detail.html?id=${encodeURIComponent(record.representative_id)}` : 'representatives.html';
      }

      const notifications = JSON.parse(localStorage.getItem('sina_admin_notifications') || '[]');
      const notif = {
        id: 'notif_' + Date.now(),
        type: table,
        title: notifTitle,
        body: notifBody,
        payload: record,
        screen: bannerTargetUrl,
        timestamp: Date.now(),
        read: false
      };
      notifications.unshift(notif);
      localStorage.setItem('sina_admin_notifications', JSON.stringify(notifications));

      // 3. Update top nav notification badge & approvals badge
      const notifBadge = document.querySelector('.notif-counter');
      if (notifBadge) {
        const unreadCount = notifications.filter(n => !n.read).length;
        notifBadge.textContent = unreadCount > 0 ? unreadCount : '';
        notifBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      }

      const approvalsBadge = document.getElementById('admin-approvals-badge');
      if (approvalsBadge && (record.payment_mode === 'upi' || record.payment_mode === 'bank_transfer')) {
        approvalsBadge.style.display = 'block';
      }

      // Play synthesized pleasant chime on Android webview
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (audioErr) {}

      // Display slick in-app banner
      this.showInAppBanner(notifTitle, notifBody, bannerTargetUrl);

      // 4. Trigger active page live re-render!
      if (typeof window.refreshAdminData === 'function') {
        try {
          window.refreshAdminData();
        } catch (e) {
          console.warn('Error executing refreshAdminData:', e);
        }
      }

      // 5. Send message to FlutterBridge for native Android notification
      if (window.FlutterBridge) {
        try {
          window.FlutterBridge.postMessage(JSON.stringify({
            action: 'SHOW_NOTIFICATION',
            title: notifTitle,
            body: notifBody
          }));
        } catch (e) {
          console.warn('FlutterBridge notification error:', e);
        }
      }
    }

    async getLatestRepLocations() {
      const reps = await this.getRepresentatives();
      const results = [];

      for (const rep of reps) {
        try {
          const locRes = await this.supabaseRequest(`rep_locations?rep_id=eq.${rep.id}&select=*,firms(firm_name)&order=created_at.desc&limit=1`);
          results.push({
            rep: rep,
            location: (locRes && locRes.length > 0) ? locRes[0] : null
          });
        } catch (e) {
          results.push({
            rep: rep,
            location: null
          });
        }
      }
      return results;
    }

    async getRepLocationHistory(repId) {
      try {
        const res = await this.supabaseRequest(`rep_locations?rep_id=eq.${repId}&select=*,firms(firm_name)&order=created_at.desc&limit=50`);
        return res || [];
      } catch (err) {
        console.warn('Error fetching rep location history:', err);
        return [];
      }
    }

    // ----------------------------------------------------
    // SOURCES, TYPES & SUBTYPES SPREADSHEET (NO POPUPS)
    // ----------------------------------------------------
    async getProcurementSources() {
      let local = [];
      try {
        local = JSON.parse(localStorage.getItem('sina_procurement_sources') || '[]');
      } catch (e) { local = []; }

      if (!local || local.length === 0) {
        local = [
          { id: 'src_default_1', category_name: 'Glass', name: 'Bar/Dhaba/Wineshop', name_mr: 'बार/धाबा/वाईनशॉप', name_hi: 'बार/ढाबा/वाइनशॉप', is_active: true },
          { id: 'src_default_2', category_name: 'Glass', name: 'Dealer', name_mr: 'व्यापारी', name_hi: 'व्यापारी', is_active: true },
          { id: 'src_default_3', category_name: 'Glass', name: 'Mandi / Market', name_mr: 'मंडी / बाजार', name_hi: 'मंडी / बाजार', is_active: true },
          { id: 'src_default_4', category_name: 'Glass', name: 'Direct Collector', name_mr: 'थेट संकलक', name_hi: 'प्रत्यक्ष संग्रहकर्ता', is_active: true }
        ];
        localStorage.setItem('sina_procurement_sources', JSON.stringify(local));
      }

      try {
        const res = await this.supabaseRequest('procurement_sources?order=created_at.asc');
        if (res && Array.isArray(res) && res.length > 0) {
          localStorage.setItem('sina_procurement_sources', JSON.stringify(res));
          return res;
        }
      } catch (err) {
        console.warn('Supabase procurement_sources fetch failed:', err);
      }
      return local;
    }

    async saveProcurementSource(data) {
      if (!data.id) data.id = 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      if (!data.created_at) data.created_at = new Date().toISOString();

      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_procurement_sources') || '[]'); } catch (e) {}
      const idx = local.findIndex(s => s.id === data.id);
      if (idx >= 0) local[idx] = Object.assign({}, local[idx], data);
      else local.push(data);
      localStorage.setItem('sina_procurement_sources', JSON.stringify(local));

      try {
        if (idx >= 0) {
          const res = await this.supabaseRequest(`procurement_sources?id=eq.${data.id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
          });
          if (res && res[0]) return res[0];
        } else {
          const res = await this.supabaseRequest('procurement_sources', {
            method: 'POST',
            body: JSON.stringify(data)
          });
          if (res && res[0]) return res[0];
        }
      } catch (e) {
        console.warn('Supabase saveProcurementSource error:', e);
      }
      return data;
    }

    async deleteProcurementSource(id) {
      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_procurement_sources') || '[]'); } catch (e) {}
      local = local.filter(s => s.id !== id);
      localStorage.setItem('sina_procurement_sources', JSON.stringify(local));

      try {
        await this.supabaseRequest(`procurement_sources?id=eq.${id}`, { method: 'DELETE' });
      } catch (e) {}
      return true;
    }

    async getProductTypes() {
      try {
        const res = await this.supabaseRequest('product_types?order=created_at.asc');
        if (res && Array.isArray(res)) return res;
      } catch (err) {
        console.warn('Supabase product_types fetch failed:', err);
      }
      return JSON.parse(localStorage.getItem('sina_product_types') || '[]');
    }

    async saveProductType(data) {
      if (data.id) {
        const res = await this.supabaseRequest(`product_types?id=eq.${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        return res && res[0] ? res[0] : data;
      } else {
        const res = await this.supabaseRequest('product_types', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        return res && res[0] ? res[0] : data;
      }
    }

    async getProductSubtypes(typeId = null) {
      try {
        const endpoint = typeId
          ? `product_subtypes?type_id=eq.${typeId}&order=created_at.asc`
          : 'product_subtypes?order=created_at.asc';
        const res = await this.supabaseRequest(endpoint);
        if (res && Array.isArray(res)) return res;
      } catch (err) {
        console.warn('Supabase product_subtypes fetch failed:', err);
      }
      const local = JSON.parse(localStorage.getItem('sina_product_subtypes') || '[]');
      return typeId ? local.filter(s => s.type_id === typeId) : local;
    }

    async saveProductSubtypesBatch(payloads) {
      if (!Array.isArray(payloads) || payloads.length === 0) return [];
      const results = [];
      for (const item of payloads) {
        if (item.id) {
          const res = await this.supabaseRequest(`product_subtypes?id=eq.${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify(item)
          });
          results.push(res && res[0] ? res[0] : item);
        } else {
          const res = await this.supabaseRequest('product_subtypes', {
            method: 'POST',
            body: JSON.stringify(item)
          });
          results.push(res && res[0] ? res[0] : item);
        }
      }
      return results;
    }

    async deleteProductSubtype(id) {
      return await this.supabaseRequest(`product_subtypes?id=eq.${id}`, {
        method: 'DELETE'
      });
    }

    // ----------------------------------------------------
    // COMPANY BANK ACCOUNTS & PURCHASING FIRMS
    // ----------------------------------------------------
    async getCompanyBankAccounts() {
      let local = [];
      try {
        local = JSON.parse(localStorage.getItem('sina_company_bank_accounts') || '[]');
      } catch (e) { local = []; }

      if (!local || local.length === 0) {
        local = [
          {
            id: 'acc_default_1',
            bank_name: 'HDFC Bank - Corporate Account',
            account_number: '50200084920194',
            ifsc_code: 'HDFC0001234',
            account_holder: 'SINA Operations Ltd.',
            branch: 'Main Branch, Pune',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'acc_default_2',
            bank_name: 'State Bank of India - SINA Ops',
            account_number: '384729105432',
            ifsc_code: 'SBIN0004567',
            account_holder: 'SINA Operations Ltd.',
            branch: 'Shivajinagar, Pune',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem('sina_company_bank_accounts', JSON.stringify(local));
      }

      try {
        const res = await this.supabaseRequest('company_bank_accounts?order=created_at.asc');
        if (res && Array.isArray(res) && res.length > 0) {
          localStorage.setItem('sina_company_bank_accounts', JSON.stringify(res));
          return res;
        }
      } catch (err) {
        console.warn('Supabase company_bank_accounts fetch failed:', err);
      }
      return local;
    }

    async getBankAccounts() {
      return this.getCompanyBankAccounts();
    }

    async saveCompanyBankAccount(data) {
      if (!data.id) data.id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      if (!data.created_at) data.created_at = new Date().toISOString();

      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_company_bank_accounts') || '[]'); } catch (e) {}
      const idx = local.findIndex(a => a.id === data.id);
      if (idx >= 0) local[idx] = Object.assign({}, local[idx], data);
      else local.push(data);
      localStorage.setItem('sina_company_bank_accounts', JSON.stringify(local));

      try {
        const res = await this.supabaseRequest('company_bank_accounts', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        if (res && res[0]) return res[0];
      } catch (e) {
        console.warn('Supabase saveCompanyBankAccount error:', e);
      }
      return data;
    }

    async updateCompanyBankAccount(id, data) {
      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_company_bank_accounts') || '[]'); } catch (e) {}
      const idx = local.findIndex(a => a.id === id);
      if (idx >= 0) {
        local[idx] = Object.assign({}, local[idx], data);
        localStorage.setItem('sina_company_bank_accounts', JSON.stringify(local));
      }

      try {
        const res = await this.supabaseRequest(`company_bank_accounts?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        if (res && res[0]) return res[0];
      } catch (e) {
        console.warn('Supabase updateCompanyBankAccount error:', e);
      }
      return data;
    }

    async getPurchasingFirms() {
      let local = [];
      try {
        local = JSON.parse(localStorage.getItem('sina_purchasing_firms') || '[]');
      } catch (e) { local = []; }

      if (!local || local.length === 0) {
        local = [
          {
            id: 'pf_default_1',
            firm_name: 'SINA Agro Industries Ltd.',
            gst_number: '27AAACS1234F1Z5',
            address: 'Plot 14, MIDC, Bhosari, Pune - 411026',
            phone: '9822012345',
            contact_person: 'Director / Accounts',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'pf_default_2',
            firm_name: 'SINA Recycling & Trading Co.',
            gst_number: '27AABCS5678G2Z1',
            address: 'Gate 3, Market Yard, Pune - 411037',
            phone: '9822054321',
            contact_person: 'Procurement Head',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem('sina_purchasing_firms', JSON.stringify(local));
      }

      try {
        const res = await this.supabaseRequest('purchasing_firms?order=created_at.asc');
        if (res && Array.isArray(res) && res.length > 0) {
          localStorage.setItem('sina_purchasing_firms', JSON.stringify(res));
          return res;
        }
      } catch (err) {
        console.warn('Supabase purchasing_firms fetch failed:', err);
      }
      return local;
    }

    async savePurchasingFirm(data) {
      if (!data.id) data.id = 'firm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      if (!data.created_at) data.created_at = new Date().toISOString();

      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_purchasing_firms') || '[]'); } catch (e) {}
      const idx = local.findIndex(f => f.id === data.id);
      if (idx >= 0) local[idx] = Object.assign({}, local[idx], data);
      else local.push(data);
      localStorage.setItem('sina_purchasing_firms', JSON.stringify(local));

      try {
        const res = await this.supabaseRequest('purchasing_firms', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        if (res && res[0]) return res[0];
      } catch (e) {
        console.warn('Supabase savePurchasingFirm error:', e);
      }
      return data;
    }

    async updatePurchasingFirm(id, data) {
      let local = [];
      try { local = JSON.parse(localStorage.getItem('sina_purchasing_firms') || '[]'); } catch (e) {}
      const idx = local.findIndex(f => f.id === id);
      if (idx >= 0) {
        local[idx] = Object.assign({}, local[idx], data);
        localStorage.setItem('sina_purchasing_firms', JSON.stringify(local));
      }

      try {
        const res = await this.supabaseRequest(`purchasing_firms?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        if (res && res[0]) return res[0];
      } catch (e) {
        console.warn('Supabase updatePurchasingFirm error:', e);
      }
      return data;
    }
  }

  window.sinaAdminDB = new SINA_AdminDB();
  window.sinaDB = window.sinaAdminDB;
})();
