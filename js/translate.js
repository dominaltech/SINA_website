// SINA Admin - Instant Multilingual Translation Engine
// Supports: English (EN), Marathi / मराठी (MR), Hindi / हिन्दी (HI) with strict language isolation
(function() {
  const STORAGE_KEY = 'sina_app_language';
  const LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', short: 'EN' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', short: 'MR' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', short: 'HI' }
  ];

  const DICTIONARY = {
    mr: {
      // Top bar & Drawer
      'Operations Dashboard': 'कार्यप्रणाली डॅशबोर्ड',
      'Representatives & Passwords': 'प्रतिनिधी आणि पासवर्ड',
      'Purchase History': 'खरेदी इतिहास',
      'Receipts & Vouchers': 'पावत्या आणि व्हाउचर',
      'Company Bank Accounts': 'कंपनी बँक खाती',
      'Our Purchasing Firms': 'आमच्या खरेदी कंपन्या',
      'Procurement Sources': 'खरेदी स्त्रोत',
      'Commodities & Product Master': 'वस्तू आणि उत्पादन मास्टर',
      'Firms Directory': 'फर्म डायरेक्टरी',
      'Godowns & Warehouses': 'गोदाम आणि साठा',
      'Payment Approvals': 'पेमेंट मंजुरी',
      'Operational Analytics': 'कार्यप्रणाली विश्लेषण',
      'Field Rep GPS Tracking': 'फील्ड प्रतिनिधी जीपीएस ट्रॅकिंग',
      'App Policies & Settings': 'ॲप धोरणे आणि सेटिंग्ज',
      'Sign Out': 'साइन आउट',
      'Logout Admin': 'ॲडमिन लॉगआउट',
      'Reset All Data': 'सर्व डेटा रीसेट करा',

      // General Actions
      'Save': 'सेव्ह करा',
      'Save All Changes': 'सर्व बदल सेव्ह करा',
      'Cancel': 'रद्द करा',
      'Delete': 'हटवा',
      'Edit': 'संपादित करा',
      'Activate': 'सक्रिय करा',
      'Deactivate': 'निष्क्रिय करा',
      'Active': 'सक्रिय',
      'Inactive': 'निष्क्रिय',
      'Subtotal': 'उपएकूण',
      'Net Total': 'निव्वळ एकूण',
      'Total Amount': 'एकूण रक्कम',
      'GST Mode': 'जीएसटी पर्याय',
      'No GST': 'जीएसटी नाही',
      'With GST (9%)': 'जीएसटी सह (९%)',
      'Select Our Purchasing Firm': 'आमची खरेदी करणारी फर्म निवडा',
      'Paying Bank Account': 'पेमेंट करणारे बँक खाते',

      // Glass and Product Hierarchy
      'Glass': 'काच',
      'Bar/Dhaba/Wineshop': 'बार/धाबा/वाईनशॉप',
      'Dealer': 'व्यापारी',
      'Beer Bottle': 'बियर बाटली',
      'Other Bottle': 'इतर बाटल्या / काच',
      'Large Beer 650ml (Kingfisher/Budweiser)': 'मोठी बियर (किंगफिशर/बडवायझर)',
      'Large Beer 650ml (Tuborg/Carlsburg)': 'मोठी बियर (ट्युबर्ग/कार्ल्सबर्ग)',
      'Small Beer 330ml (Kingfisher/Budweiser)': 'छोटी बियर (किंगफिशर/बडवायझर)',
      'Small Beer 650ml (Tuborg/Carlsburg)': 'छोटी बियर (ट्युबर्ग/कार्ल्सबर्ग)',
      '20 Dozen Bag': '२० डझन बोरी',
      'Pani Colour Bag 25 Dozen': 'पाणी कलर बोरी २५ डझन',
      '1Kg Mix': '१ किलो',
      'Tango': 'टँगो',
      'Royal Stag / IB': 'रॉयल स्टॅग / आय बी',
      'Plain': 'प्लेन',
      'Khamba': 'खंबा',
      'Chura': 'चूरा',

      // Units
      'Per Piece': 'प्रती नग',
      'Per Bag': 'प्रती बोरी',
      'Per Kg': 'प्रती किलो',
      'Per Dozen': 'प्रती डझन',

      // Receipts
      'Procurement Receipts & Vouchers': 'खरेदी पावत्या आणि व्हाउचर',
      'Download as PDF': 'पीडीएफ डाउनलोड करा',
      'Download as Image (PNG)': 'फोटो (PNG) डाउनलोड करा',
      'Print Receipt': 'पावती प्रिंट करा',
      'Receipt Format Settings': 'पावती स्वरूप सेटिंग्ज',
      'Forms': 'फॉर्म्स',
      'Firms': 'कंपन्या',
      'Add Purchasing Firm': 'खरेदी कंपनी जोडा',
      '+ Add Purchasing Firm': '+ खरेदी कंपनी जोडा',
      'Add Procurement Source': 'खरेदी स्त्रोत जोडा',
      '+ Add Source': '+ खरेदी स्त्रोत जोडा',
      'Add Bank Account': 'बँक खाते जोडा',
      '+ Add Bank Account': '+ बँक खाते जोडा',
      'Active Firms': 'सक्रिय कंपन्या',
      'Active Accounts': 'सक्रिय खाती',
      'Total Purchases': 'एकूण खरेदी',
      'Bills Issued': 'जारी केलेली बिले',
      'Total Disbursed': 'एकूण वितरित',
      'Transactions Made': 'एकूण व्यवहार',
      'Account Payment Ledger': 'खाते पेमेंट खातेवही',
      'Filter by Category:': 'वर्गवारीनुसार फिल्टर:',
      'All Categories': 'सर्व वर्ग',
      'Firm Name': 'कंपनीचे नाव',
      'Bank Name': 'बँकेचे नाव',
      'Account Number': 'खाते क्रमांक',
      'IFSC Code': 'आयएफएससी कोड',
      'Account Holder Name': 'खातेधारकाचे नाव',
      'Branch Name': 'शाखा',
      'Save Firm': 'कंपनी सेव्ह करा',
      'Save Source': 'स्त्रोत सेव्ह करा',
      'Save Bank Account': 'बँक खाते सेव्ह करा',
      'Save Format Settings': 'स्वरूप सेव्ह करा'
    },
    hi: {
      // Top bar & Drawer
      'Operations Dashboard': 'परिचालन डैशबोर्ड',
      'Representatives & Passwords': 'प्रतिनिधि और पासवर्ड',
      'Purchase History': 'खरीद इतिहास',
      'Receipts & Vouchers': 'रसीदें और वाउचर',
      'Company Bank Accounts': 'कंपनी बैंक खाते',
      'Our Purchasing Firms': 'हमारी खरीद फर्म',
      'Procurement Sources': 'खरीद स्रोत',
      'Commodities & Product Master': 'वस्तु और उत्पाद मास्टर',
      'Firms Directory': 'फर्म डायरेक्टरी',
      'Godowns & Warehouses': 'गोदाम और भंडारण',
      'Payment Approvals': 'भुगतान अनुमोदन',
      'Operational Analytics': 'परिचालन विश्लेषण',
      'Field Rep GPS Tracking': 'फील्ड प्रतिनिधि जीपीएस ट्रैकिंग',
      'App Policies & Settings': 'ऐप नीतियां और सेटिंग्स',
      'Sign Out': 'साइन आउट',
      'Logout Admin': 'एडमिन लॉगआउट',
      'Reset All Data': 'सभी डेटा रीसेट करें',

      // General Actions
      'Save': 'सहेजें',
      'Save All Changes': 'सभी परिवर्तन सहेजें',
      'Cancel': 'रद्द करें',
      'Delete': 'हटाएं',
      'Edit': 'संपादित करें',
      'Activate': 'सक्रिय करें',
      'Deactivate': 'निष्क्रिय करें',
      'Active': 'सक्रिय',
      'Inactive': 'निष्क्रिय',
      'Subtotal': 'उपकुल',
      'Net Total': 'कुल राशि',
      'Total Amount': 'कुल राशि',
      'GST Mode': 'जीएसटी मोड',
      'No GST': 'जीएसटी नहीं',
      'With GST (9%)': 'जीएसटी सहित (9%)',
      'Select Our Purchasing Firm': 'हमारी खरीद फर्म चुनें',
      'Paying Bank Account': 'भुगतान बैंक खाता',

      // Glass and Product Hierarchy
      'Glass': 'कांच',
      'Bar/Dhaba/Wineshop': 'बार/ढाबा/वाइनशॉप',
      'Dealer': 'डीलर / व्यापारी',
      'Beer Bottle': 'बीयर की बोतल',
      'Other Bottle': 'अन्य बोतल / कांच',
      'Large Beer 650ml (Kingfisher/Budweiser)': 'बड़ी बीयर 650ml (किंगफिशर/बडवाइज़र)',
      'Large Beer 650ml (Tuborg/Carlsburg)': 'बड़ी बीयर 650ml (ट्युबर्ग/कार्लसबर्ग)',
      'Small Beer 330ml (Kingfisher/Budweiser)': 'छोटी बीयर 330ml (किंगफिशर/बडवाइज़र)',
      'Small Beer 650ml (Tuborg/Carlsburg)': 'छोटी बीयर 650ml (ट्युबर्ग/कार्लसबर्ग)',
      '20 Dozen Bag': '20 दर्जन बोरी',
      'Pani Colour Bag 25 Dozen': 'पानी कलर बोरी 25 दर्जन',
      '1Kg Mix': '1 किलो',
      'Tango': 'टैंगो',
      'Royal Stag / IB': 'रॉयल स्टैग / आईबी',
      'Plain': 'सादा (प्लेन)',
      'Khamba': 'खंभा',
      'Chura': 'चूरा (स्क्रैप)',

      // Units
      'Per Piece': 'प्रति नग',
      'Per Bag': 'प्रति बोरी',
      'Per Kg': 'प्रति किलो',
      'Per Dozen': 'प्रति दर्जन',

      // Receipts
      'Procurement Receipts & Vouchers': 'खरीद रसीदें और वाउचर',
      'Download as PDF': 'पीडीएफ डाउनलोड करें',
      'Download as Image (PNG)': 'छवि (PNG) डाउनलोड करें',
      'Print Receipt': 'रसीद प्रिंट करें',
      'Receipt Format Settings': 'रसीद प्रारूप सेटिंग्स',
      'Forms': 'फॉर्म्स',
      'Firms': 'कंपनियां',
      'Add Purchasing Firm': 'खरीद फर्म जोड़ें',
      '+ Add Purchasing Firm': '+ खरीद फर्म जोड़ें',
      'Add Procurement Source': 'खरीद स्रोत जोड़ें',
      '+ Add Source': '+ स्रोत जोड़ें',
      'Add Bank Account': 'बैंक खाता जोड़ें',
      '+ Add Bank Account': '+ बैंक खाता जोड़ें',
      'Active Firms': 'सक्रिय फर्म',
      'Active Accounts': 'सक्रिय खाते',
      'Total Purchases': 'कुल खरीद',
      'Bills Issued': 'जारी बिल',
      'Total Disbursed': 'कुल वितरित',
      'Transactions Made': 'कुल लेन-देन',
      'Account Payment Ledger': 'खाता भुगतान लेजर',
      'Filter by Category:': 'श्रेणी अनुसार फ़िल्टर:',
      'All Categories': 'सभी श्रेणियां',
      'Firm Name': 'फर्म का नाम',
      'Bank Name': 'बैंक का नाम',
      'Account Number': 'खाता संख्या',
      'IFSC Code': 'आईएफएससी कोड',
      'Account Holder Name': 'खाताधारक का नाम',
      'Branch Name': 'शाखा',
      'Save Firm': 'फर्म सहेजें',
      'Save Source': 'स्रोत सहेजें',
      'Save Bank Account': 'बैंक खाता सहेजें',
      'Save Format Settings': 'प्रारूप सहेजें'
    }
  };

  class AdminTranslateEngine {
    constructor() {
      this.currentLang = localStorage.getItem(STORAGE_KEY) || 'en';
      this.isTranslating = false;
      const onReady = () => {
        this.initUI();
        this.applyLanguage(this.currentLang);
        this.startObserver();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
      } else {
        onReady();
      }
    }

    getLang() {
      return this.currentLang;
    }

    t(key) {
      if (this.currentLang === 'en' || !DICTIONARY[this.currentLang]) return key;
      return DICTIONARY[this.currentLang][key] || key;
    }

    async fetchOnlineTranslation(text, langCode) {
      if (!text || langCode === 'en') return text;
      const cacheKey = `sina_tr_${langCode}_${text}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0]) {
            const translated = data[0].map(part => part[0]).join('');
            if (translated) {
              localStorage.setItem(cacheKey, translated);
              return translated;
            }
          }
        }
      } catch (e) {}
      return text;
    }

    translateSubtree(rootElement, langCode) {
      if (!rootElement) return;
      const isEnglish = langCode === 'en';
      const dict = DICTIONARY[langCode] || {};

      this.isTranslating = true;
      try {
        const walker = document.createTreeWalker(
          rootElement,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const p = node.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              const tag = p.tagName.toLowerCase();
              if (['script', 'style', 'noscript', 'svg', 'path', 'textarea'].includes(tag)) {
                return NodeFilter.FILTER_REJECT;
              }
              if (p.closest('.lang-selector-wrap') || p.closest('.drawer-lang-section')) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        let n;
        while ((n = walker.nextNode())) {
          this.translateNode(n, langCode, isEnglish, dict);
        }

        // Placeholders
        rootElement.querySelectorAll?.('input[placeholder], textarea[placeholder]').forEach(el => {
          if (!el._origPlaceholder) el._origPlaceholder = el.getAttribute('placeholder');
          const orig = el._origPlaceholder;
          if (isEnglish) {
            el.setAttribute('placeholder', orig);
          } else if (dict[orig]) {
            el.setAttribute('placeholder', dict[orig]);
          } else {
            const cached = localStorage.getItem(`sina_tr_${langCode}_${orig}`);
            if (cached) el.setAttribute('placeholder', cached);
            else {
              this.fetchOnlineTranslation(orig, langCode).then(tr => {
                if (tr && this.currentLang === langCode) el.setAttribute('placeholder', tr);
              });
            }
          }
        });

        // Select options
        rootElement.querySelectorAll?.('option').forEach(opt => {
          if (!opt._origText) opt._origText = opt.textContent.trim();
          const orig = opt._origText;
          if (isEnglish) {
            opt.textContent = orig;
          } else if (dict[orig]) {
            opt.textContent = dict[orig];
          }
        });
      } finally {
        this.isTranslating = false;
      }
    }

    translateNode(node, langCode, isEnglish, dict) {
      if (!node || !node.nodeValue) return;
      if (node._origValue === undefined) {
        node._origValue = node.nodeValue;
      }
      const orig = node._origValue;
      const trimmed = orig.trim();
      if (!trimmed || /^\d+(\.\d+)?$/.test(trimmed) || trimmed === '—' || trimmed === '₹') return;

      if (isEnglish) {
        node.nodeValue = orig;
        return;
      }

      if (dict[trimmed]) {
        node.nodeValue = orig.replace(trimmed, dict[trimmed]);
        return;
      }

      // Check phrase matches in dictionary
      for (const [enKey, trVal] of Object.entries(dict)) {
        if (enKey.length >= 4 && orig.includes(enKey)) {
          node.nodeValue = orig.replace(enKey, trVal);
          return;
        }
      }

      // Online fallback if meaningful text (letters present)
      if (/[a-zA-Z]{3,}/.test(trimmed) && trimmed.length < 120) {
        const cached = localStorage.getItem(`sina_tr_${langCode}_${trimmed}`);
        if (cached) {
          node.nodeValue = orig.replace(trimmed, cached);
        } else {
          this.fetchOnlineTranslation(trimmed, langCode).then(tr => {
            if (tr && this.currentLang === langCode) {
              node.nodeValue = orig.replace(trimmed, tr);
            }
          });
        }
      }
    }

    applyLanguage(langCode) {
      this.currentLang = langCode;
      localStorage.setItem(STORAGE_KEY, langCode);

      // Update UI button labels
      const langLabel = document.getElementById('current-lang-label');
      if (langLabel) langLabel.textContent = langCode.toUpperCase();

      document.querySelectorAll('.lang-option').forEach(opt => {
        if (opt.getAttribute('data-lang') === langCode) opt.classList.add('active');
        else opt.classList.remove('active');
      });

      document.querySelectorAll('.drawer-lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === langCode) btn.classList.add('active');
        else btn.classList.remove('active');
      });

      // Translate entire page DOM
      this.translateSubtree(document.body, langCode);

      // Notify any listeners
      window.dispatchEvent(new CustomEvent('sina_lang_changed', { detail: { lang: langCode } }));
    }

    setLanguage(langCode) {
      this.applyLanguage(langCode);
    }

    startObserver() {
      if (this.observer) return;
      this.observer = new MutationObserver((mutations) => {
        if (this.isTranslating || this.currentLang === 'en') return;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.translateSubtree(node, this.currentLang);
            }
          }
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    initUI() {
      const btn = document.getElementById('lang-menu-btn');
      const dropdown = document.getElementById('lang-dropdown-menu');

      if (btn && dropdown) {
        btn.onclick = (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('active');
        };

        document.addEventListener('click', () => {
          dropdown.classList.remove('active');
        });

        const options = dropdown.querySelectorAll('.lang-option');
        options.forEach(opt => {
          opt.onclick = (e) => {
            e.stopPropagation();
            const lang = opt.getAttribute('data-lang');
            if (lang) {
              this.applyLanguage(lang);
              dropdown.classList.remove('active');
            }
          };
        });
      }

      document.querySelectorAll('.drawer-lang-btn').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          const lang = b.getAttribute('data-lang');
          if (lang) this.applyLanguage(lang);
        };
      });
    }
  }

  window.sinaTranslate = new AdminTranslateEngine();
})();
