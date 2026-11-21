/* שערי חליפין יציגים של בנק ישראל – דרך Frankfurter (חינמי, ללא מפתח, CORS פתוח)
   https://frankfurter.dev/providers/boi/
   השערים נשמרים במטמון בדפדפן ל-6 שעות; אם השירות לא זמין – משתמשים בשער האחרון שנשמר. */
(function () {
  'use strict';
  const API = 'https://api.frankfurter.dev/v2/rate';
  const CURRENCIES = ['USD', 'EUR', 'GBP'];
  const CACHE_KEY = 'bank-crm-fx';
  const TTL = 6 * 60 * 60 * 1000;

  const FX = {
    rates: {},          // { USD: { rate: 3.7, date: '2026-11-20' }, ... }  (₪ ליחידת מטבע)
    status: 'idle',     // idle | loading | live | cached | error
    fetchedAt: null,
    source: 'בנק ישראל',
    /** המרה לשקלים. מחזיר null אם אין שער למטבע. */
    toILS(amount, cur) {
      if (!cur || cur === 'ILS') return Number(amount) || 0;
      const r = this.rates[cur];
      return r ? (Number(amount) || 0) * r.rate : null;
    },
    fromILS(amount, cur) {
      if (cur === 'ILS') return amount;
      const r = this.rates[cur];
      return r ? amount / r.rate : null;
    },
    has(cur) { return cur === 'ILS' || !!this.rates[cur]; }
  };

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: FX.rates, fetchedAt: FX.fetchedAt })); } catch (e) { /* ignore */ }
  }

  async function fetchOne(cur) {
    // קודם שער בנק ישראל; אם אינו זמין – השער המשולב של Frankfurter
    for (const q of ['?providers=boi', '']) {
      try {
        const res = await fetch(`${API}/${cur}/ILS${q}`, { cache: 'no-store' });
        if (!res.ok) continue;
        const d = await res.json();
        if (d && typeof d.rate === 'number' && d.rate > 0) return { rate: d.rate, date: d.date, boi: !!q };
      } catch (e) { /* נסה את האפשרות הבאה */ }
    }
    return null;
  }

  /** טוען שערים. onUpdate נקרא כשמגיעים שערים חדשים מהרשת. */
  FX.load = async function (onUpdate) {
    const cached = readCache();
    if (cached && cached.rates) {
      FX.rates = cached.rates; FX.fetchedAt = cached.fetchedAt; FX.status = 'cached';
      if (Date.now() - cached.fetchedAt < TTL) { FX.status = 'live'; return; }
    }
    if (FX.status !== 'cached') FX.status = 'loading';
    const results = await Promise.all(CURRENCIES.map(fetchOne));
    const fresh = {};
    results.forEach((r, i) => { if (r) fresh[CURRENCIES[i]] = r; });
    if (Object.keys(fresh).length) {
      FX.rates = Object.assign({}, FX.rates, fresh);
      FX.fetchedAt = Date.now(); FX.status = 'live';
      FX.source = Object.values(fresh).every(r => r.boi) ? 'בנק ישראל' : 'בנק ישראל / Frankfurter';
      writeCache();
    } else if (FX.status !== 'cached') {
      FX.status = 'error';
    }
    if (onUpdate) onUpdate();
  };

  FX.CURRENCIES = CURRENCIES;
  window.FX = FX;
})();
