/* ניהול לקוחות בנק – אפליקציית CRUD צד-לקוח */
(function () {
  'use strict';

  const S = window.SCHEMA;
  const STORE = 'bank-crm-v3';
  let db;

  /* ---------- Storage ---------- */
  function load() {
    try { const raw = localStorage.getItem(STORE); if (raw) db = JSON.parse(raw); } catch (e) { db = null; }
    if (!db || !S.entities.every(e => Array.isArray(db[e.key]))) db = JSON.parse(JSON.stringify(window.SEED));
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* ignore */ } }

  /* ---------- Helpers ---------- */
  const $ = s => document.querySelector(s);
  const ent = k => S.entities.find(e => e.key === k);
  const pkOf = (e, r) => e.pk.map(k => String(r[k])).join('|');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NF = {};
  const money = (n, cur = 'ILS') => (NF[cur] || (NF[cur] = new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur, maximumFractionDigits: 0 }))).format(Number(n) || 0);
  const FXN = window.FX || { toILS: (n, c) => (!c || c === 'ILS' ? n : null), rates: {}, status: 'error', fromILS: () => null };
  const fdate = d => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? esc(d) : x.toLocaleDateString('he-IL'); };
  const findBy = (key, id) => { const e = ent(key); return db[key].find(r => pkOf(e, r) === String(id)); };
  const titleOf = (key, r) => r ? ent(key).title(r, db) : '—';
  const href = (key, r) => `#/e/${key}/${encodeURIComponent(pkOf(ent(key), r))}`;
  const initials = s => String(s || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  const PEOPLE = ['customers'];
  const TAGS = { 'פעיל': 'ok', 'סגור': 'bad', 'מוקפא': 'mid', 'הפקדה': 'ok', 'משיכה': 'bad' };
  const balanceOf = a => ent('accounts').computed[0].fn(a, db);
  const curOf = a => (a && a.currency) || 'ILS';
  const optLabel = (f, v) => (f.optionLabels && f.optionLabels[v]) || v;
  // התאמת מין ומספר בעברית
  const NEW = e => `${e.single} ${e.fem ? 'חדשה' : 'חדש'}`;
  const ADDED = e => `${e.single} ${e.fem ? 'נוספה' : 'נוסף'} בהצלחה`;
  const DELETED = e => `${e.single} ${e.fem ? 'נמחקה' : 'נמחק'}`;
  const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
  const tile = (e, size) => `<span class="tile" style="--c:${e.color}">${ICON(e.key, size || 20)}</span>`;

  function fmt(f, r) {
    const v = r[f.key];
    switch (f.type) {
      case 'money': return `<span class="num">${money(v, f.currency ? f.currency(r, db) : 'ILS')}</span>`;
      case 'date': return `<span class="num">${fdate(v)}</span>`;
      case 'percent': return v === '' || v == null ? '' : `<span class="num">${esc(v)}%</span>`;
      case 'select': return `<span class="tag ${TAGS[v] || ''}">${esc(optLabel(f, v))}</span>`;
      case 'ref': {
        if (v === '' || v == null) return '<span class="muted">—</span>';
        const t = findBy(f.ref, v);
        return t ? `<a class="chip" style="--c:${ent(f.ref).color}" href="${href(f.ref, t)}">${esc(titleOf(f.ref, t))}</a>` : `<span class="muted">${esc(v)}</span>`;
      }
      case 'tel': return `<span class="ltr num">${esc(v)}</span>`;
      default: return esc(v);
    }
  }
  function cell(e, f, r) {
    if (f.key === 'fullName' && PEOPLE.includes(e.key))
      return `<span class="cell-main"><span class="avatar" style="--c:${e.color}">${esc(initials(r.fullName))}</span>${esc(r.fullName)}</span>`;
    if (e.pk[0] === f.key && e.pk.length === 1 && f.type !== 'ref') return `<span class="num" style="font-weight:600">${esc(r[f.key])}</span>`;
    return fmt(f, r);
  }
  function fmtComputed(c, r) {
    const v = c.fn(r, db);
    return c.type === 'money' ? `<span class="num ${v < 0 ? 'neg' : ''}" style="font-weight:600">${money(v, c.currency ? c.currency(r, db) : 'ILS')}</span>` : esc(v);
  }
  function reverseRefs(key) {
    const out = [];
    S.entities.forEach(e => e.fields.forEach(f => { if (f.type === 'ref' && f.ref === key) out.push({ e, f }); }));
    return out;
  }
  const related = (key, id) => reverseRefs(key).map(({ e, f }) => ({ e, f, rows: db[e.key].filter(r => String(r[f.key]) === String(id)) }));


  /* ---------- Shell ---------- */
  function shell(active, crumbs) {
    const counts = {}; S.entities.forEach(e => { counts[e.key] = db[e.key].length; });
    renderSidebar(active, '', counts);
    $('#crumbs').innerHTML = crumbs.map((c, i) => i < crumbs.length - 1
      ? `<a href="${c[1]}">${esc(c[0])}</a>${ICON('back', 14)}` : `<b>${esc(c[0])}</b>`).join('');
  }

  let toastT;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, 3400);
  }

  /* ---------- שערי חליפין (אינטגרציה: בנק ישראל דרך Frankfurter) ---------- */
  const CUR_META = { USD: ['$', 'דולר ארה"ב'], EUR: ['€', 'אירו'], GBP: ['£', 'לירה שטרלינג'] };
  function fxCard(fxBal) {
    const st = FXN.status;
    const rows = (FXN.CURRENCIES || ['USD', 'EUR', 'GBP']).map(c => {
      const r = FXN.rates[c], [sym, name] = CUR_META[c];
      return `<div class="fx-row"><span class="fx-sym">${sym}</span>
        <span><div class="fx-name">${name}</div><div class="psub ltr">${c} / ILS</div></span>
        <span class="fx-rate num">${r ? '₪' + r.rate.toFixed(3) : (st === 'loading' ? '<span class="skel"></span>' : '—')}</span></div>`;
    }).join('');
    const dates = Object.values(FXN.rates).map(r => r.date).filter(Boolean).sort();
    const asOf = dates.length ? fdate(dates[dates.length - 1]) : '';
    const exp = Object.keys(fxBal).map(c => `<span class="num">${money(fxBal[c], c)}</span>`).join(' · ');
    const msg = st === 'error' ? 'לא ניתן לטעון שערים כרגע. יתרות במט"ח מוצגות במטבע המקור.'
      : st === 'loading' ? 'טוען שערים...'
      : `שער יציג ליום ${asOf}${st === 'cached' ? ' (שער אחרון שנשמר)' : ''}`;
    return `<div class="card fx-card"><div class="card-head"><h2>שערי חליפין יציגים</h2>
        ${st === 'loading' ? '' : `<span class="live ${st === 'live' ? 'on' : 'off'}" role="img" title="${st === 'live' ? 'מחובר – שערים עדכניים' : 'אין חיבור לשירות השערים'}" aria-label="${st === 'live' ? 'מחובר' : 'אין חיבור'}"></span>`}</div>
      <div class="fx-list">${rows}</div>
      ${exp ? `<div class="fx-exp"><span class="muted">יתרות במט"ח:</span> ${exp}</div>` : ''}
      <div class="fx-foot">${esc(msg)}<br><span class="faint">מקור: <a href="https://frankfurter.dev/providers/boi/" target="_blank" rel="noopener">${esc(FXN.source || 'בנק ישראל')}</a></span></div></div>`;
  }

  /* =====================================================================
     רכיבים חזותיים: גרף יתרה לאורך זמן, כרטיסי בנק, ברכה
     ===================================================================== */
  const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };
  const CHARTS = {};          // id -> { points, cur, color }
  let chartSeq = 0;
  /** סדרת יתרה מצטברת לפי תאריך. accounts – רשימת חשבונות; toCur – 'ILS' (המרה) או מטבע החשבון */
  function balanceSeries(accounts, convert) {
    const nos = new Set(accounts.map(a => String(a.accountNo)));
    const byNo = {}; accounts.forEach(a => { byNo[a.accountNo] = a; });
    const txs = db.transactions.filter(t => nos.has(String(t.accountNo)) && t.date).sort((a, b) => a.date.localeCompare(b.date) || a.txnId - b.txnId);
    let total = 0, skipped = 0; const pts = [];
    txs.forEach(t => {
      let v = (t.type === 'הפקדה' ? 1 : -1) * Number(t.amount || 0);
      if (convert) { const c = FXN.toILS(v, curOf(byNo[t.accountNo])); if (c == null) { skipped++; return; } v = c; }
      total += v;
      if (pts.length && pts[pts.length - 1].d === t.date) pts[pts.length - 1].v = total; else pts.push({ d: t.date, v: total });
    });
    const today = new Date().toISOString().slice(0, 10);
    if (pts.length && pts[pts.length - 1].d < today) pts.push({ d: today, v: total, now: true });
    return { pts, skipped };
  }
  function chartBox(points, cur, color, height) {
    const id = 'ch' + (++chartSeq);
    CHARTS[id] = { points, cur, color, height: height || 220 };
    return `<div class="chart" id="${id}" style="height:${height || 220}px"><div class="ch-tip" hidden></div></div>`;
  }
  const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
  const shortMoney = (n, cur) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur || 'ILS', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  function drawCharts() {
    document.querySelectorAll('.chart').forEach(el => {
      const c = CHARTS[el.id]; if (!c) return;
      const W = Math.max(260, el.clientWidth), H = c.height, P = { l: 58, r: 14, t: 14, b: 28 };
      const pts = c.points;
      if (pts.length < 2) { el.innerHTML = '<div class="empty" style="padding:30px">אין מספיק נתונים לגרף</div>'; return; }
      const t0 = new Date(pts[0].d).getTime(), t1 = new Date(pts[pts.length - 1].d).getTime() || t0 + 1;
      const minV = Math.min(0, ...pts.map(p => p.v)), maxV = niceMax(Math.max(...pts.map(p => p.v)));
      const X = d => P.l + (new Date(d).getTime() - t0) / Math.max(1, t1 - t0) * (W - P.l - P.r);
      const Y = v => P.t + (1 - (v - minV) / (maxV - minV || 1)) * (H - P.t - P.b);
      // קו מדרגות: היתרה נשארת קבועה עד התנועה הבאה
      let line = `M ${X(pts[0].d)} ${Y(pts[0].v)}`;
      for (let i = 1; i < pts.length; i++) line += ` H ${X(pts[i].d)} V ${Y(pts[i].v)}`;
      const area = `${line} V ${Y(minV)} H ${X(pts[0].d)} Z`;
      const grid = [0, .25, .5, .75, 1].map(f => minV + f * (maxV - minV)).map(v =>
        `<line class="ch-grid" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ch-y" x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${shortMoney(v, c.cur)}</text>`).join('');
      // תוויות חודשים
      const months = []; const d0 = new Date(pts[0].d); const m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
      while (m.getTime() <= t1) { months.push(new Date(m)); m.setMonth(m.getMonth() + 1); }
      const step = Math.ceil(months.length / Math.max(1, Math.floor((W - P.l) / 70)));
      const xl = months.filter((_, i) => i % step === 0).map(dt => { const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
        return `<line class="ch-tick" x1="${X(iso)}" x2="${X(iso)}" y1="${H - P.b}" y2="${H - P.b + 4}"/><text class="ch-x" x="${X(iso)}" y="${H - 8}" text-anchor="middle">${dt.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })}</text>`; }).join('');
      const dots = pts.filter(p => !p.now).map(p => `<circle class="ch-dot" cx="${X(p.d)}" cy="${Y(p.v)}" r="4" stroke="${c.color}"/>`).join('');
      const gid = el.id + 'g';
      el.innerHTML = `<svg width="${W}" height="${H}" direction="ltr" role="img" aria-label="גרף יתרה לאורך זמן">
        <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".22"/><stop offset="1" stop-color="${c.color}" stop-opacity="0"/></linearGradient></defs>
        ${grid}<path d="${area}" fill="url(#${gid})"/><path class="ch-line" d="${line}" stroke="${c.color}"/>${dots}${xl}
        <line class="ch-cross" y1="${P.t}" y2="${H - P.b}" hidden/><circle class="ch-hot" r="6" fill="${c.color}" hidden/>
        <rect class="ch-hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent"/></svg><div class="ch-tip" hidden></div>`;
      const svg = el.querySelector('svg'), tip = el.querySelector('.ch-tip'), cross = el.querySelector('.ch-cross'), hot = el.querySelector('.ch-hot');
      const move = ev => {
        const r = svg.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        let best = pts[0]; pts.forEach(p => { if (Math.abs(X(p.d) - x) < Math.abs(X(best.d) - x)) best = p; });
        const px = X(best.d), py = Y(best.v);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.hidden = false;
        hot.setAttribute('cx', px); hot.setAttribute('cy', py); hot.hidden = false;
        tip.innerHTML = `<b>${money(best.v, c.cur)}</b><span>${best.now ? 'היום' : fdate(best.d)}</span>`;
        tip.hidden = false;
        tip.style.left = Math.min(Math.max(px, 70), W - 70) + 'px'; tip.style.top = Math.max(py - 12, 0) + 'px';
      };
      const leave = () => { tip.hidden = true; cross.hidden = true; hot.hidden = true; };
      svg.addEventListener('mousemove', move); svg.addEventListener('touchstart', move, { passive: true });
      svg.addEventListener('touchmove', move, { passive: true }); svg.addEventListener('mouseleave', leave);
    });
  }
  let rsz = 0;
  window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(drawCharts, 150); });

  const CARD_THEME = { 'עו"ש': 'blue', 'חיסכון': 'teal', 'פיקדון': 'violet', 'עסקי': 'slate' };
  function bankCard(a, opts) {
    const br = findBy('branches', a.branchId), bal = balanceOf(a), cur = curOf(a);
    const owners = db.ownerships.filter(o => String(o.accountNo) === String(a.accountNo)).map(o => findBy('customers', o.customerId)).filter(Boolean);
    return `<a class="bank-card bc-${CARD_THEME[a.type] || 'blue'}${opts && opts.big ? ' big' : ''}" href="${href('accounts', a)}">
      <div class="bc-top"><span class="bc-type">${esc(a.type)}</span>${a.status !== 'פעיל' ? `<span class="bc-status">${esc(a.status)}</span>` : ''}<span class="bc-chip"></span></div>
      <div class="bc-label">יתרה</div><div class="bc-bal ${bal < 0 ? 'neg' : ''}">${money(bal, cur)}</div>
      <div class="bc-no" dir="ltr">•••• ${esc(String(a.accountNo).slice(-4))}</div>
      <div class="bc-foot"><span>${esc(owners.map(o => o.fullName).join(', ') || 'ללא בעלים')}</span><span>${esc(br ? br.name : '')} · ${cur}</span></div></a>`;
  }
  const miniStat = (label, value, color, icon) => `<div class="mini-stat" style="--c:${color}"><span class="tile">${ICON(icon, 18)}</span><div><div class="ms-v">${value}</div><div class="ms-l">${label}</div></div></div>`;

  /* ---------- Dashboard ---------- */
  function viewHome() {
    shell('home', [['לוח בקרה', '#/']]);
    // יתרות מומרות לשקלים לפי השער היציג (חשבונות במט"ח ללא שער – לא נספרים ומסומנים)
    const balances = db.accounts.map(a => ({ a, b: FXN.toILS(balanceOf(a), curOf(a)) }));
    const missing = balances.filter(x => x.b == null);
    balances.forEach(x => { x.miss = x.b == null; if (x.miss) x.b = 0; });
    const totalBal = balances.reduce((s, x) => s + x.b, 0);
    const fxBal = {};
    db.accounts.filter(a => curOf(a) !== 'ILS').forEach(a => { fxBal[curOf(a)] = (fxBal[curOf(a)] || 0) + balanceOf(a); });
    const usd = FXN.fromILS(totalBal, 'USD');
    const totalLoans = db.loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const active = db.accounts.filter(a => a.status === 'פעיל').length;
    const avgRate = db.loans.length ? db.loans.reduce((s, l) => s + Number(l.rate || 0) * Number(l.amount || 0), 0) / (totalLoans || 1) : 0;

    // יתרות לפי סוג חשבון
    const accTypes = ent('accounts').fields.find(f => f.key === 'type').options
      .map(t => { const rows = balances.filter(x => x.a.type === t); return { t, v: rows.reduce((s, x) => s + x.b, 0), n: rows.length, miss: rows.filter(x => x.miss).length }; });
    // הלוואות לפי מטרה
    const purposes = ent('loans').fields.find(f => f.key === 'purpose').options
      .map(t => ({ t, v: db.loans.filter(l => l.purpose === t).reduce((s, l) => s + Number(l.amount || 0), 0), n: db.loans.filter(l => l.purpose === t).length }));
    const bars = (rows, color, unit) => {
      const max = Math.max(1, ...rows.map(r => Math.abs(r.v)));
      return `<div class="bars">${rows.map(r => `<div class="bar-row" title="${esc(r.t)}: ${r.miss ? 'יש חשבונות במט"ח ללא שער חליפין' : money(r.v)} · ${r.n} ${unit}">
        <span class="name">${esc(r.t)}</span>
        <span class="bar-track"><span class="bar-fill" style="--c:${color};width:${Math.max(0, r.v) / max * 100}%"></span></span>
        <span class="v">${r.miss && r.miss === r.n ? '<span class="muted" style="font-weight:500">אין שער</span>' : money(r.v) + (r.miss ? '*' : '')}</span></div>`).join('')}</div>`;
    };

    // לקוחות מובילים לפי יתרה בחשבונות שבבעלותם
    const top = db.customers.map(c => {
      const own = db.ownerships.filter(o => String(o.customerId) === String(c.customerId));
      const sum = own.reduce((s, o) => { const a = findBy('accounts', o.accountNo); return s + (a ? (FXN.toILS(balanceOf(a), curOf(a)) || 0) : 0); }, 0);
      return { c, n: own.length, sum };
    }).sort((x, y) => y.sum - x.sum).slice(0, 5);

    const accOf = t => findBy('accounts', t.accountNo);
    const recent = db.transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.txnId - a.txnId).slice(0, 6);
    const tx = ent('transactions');
    const C = ent('customers'), A = ent('accounts'), Lo = ent('loans');
    const series = balanceSeries(db.accounts, true);

    $('#view').innerHTML = `
      <section class="welcome">
        <div class="wl-text"><div class="wl-greet">${greeting()}</div>
          <h1>לוח בקרה</h1>
          <p>תמונת מצב של הלקוחות, החשבונות וההלוואות בבנק.</p></div>
        <div class="qa">
          <button class="qa-btn" type="button" id="qAdd"><span class="tile" style="--c:${C.color}">${ICON('customers', 20)}</span>לקוח חדש</button>
          <button class="qa-btn" type="button" id="qAcc"><span class="tile" style="--c:${A.color}">${ICON('accounts', 20)}</span>פתיחת חשבון</button>
          <button class="qa-btn" type="button" id="qTx"><span class="tile" style="--c:${tx.color}">${ICON('plus', 20)}</span>תנועה חדשה</button>
          <button class="qa-btn" type="button" id="qXfer"><span class="tile" style="--c:#6366f1">${ICON('transactions', 20)}</span>העברה בין חשבונות</button>
        </div>
        <div class="wl-illus">${window.ILLUS ? ILLUS.bank : ''}</div>
        <svg class="wl-art" viewBox="0 0 200 200" aria-hidden="true"><circle cx="160" cy="40" r="90" /><circle cx="40" cy="190" r="70" /></svg>
      </section>

      <div class="kpis">
        <div class="kpi hero"><div class="top"><span class="lbl">סך יתרות בחשבונות</span><span class="tile">${ICON('accounts', 20)}</span></div>
          <div class="val">${money(totalBal)}</div>
          <div class="foot">${missing.length ? `${missing.length} חשבונות במט"ח לא הומרו – אין שער זמין` :
            `ב-${db.accounts.length} חשבונות${Object.keys(fxBal).length ? ' · כולל מט"ח לפי שער יציג' : ''}${usd != null ? ` · ≈ ${money(usd, 'USD')}` : ''}`}</div></div>
        <a class="kpi hero k-rose" href="#/e/loans"><div class="top"><span class="lbl">תיק ההלוואות</span>${tile(Lo)}</div>
          <div class="val">${money(totalLoans)}</div><div class="foot">${db.loans.length} הלוואות · ריבית משוקללת ${avgRate.toFixed(1)}%</div></a>
        <a class="kpi hero k-sky" href="#/e/customers"><div class="top"><span class="lbl">לקוחות</span>${tile(C)}</div>
          <div class="val">${db.customers.length}</div><div class="foot">ב-${db.branches.length} סניפים</div></a>
        <a class="kpi hero k-teal" href="#/e/accounts"><div class="top"><span class="lbl">חשבונות פעילים</span>${tile(A)}</div>
          <div class="val">${active}<span class="muted" style="font-size:18px;font-weight:500"> / ${db.accounts.length}</span></div>
          <div class="foot">${db.ownerships.length} קשרי בעלות</div></a>
      </div>

      <div class="grid c21">
        <div class="card"><div class="card-head"><h2>סך היתרות לאורך זמן</h2><span class="sub">${series.skipped ? 'ללא תנועות במט"ח (אין שער)' : 'בשקלים, כולל מט"ח לפי שער יציג'}</span></div>
          ${chartBox(series.pts, 'ILS', '#2563eb', 230)}</div>
        ${fxCard(fxBal)}
      </div>
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>יתרות לפי סוג חשבון</h2><a class="more" href="#/e/accounts">לכל החשבונות</a></div>
          ${bars(accTypes, '#14b8a6', 'חשבונות')}</div>
        <div class="card"><div class="card-head"><h2>הלוואות לפי מטרה</h2><a class="more" href="#/e/loans">לכל ההלוואות</a></div>
          ${bars(purposes, '#f43f5e', 'הלוואות')}</div>
      </div>

      <div class="grid c32">
        <div class="card flush"><div class="card-head" style="padding:22px 24px 4px"><h2>תנועות אחרונות</h2><a class="more" href="#/e/transactions">לכל התנועות</a></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>תאריך</th><th>חשבון</th><th>תיאור</th><th>סוג</th><th>סכום</th></tr></thead><tbody>
          ${recent.map(t => `<tr data-go="${href('transactions', t)}"><td>${fmt(tx.fields[2], t)}</td><td>${fmt(tx.fields[1], t)}</td>
            <td class="muted">${esc(t.description)}</td><td>${fmt(tx.fields[3], t)}</td>
            <td class="num ${t.type === 'הפקדה' ? 'pos' : 'neg'}" style="font-weight:600">${t.type === 'הפקדה' ? '+' : '−'}${money(t.amount, curOf(accOf(t)))}</td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>לקוחות מובילים</h2><span class="sub">לפי יתרה בחשבונות</span></div>
          <div class="plist">${top.map(x => `<a class="prow" href="${href('customers', x.c)}">
            <span class="avatar" style="--c:${C.color}">${esc(initials(x.c.fullName))}</span>
            <span><div class="pname">${esc(x.c.fullName)}</div><div class="psub">${plural(x.n, 'חשבון אחד', 'חשבונות')}</div></span>
            <span class="amt">${money(x.sum)}</span></a>`).join('')}</div></div>
      </div>

      <div class="card"><div class="card-head"><h2>ישויות במערכת</h2><a class="more" href="erd.html">לתרשים ה-ERD</a></div>
        <div class="ent-strip">${S.entities.map(e => `<a class="ent-chip" href="#/e/${e.key}" style="--c:${e.color}">
          ${tile(e, 18)}<b class="num">${db[e.key].length}</b><span>${esc(e.label)}</span></a>`).join('')}</div></div>

      <div class="foot-note">הנתונים נשמרים בדפדפן בלבד (localStorage) · כל הנתונים פיקטיביים
        <button class="btn sm ghost" id="resetBtn" type="button">איפוס לנתוני הדגמה</button></div>`;
    $('#qAdd').addEventListener('click', () => openForm('customers'));
    $('#qAcc').addEventListener('click', () => openForm('accounts'));
    $('#qTx').addEventListener('click', () => openForm('transactions'));
    $('#qXfer').addEventListener('click', () => { location.hash = '#/transfer'; });
    drawCharts();
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('לאפס את כל הנתונים לנתוני ההדגמה?')) return;
      db = JSON.parse(JSON.stringify(window.SEED)); save(); toast('הנתונים אופסו'); route();
    });
  }

  /* ---------- List ---------- */
  const searchState = {};
  function viewList(key) {
    const e = ent(key);
    if (!e) return viewHome();
    shell(key, [['לוח בקרה', '#/'], [e.label, `#/e/${key}`]]);
    $('#view').innerHTML = `
      <div class="page-head with-art" style="--c:${e.color}">
        <div class="ph-art">${window.ILLUS && ILLUS[key] || ''}</div>
        <div><h1>${esc(e.label)} <span class="count-pill" style="vertical-align:middle">${db[key].length}</span></h1>
          <p>${esc(e.desc)}</p></div>
        <div class="actions">
          <label class="search">${ICON('search', 17)}<input id="q" type="search" placeholder="חיפוש ב${esc(e.label)}..." value="${esc(searchState[key] || '')}" aria-label="חיפוש"></label>
          <button class="btn primary" id="addBtn" type="button">${ICON('plus', 17)} ${esc(NEW(e))}</button>
        </div>
      </div>
      <div class="card flush"><div class="table-wrap" id="tbl"></div></div>`;

    const draw = () => {
      const q = (searchState[key] || '').trim().toLowerCase();
      const rows = db[key].filter(r => !q || e.fields.some(f => {
        const t = f.type === 'ref' ? findBy(f.ref, r[f.key]) : null;
        return String(t ? titleOf(f.ref, t) : (r[f.key] == null ? '' : optLabel(f, r[f.key]))).toLowerCase().includes(q);
      }));
      const comp = e.computed || [];
      $('#tbl').innerHTML = rows.length ? `
        <table class="data"><thead><tr>
          ${e.fields.map(f => `<th>${esc(f.label)}</th>`).join('')}
          ${comp.map(c => `<th title="תכונה מחושבת מהתנועות">${esc(c.label)} · מחושב</th>`).join('')}
          <th></th></tr></thead><tbody>
          ${rows.map(r => `<tr data-go="${href(key, r)}">
            ${e.fields.map(f => `<td>${cell(e, f, r)}</td>`).join('')}
            ${comp.map(c => `<td>${fmtComputed(c, r)}</td>`).join('')}
            <td class="actions">
              <button class="icon-btn" data-edit="${esc(pkOf(e, r))}" title="עריכה" aria-label="עריכה">${ICON('edit', 16)}</button>
              <button class="icon-btn del" data-del="${esc(pkOf(e, r))}" title="מחיקה" aria-label="מחיקה">${ICON('trash', 16)}</button>
            </td></tr>`).join('')}
          </tbody></table>`
        : `<div class="empty">${window.ILLUS ? ILLUS.empty : ''}<div class="empty-t">${q ? 'לא נמצאו רשומות תואמות לחיפוש' : 'אין עדיין רשומות'}</div>${q ? '' : `<div class="muted">לחצו על "${esc(NEW(e))}" כדי להוסיף</div>`}</div>`;
    };
    draw();
    $('#q').addEventListener('input', ev => { searchState[key] = ev.target.value; draw(); });
    $('#addBtn').addEventListener('click', () => openForm(key));
  }

  /* ---------- Detail ---------- */
  function viewDetail(key, id) {
    const e = ent(key);
    const r = e && findBy(key, id);
    if (!r) { location.hash = `#/e/${key}`; return; }
    const title = titleOf(key, r);
    shell(key, [['לוח בקרה', '#/'], [e.label, `#/e/${key}`], [title, '']]);

    const relSections = related(key, id).map(({ e: re, f, rows }) => {
      const cols = re.fields.filter(x => x.key !== f.key);
      const name = re.label;
      return `<div class="card flush">
        <div class="card-head" style="padding:20px 24px 6px">${tile(re, 18)}<h2>${esc(name)}</h2>
          <span class="count-pill">${rows.length}</span>
</div>
        ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr>
          ${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}${(re.computed || []).map(c => `<th>${esc(c.label)}</th>`).join('')}
          </tr></thead><tbody>
          ${rows.map(x => `<tr data-go="${href(re.key, x)}">${cols.map(c => `<td>${cell(re, c, x)}</td>`).join('')}
            ${(re.computed || []).map(c => `<td>${fmtComputed(c, x)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>` : '<div class="empty" style="padding:20px">אין רשומות קשורות</div>'}
      </div>`;
    }).join('');

    const hero = PEOPLE.includes(key)
      ? `<span class="avatar" style="--c:${e.color}">${esc(initials(r.fullName))}</span>` : tile(e, 26);
    $('#view').innerHTML = `
      <div class="page-head">
        <div class="detail-hero">${hero}<div>
          <div class="eyebrow" style="--c:${e.color};margin:0">${esc(e.single)}</div>
          <h1>${esc(title)}</h1></div></div>
        <div class="actions">
          <button class="btn" id="edBtn" type="button">${ICON('edit', 16)} עריכה</button>
          <button class="btn danger" id="dlBtn" type="button">${ICON('trash', 16)} מחיקה</button>
        </div>
      </div>
      ${visualFor(key, r)}
      <div class="card"><div class="card-head"><h2>פרטים</h2></div>
        <div class="attr-grid">
          ${e.fields.map(f => `<div class="attr"><div class="k">${esc(f.label)}</div><div class="v">${fmt(f, r) || '<span class="muted">—</span>'}</div></div>`).join('')}
          ${(e.computed || []).map(c => `<div class="attr"><div class="k">${esc(c.label)} · מחושב</div><div class="v">${fmtComputed(c, r)}</div></div>`).join('')}
        </div></div>
      ${relSections}`;
    $('#edBtn').addEventListener('click', () => openForm(key, r));
    $('#dlBtn').addEventListener('click', () => { if (remove(key, id)) location.hash = `#/e/${key}`; });
    drawCharts();
  }

  /** אזור חזותי בראש עמוד רשומה */
  function visualFor(key, r) {
    const toIls = a => FXN.toILS(balanceOf(a), curOf(a));
    if (key === 'customers') {
      const accs = db.ownerships.filter(o => String(o.customerId) === String(r.customerId)).map(o => findBy('accounts', o.accountNo)).filter(Boolean);
      const loans = db.loans.filter(l => String(l.customerId) === String(r.customerId));
      const tot = accs.reduce((s, a) => s + (toIls(a) || 0), 0);
      return `<div class="mini-stats">
          ${miniStat('סך יתרות', money(tot), '#2563eb', 'accounts')}
          ${miniStat('חשבונות', accs.length, ent('accounts').color, 'accounts')}
          ${miniStat('הלוואות', loans.length ? money(loans.reduce((s, l) => s + Number(l.amount || 0), 0)) : 'אין', ent('loans').color, 'loans')}
        </div>
        ${accs.length ? `<div class="card"><div class="card-head"><h2>החשבונות של ${esc(r.fullName)}</h2></div><div class="cards-row">${accs.map(a => bankCard(a)).join('')}</div></div>` : ''}`;
    }
    if (key === 'accounts') {
      const s = balanceSeries([r], false);
      return `<div class="grid c12">
          <div class="bc-wrap">${bankCard(r, { big: true })}</div>
          <div class="card"><div class="card-head"><h2>יתרה לאורך זמן</h2><span class="sub">${curOf(r)}</span></div>${chartBox(s.pts, curOf(r), '#14b8a6', 190)}</div>
        </div>`;
    }
    if (key === 'branches') {
      const custs = db.customers.filter(c => String(c.branchId) === String(r.branchId));
      const accs = db.accounts.filter(a => String(a.branchId) === String(r.branchId));
      const tot = accs.reduce((s, a) => s + (toIls(a) || 0), 0);
      return `<div class="mini-stats">
          ${miniStat('לקוחות', custs.length, ent('customers').color, 'customers')}
          ${miniStat('חשבונות', accs.length, ent('accounts').color, 'accounts')}
          ${miniStat('סך יתרות בסניף', money(tot), '#2563eb', 'branches')}
        </div>`;
    }
    return '';
  }

  /* השתתפות חובה (1,N): בכל סניף לפחות חשבון אחד */
  const lastAccountInBranch = acc => db.accounts.filter(x => String(x.branchId) === String(acc.branchId)).length === 1;

  /* ---------- Delete (שלמות התייחסות) ---------- */
  function remove(key, id) {
    const e = ent(key);
    const r = findBy(key, id);
    if (!r) return false;
    const blockers = related(key, id).filter(x => x.rows.length);
    if (blockers.length) {
      toast(`לא ניתן למחוק – קיימות רשומות קשורות (${blockers.map(b => `${b.e.label}: ${b.rows.length}`).join(', ')})`, true);
      return false;
    }
    if (key === 'transactions' && r.transferId) {
      // תנועה שהיא צד של העברה – מוחקים את שני הצדדים יחד כדי שהיתרות יישארו מאוזנות
      if (!confirm('התנועה היא חלק מהעברה בין חשבונות. למחוק את ההעברה (שתי התנועות)?')) return false;
      db.transactions = db.transactions.filter(x => x.transferId !== r.transferId);
      save(); toast('ההעברה נמחקה');
      if (!location.hash.includes(`/e/${key}/`)) route();
      return true;
    }
    if (key === 'accounts' && lastAccountInBranch(r)) {
      toast('לא ניתן למחוק – זה החשבון היחיד בסניף, ובכל סניף חייב להיות לפחות חשבון אחד', true);
      return false;
    }
    if (!confirm(`למחוק את "${titleOf(key, r)}"?`)) return false;
    db[key] = db[key].filter(x => pkOf(e, x) !== String(id));
    save(); toast(DELETED(e));
    if (!location.hash.includes(`/e/${key}/`)) route();
    return true;
  }

  /* =====================================================================
     מנגנון בדיקת תקינות הנתונים בטופס – בזמן הקלדה ובשמירה
     ===================================================================== */
  const TODAY = () => new Date().toISOString().slice(0, 10);

  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00'));

  /** בודק רשומה אחת. מחזיר אובייקט { שדה: הודעה } ; המפתח _form = שגיאה כללית */
  function validateRecord(key, data, rec) {
    const e = ent(key), errs = {};
    const err = (k, m) => { if (!errs[k]) errs[k] = m; };
    e.fields.forEach(f => {
      const v = data[f.key];
      if (v === '' || v == null) { if (f.required) err(f.key, 'שדה חובה'); return; }
      if (NUMERIC.includes(f.type)) {
        if (typeof v !== 'number' || isNaN(v)) return err(f.key, f.type === 'percent' ? 'יש להזין מספר, לדוגמה 4.5' : 'יש להזין מספר');
        if (f.type === 'number' && !Number.isInteger(v)) return err(f.key, 'יש להזין מספר שלם');
        if (f.min != null && v < f.min) return err(f.key, `הערך המינימלי הוא ${f.min}`);
        if (f.max != null && v > f.max) return err(f.key, `הערך המקסימלי הוא ${f.max}`);
      }
      if (f.pattern && !new RegExp(f.pattern).test(String(v))) return err(f.key, `פורמט לא תקין${f.hint ? ` (${f.hint})` : ''}`);
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return err(f.key, 'כתובת דוא"ל לא תקינה');
      if (f.type === 'date') {
        if (!isDate(v)) return err(f.key, 'תאריך לא תקין');
        if (v < '1950-01-01') return err(f.key, 'תאריך מוקדם מדי');
        if (f.noFuture && v > TODAY()) return err(f.key, 'התאריך לא יכול להיות עתידי');
      }
      if (f.type === 'select' && !f.options.includes(v)) return err(f.key, 'ערך שאינו ברשימה');
      if (f.type === 'ref' && !findBy(f.ref, v)) return err(f.key, `${ent(f.ref).single} לא קיים במערכת (מפתח זר יתום)`);
    });
    businessRules(key, data, rec, err);
    const newPk = pkOf(e, data), oldPk = rec ? pkOf(e, rec) : null;
    if (e.pk.every(k => data[k] !== '' && data[k] != null) && newPk !== oldPk && db[key].some(r => pkOf(e, r) === newPk)) {
      errs._form = e.pk.length > 1 ? 'צירוף זה כבר קיים – מפתח ראשי משולב חייב להיות ייחודי'
        : `${e.fields.find(f => f.key === e.pk[0]).label} כבר קיים – מפתח ראשי חייב להיות ייחודי`;
      if (e.pk.length === 1) err(e.pk[0], 'ערך זה כבר קיים');
    }
    return errs;
  }

  /* כללים עסקיים (בין שדות ובין טבלאות) */
  function businessRules(key, data, rec, err) {
    const acc = data.accountNo != null && data.accountNo !== '' ? findBy('accounts', data.accountNo) : null;
    if (key === 'transactions' && acc) {
      const isNew = !rec || String(rec.accountNo) !== String(data.accountNo) || rec.amount !== data.amount || rec.type !== data.type;
      if (acc.status === 'סגור' && isNew) err('accountNo', 'לא ניתן לבצע תנועה בחשבון סגור');
      if (data.date && acc.openDate && data.date < acc.openDate) err('date', `התאריך מוקדם מפתיחת החשבון (${fdate(acc.openDate)})`);
      if (data.type === 'משיכה' && typeof data.amount === 'number' && acc.type !== 'עו"ש') {
        const others = db.transactions.filter(t => String(t.accountNo) === String(acc.accountNo) && t !== rec)
          .reduce((s, t) => s + (t.type === 'הפקדה' ? 1 : -1) * Number(t.amount || 0), 0);
        if (others - data.amount < 0) err('amount', `משיכה גבוהה מהיתרה (${money(others, curOf(acc))}). משיכת יתר מותרת רק בעו"ש`);
      }
    }
    if (key === 'ownerships' && acc && data.since && acc.openDate && data.since < acc.openDate)
      err('since', `התאריך מוקדם מפתיחת החשבון (${fdate(acc.openDate)})`);
    if (key === 'accounts' && rec && String(rec.branchId) !== String(data.branchId) && lastAccountInBranch(rec))
      err('branchId', 'זה החשבון היחיד בסניף – בכל סניף חייב להיות לפחות חשבון אחד');
    if (key === 'accounts' && rec && rec.currency !== data.currency &&
        db.transactions.some(t => String(t.accountNo) === String(rec.accountNo)))
      err('currency', 'לא ניתן לשנות מטבע לחשבון שיש בו תנועות');
  }

  /* ---------- Form ---------- */
  let formCtx = null;
  const NUMERIC = ['number', 'money', 'percent'];
  const nextId = (key, field) => db[key].reduce((m, r) => Math.max(m, Number(r[field]) || 0), 0) + 1;
  function inputFor(e, f, rec, isEdit) {
    const v = rec ? rec[f.key] : (f.auto ? nextId(e.key, f.key) : '');
    const lock = isEdit && (e.pk.includes(f.key) || (rec && rec.transferId && ['accountNo', 'type', 'amount'].includes(f.key)));
    const id = `f_${f.key}`;
    let ctl;
    if (f.type === 'select') {
      const opts = f.options.concat(e.key === 'transactions' && f.key === 'type' && !rec ? [XFER] : []);
      ctl = `<select id="${id}" name="${f.key}" ${lock ? 'disabled' : ''}><option value="">בחירה...</option>
        ${opts.map(o => `<option value="${esc(o)}" ${String(v) === o ? 'selected' : ''}>${esc(o === XFER ? 'העברה בין חשבונות' : optLabel(f, o))}</option>`).join('')}</select>`;
    } else if (f.type === 'ref') {
      const te = ent(f.ref);
      let opts = db[f.ref];
      if (f.ref === e.key && rec) opts = opts.filter(o => pkOf(te, o) !== pkOf(e, rec));
      ctl = `<select id="${id}" name="${f.key}" ${lock ? 'disabled' : ''}>
        <option value="">${f.required ? 'בחירה...' : '— ללא —'}</option>
        ${opts.map(o => { const k = pkOf(te, o); return `<option value="${esc(k)}" ${String(v) === k ? 'selected' : ''}>${esc(titleOf(f.ref, o))}</option>`; }).join('')}</select>`;
    } else {
      const numeric = NUMERIC.includes(f.type);
      const t = { date: 'date', email: 'email', tel: 'tel' }[f.type] || 'text';
      const im = numeric ? `inputmode="${f.type === 'number' ? 'numeric' : 'decimal'}" autocomplete="off"` : (f.pattern && /\\d/.test(f.pattern) ? 'inputmode="numeric"' : '');
      const ltr = numeric || t === 'tel' || t === 'email' ? 'dir="ltr" style="text-align:right"' : '';
      const ph = f.type === 'percent' ? 'placeholder="לדוגמה 4.5"' : f.type === 'money' ? 'placeholder="לדוגמה 50,000"' : '';
      const mx = f.type === 'date' && f.noFuture ? `max="${TODAY()}"` : '';
      ctl = `<input id="${id}" name="${f.key}" type="${t}" value="${esc(v)}" ${im} ${ltr} ${ph} ${mx} ${(lock || f.auto) ? 'readonly' : ''}>`;
    }
    return `<div class="field" data-field="${f.key}"><label for="${id}">${esc(f.label)} ${f.required ? '<span class="req">*</span>' : ''}</label>
      ${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}${lock && rec && rec.transferId && !e.pk.includes(f.key) ? '<span class="hint">חלק מהעברה בין חשבונות – לא ניתן לשנות</span>' : ''}<span class="err" data-err="${f.key}"></span></div>`;
  }
  function openForm(key, rec) {
    const e = ent(key);
    formCtx = { key, rec, touched: new Set(), submitted: false };
    $('#dlgTitle').textContent = rec ? `עריכת ${e.single}` : NEW(e);
    $('#dlgTile').style.setProperty('--c', e.color);
    $('#dlgTile').innerHTML = ICON(key, 20);
    // בתנועה חדשה: שדה "לחשבון" (מוצג רק כשסוג התנועה הוא העברה) מיד אחרי שדה החשבון
    const toField = key === 'transactions' && !rec
      ? `<div class="field" data-field="toAccountNo" hidden><label for="f_toAccountNo">לחשבון <span class="req">*</span></label>
        <select id="f_toAccountNo" name="toAccountNo"><option value="">בחירה...</option>${db.accounts.map(a => `<option value="${a.accountNo}">${esc(titleOf('accounts', a))}</option>`).join('')}</select>
        <span class="err" data-err="toAccountNo"></span></div>` : '';
    let html = e.fields.map(f => inputFor(e, f, rec, !!rec) + (f.key === 'accountNo' ? toField : '')).join('');
    if (toField) html += '<div class="xfer-preview full" id="txPreview" hidden></div>';
    $('#dlgBody').innerHTML = html;
    $('#dlgBody').scrollTop = 0;
    syncTxMode();
    $('#formMsg').textContent = '';
    const d = $('#dlg');
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    updateMoreHint();
  }
  function closeForm() { const d = $('#dlg'); if (d.close) d.close(); else d.removeAttribute('open'); formCtx = null; }

  /* פענוח מספר שהוקלד בחופשיות: "50,000", "₪50000", "4.5%", "4,5" */
  function parseNum(raw, type) {
    let t = String(raw).replace(/[\s‎‏₪$€£%]/g, '');
    if (type === 'percent') t = t.replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  }
  /* ניקוי קלט שהודבק: תווי כיווניות בלתי נראים (למשל מוואטסאפ), רווחים קשיחים וכו' */
  const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  function cleanText(f, raw) {
    let v = String(raw || '').replace(INVISIBLE, '').replace(/\u00a0/g, ' ').trim();
    if (f.digits9) v = v.replace(/[\s\-.]/g, '');      // ת.ז: מסירים רווחים/מקפים שהודבקו
    if (f.type === 'tel') v = v.replace(/\s/g, '');
    return v;
  }
  function readValue(f, form) {
    const el = form.elements[f.key];
    if (!el) return '';
    if (el.disabled && formCtx.rec) return formCtx.rec[f.key];
    const v = cleanText(f, el.value);
    if (v === '') return '';
    if (NUMERIC.includes(f.type)) return parseNum(v, f.type);
    if (f.type === 'ref') {
      const te = ent(f.ref), tf = te.fields.find(x => x.key === te.pk[0]);
      return tf.type === 'number' ? Number(v) : v;
    }
    return v;
  }
  function readForm() {
    const e = ent(formCtx.key), form = $('#dlgForm'), data = {};
    e.fields.forEach(f => { data[f.key] = readValue(f, form); });
    if (form.elements.toAccountNo) data.toAccountNo = form.elements.toAccountNo.value === '' ? '' : Number(form.elements.toAccountNo.value);
    return data;
  }
  /** מציג שגיאות: בזמן הקלדה רק לשדות שנגעו בהם; בשמירה – לכולם */
  function showErrors(errs, all) {
    const form = $('#dlgForm');
    form.querySelectorAll('.field').forEach(fld => {
      const k = fld.dataset.field, show = all || formCtx.touched.has(k);
      const msg = show ? errs[k] : '';
      fld.classList.toggle('invalid', !!msg);
      const fd = ent(formCtx.key).fields.find(f => f.key === k);
      const val = fd ? readValue(fd, form) : ((fld.querySelector('select,input') || {}).value || '');
      fld.classList.toggle('valid', show && !msg && val !== '' && !fld.querySelector('[readonly],[disabled]'));
      fld.querySelector('.err').textContent = msg || '';
    });
    const n = Object.keys(errs).filter(k => k !== '_form').length;
    const msg = errs._form || (n ? (n === 1 ? 'יש לתקן את השדה המסומן' : `יש לתקן ${n} שדות מסומנים`) : '');
    $('#formMsg').textContent = all || formCtx.submitted ? msg : '';
  }
  function liveValidate(ev) {
    if (!formCtx) return;
    const fld = ev.target.closest('.field');
    if (fld && (ev.type !== 'input' || fld.classList.contains('invalid') || formCtx.submitted)) formCtx.touched.add(fld.dataset.field);
    syncTxMode();
    showErrors(formErrors(formCtx.key, readForm(), formCtx.rec), formCtx.submitted);
  }
  function submitForm(ev) {
    if (ev) ev.preventDefault();
    if (!formCtx) return;
    const { key, rec } = formCtx;
    const e = ent(key);
    formCtx.submitted = true;
    const data = readForm();
    const errs = formErrors(key, data, rec);
    showErrors(errs, true);
    if (Object.keys(errs).length) return formFail();
    if (isXferForm(data)) {                       // העברה בין חשבונות – שתי תנועות מקושרות
      const x = xferFromData(data), r = checkXfer(x);
      doTransfer(x, r.received);
      closeForm();
      toast(`ההעברה בוצעה: ${money(x.amount, curOf(x.from))} מחשבון ${x.from.accountNo} לחשבון ${x.to.accountNo}`);
      return route(true);
    }
    if (rec) Object.assign(rec, data); else db[key].push(data);
    save(); closeForm();
    toast(rec ? 'השינויים נשמרו' : ADDED(e));
    route(true);
  }
  function formFail() {
    const first = document.querySelector('#dlgForm .field.invalid input, #dlgForm .field.invalid select');
    if (first) {
      const body = $('#dlgBody'), fld = first.closest('.field');
      body.scrollTop = Math.max(0, fld.offsetTop - body.offsetTop - 12);
      try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
    }
    const box = $('#dlg'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }
  /* רמז "יש עוד שדות למטה" כשגוף הטופס נגלל */
  function updateMoreHint() {
    const b = $('#dlgBody');
    $('#dlg').classList.toggle('has-more', b.scrollHeight - b.scrollTop - b.clientHeight > 8);
  }

  /* =====================================================================
     העברה בין חשבונות – סוג תנועה בטופס "תנועה חדשה".
     יוצרת שתי תנועות מקושרות: משיכה מחשבון המקור והפקדה בחשבון היעד
     ===================================================================== */
  const round2 = n => Math.round(n * 100) / 100;
  const XFER = 'העברה';
  /** מחשב את ההעברה ומחזיר שגיאות + סכום שיתקבל */
  function checkXfer(x) {
    const errs = {};
    const err = (k, m) => { if (!errs[k]) errs[k] = m; };
    if (!x.fromRaw) err('from', 'שדה חובה');
    if (!x.toRaw) err('to', 'שדה חובה');
    if (x.from && x.to && String(x.from.accountNo) === String(x.to.accountNo)) err('to', 'יש לבחור חשבון אחר מחשבון המקור');
    [['from', x.from], ['to', x.to]].forEach(([k, a]) => { if (a && a.status !== 'פעיל') err(k, `החשבון ${a.status === 'סגור' ? 'סגור' : 'מוקפא'}`); });
    if (!x.amountRaw) err('amount', 'שדה חובה');
    else if (isNaN(x.amount)) err('amount', 'יש להזין מספר');
    else if (x.amount <= 0) err('amount', 'הסכום חייב להיות גדול מאפס');
    if (!x.date) err('date', 'שדה חובה');
    else if (!isDate(x.date)) err('date', 'תאריך לא תקין');
    else if (x.date > TODAY()) err('date', 'התאריך לא יכול להיות עתידי');
    else {
      const latest = [x.from, x.to].filter(Boolean).map(a => a.openDate).sort().pop();
      if (latest && x.date < latest) err('date', `התאריך מוקדם מפתיחת החשבון (${fdate(latest)})`);
    }
    let received = null, rate = null;
    if (x.from && x.to && !isNaN(x.amount) && x.amount > 0) {
      const fc = curOf(x.from), tc = curOf(x.to);
      if (fc === tc) received = x.amount;
      else {
        const ils = FXN.toILS(x.amount, fc), out = ils == null ? null : FXN.fromILS(ils, tc);
        if (out == null) err('to', 'אין כרגע שער חליפין להמרה בין המטבעות – נסו שוב מאוחר יותר');
        else { received = round2(out); rate = round2(ils / x.amount * 1000) / 1000; }
      }
      const bal = balanceOf(x.from);
      if (x.from.type !== 'עו"ש' && x.amount > bal) err('amount', `הסכום גבוה מהיתרה (${money(bal, fc)}). משיכת יתר מותרת רק בעו"ש`);
    }
    return { errs, received, rate };
  }
  const isXferForm = data => formCtx && formCtx.key === 'transactions' && !formCtx.rec && data.type === XFER;
  const xferFromData = d => ({
    from: findBy('accounts', d.accountNo), to: findBy('accounts', d.toAccountNo),
    fromRaw: d.accountNo === '' ? '' : String(d.accountNo), toRaw: d.toAccountNo === '' || d.toAccountNo == null ? '' : String(d.toAccountNo),
    amount: d.amount === '' ? NaN : d.amount, amountRaw: d.amount === '' ? '' : String(d.amount), date: d.date, description: d.description || ''
  });
  /** שגיאות טופס: בהעברה – כללי ההעברה; אחרת – בדיקת הרשומה הרגילה */
  function formErrors(key, data, rec) {
    if (!isXferForm(data)) return validateRecord(key, data, rec);
    const r = checkXfer(xferFromData(data)), map = { from: 'accountNo', to: 'toAccountNo' }, errs = {};
    Object.keys(r.errs).forEach(k => { errs[map[k] || k] = r.errs[k]; });
    return errs;
  }
  /** מציג/מסתיר את שדה "לחשבון" ואת התצוגה המקדימה לפי סוג התנועה */
  function syncTxMode() {
    if (!formCtx || formCtx.key !== 'transactions' || formCtx.rec) return;
    const data = readForm(), on = data.type === XFER;
    const toFld = document.querySelector('[data-field="toAccountNo"]'), prev = $('#txPreview');
    if (!toFld) return;
    toFld.hidden = !on;
    document.querySelector('label[for="f_accountNo"]').firstChild.textContent = on ? 'מחשבון ' : 'חשבון ';
    document.querySelector('label[for="f_amount"]').firstChild.textContent = on && findBy('accounts', data.accountNo)
      ? `סכום (${{ ILS: '₪', USD: '$', EUR: '€' }[curOf(findBy('accounts', data.accountNo))]}) ` : 'סכום ';
    const x = xferFromData(data), r = on ? checkXfer(x) : null;
    if (on && x.from && x.to && r.received != null && !r.errs.to) {
      const fc = curOf(x.from), tc = curOf(x.to);
      prev.innerHTML = `<div class="xfer-flow"><span><b>${money(x.amount, fc)}</b><small>יורדים מחשבון ${x.from.accountNo}</small></span>
        <span class="arrow">←</span><span><b>${money(r.received, tc)}</b><small>נכנסים לחשבון ${x.to.accountNo}</small></span></div>
        ${fc !== tc ? '<div class="psub">ההמרה לפי השער היציג של בנק ישראל</div>' : ''}`;
      prev.hidden = false;
    } else prev.hidden = true;
    updateMoreHint();
  }
  function doTransfer(x, received) {
    const tid = 'T' + Date.now(), id1 = nextId('transactions', 'txnId');
    const note = x.description ? ` – ${x.description}` : '';
    db.transactions.push(
      { txnId: id1, accountNo: x.from.accountNo, date: x.date, type: 'משיכה', amount: round2(x.amount), description: `העברה לחשבון ${x.to.accountNo}${note}`, transferId: tid },
      { txnId: id1 + 1, accountNo: x.to.accountNo, date: x.date, type: 'הפקדה', amount: received, description: `העברה מחשבון ${x.from.accountNo}${note}`, transferId: tid });
    save();
  }

  /* ---------- Router ---------- */
  function route(keepScroll) {
    const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    if (parts[0] === 'e' && parts[1] && parts[2]) viewDetail(parts[1], parts.slice(2).join('/'));
    else if (parts[0] === 'e' && parts[1]) viewList(parts[1]);
    else if (parts[0] === 'transfer') {          // קישור ישן – פותח תנועה חדשה מסוג העברה
      history.replaceState(null, '', '#/e/transactions'); viewList('transactions'); openForm('transactions');
      $('#f_type').value = XFER; syncTxMode();
    }
    else viewHome();
    if (keepScroll !== true) window.scrollTo(0, 0);
  }

  document.addEventListener('click', ev => {
    const ed = ev.target.closest('[data-edit]'), dl = ev.target.closest('[data-del]');
    const key = (location.hash.match(/#\/e\/([^/]+)/) || [])[1];
    if (ed) { ev.stopPropagation(); return openForm(key, findBy(key, ed.dataset.edit)); }
    if (dl) { ev.stopPropagation(); return remove(key, dl.dataset.del); }
    const row = ev.target.closest('tr[data-go]');
    if (row && !ev.target.closest('a')) location.hash = row.dataset.go;
  });
  $('#dlgForm').addEventListener('submit', submitForm);
  $('#dlgSave').addEventListener('click', ev => { ev.preventDefault(); submitForm(); });  // גיבוי ל-Safari/iOS
  $('#dlgForm').addEventListener('input', liveValidate);
  $('#dlgForm').addEventListener('change', liveValidate);
  $('#dlgForm').addEventListener('focusout', ev => {
    if (!ev.target.matches('input,select')) return;
    if (formCtx && ev.target.matches('input[type="text"],input[type="tel"],input[type="email"]') && !ev.target.readOnly) {
      const f = ent(formCtx.key).fields.find(x => x.key === ev.target.name);
      if (f && !NUMERIC.includes(f.type)) { const c = cleanText(f, ev.target.value); if (c !== ev.target.value) ev.target.value = c; }
    }
    liveValidate(ev);
  });
  $('#dlgBody').addEventListener('scroll', updateMoreHint, { passive: true });
  $('#dlgCancel').addEventListener('click', closeForm);
  $('#dlg').addEventListener('close', () => { formCtx = null; });
  window.addEventListener('hashchange', route);

  $('#menuBtn').innerHTML = ICON('menu', 20);
  $('#today').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  load();
  if (window.FX) FX.load(() => { const h = location.hash; if (!h || h === '#/' || h === '#' || h.startsWith('#/e/accounts') || h.startsWith('#/e/transactions')) route(true); });
  route();
})();
