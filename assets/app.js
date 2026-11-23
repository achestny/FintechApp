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
  const PEOPLE = ['customers', 'employees'];
  const TAGS = { 'פעיל': 'ok', 'סגור': 'bad', 'מוקפא': 'mid', 'הפקדה': 'ok', 'משיכה': 'bad' };
  const balanceOf = a => ent('accounts').computed[0].fn(a, db);
  const curOf = a => (a && a.currency) || 'ILS';
  const optLabel = (f, v) => (f.optionLabels && f.optionLabels[v]) || v;
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
  function relationsFor(key) {
    if (ent(key).relTable) return S.relations.filter(r => r.key === 'r_owns');
    return S.relations.filter(r => r.a === key || r.b === key);
  }

  /* ---------- Shell ---------- */
  function shell(active, crumbs) {
    const counts = {}; S.entities.forEach(e => { counts[e.key] = db[e.key].length; });
    const iss = scanAll(); counts.check = iss.filter(i => i.sev === 'error').length || null;
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

  /* ---------- Dashboard ---------- */
  function viewHome() {
    shell('home', [['לוח בקרה', '#/']]);
    // יתרות מומרות לשקלים לפי השער היציג (חשבונות במט"ח ללא שער – לא נספרים ומסומנים)
    const balances = db.accounts.map(a => ({ a, b: FXN.toILS(balanceOf(a), curOf(a)) }));
    const missing = balances.filter(x => x.b == null);
    balances.forEach(x => { if (x.b == null) x.b = 0; });
    const totalBal = balances.reduce((s, x) => s + x.b, 0);
    const fxBal = {};
    db.accounts.filter(a => curOf(a) !== 'ILS').forEach(a => { fxBal[curOf(a)] = (fxBal[curOf(a)] || 0) + balanceOf(a); });
    const usd = FXN.fromILS(totalBal, 'USD');
    const totalLoans = db.loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const active = db.accounts.filter(a => a.status === 'פעיל').length;
    const avgRate = db.loans.length ? db.loans.reduce((s, l) => s + Number(l.rate || 0) * Number(l.amount || 0), 0) / (totalLoans || 1) : 0;

    // יתרות לפי סוג חשבון
    const accTypes = ent('accounts').fields.find(f => f.key === 'type').options
      .map(t => ({ t, v: balances.filter(x => x.a.type === t).reduce((s, x) => s + x.b, 0), n: balances.filter(x => x.a.type === t).length }));
    // הלוואות לפי מטרה
    const purposes = ent('loans').fields.find(f => f.key === 'purpose').options
      .map(t => ({ t, v: db.loans.filter(l => l.purpose === t).reduce((s, l) => s + Number(l.amount || 0), 0), n: db.loans.filter(l => l.purpose === t).length }));
    const bars = (rows, color, unit) => {
      const max = Math.max(1, ...rows.map(r => Math.abs(r.v)));
      return `<div class="bars">${rows.map(r => `<div class="bar-row" title="${esc(r.t)}: ${money(r.v)} · ${r.n} ${unit}">
        <span class="name">${esc(r.t)}</span>
        <span class="bar-track"><span class="bar-fill" style="--c:${color};width:${Math.max(0, r.v) / max * 100}%"></span></span>
        <span class="v">${money(r.v)}</span></div>`).join('')}</div>`;
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

    $('#view').innerHTML = `
      <div class="page-head"><div>
        <h1>לוח בקרה</h1>
        <p>תמונת מצב של הלקוחות, החשבונות וההלוואות בבנק.</p></div>
        <div class="actions"><a class="btn" href="erd.html">${ICON('erd', 17)} מודל הנתונים</a>
          <button class="btn primary" type="button" id="qAdd">${ICON('plus', 17)} לקוח חדש</button></div>
      </div>

      <div class="kpis">
        <div class="kpi hero"><div class="top"><span class="lbl">סך יתרות בחשבונות</span><span class="tile">${ICON('accounts', 20)}</span></div>
          <div class="val">${money(totalBal)}</div>
          <div class="foot">${missing.length ? `${missing.length} חשבונות במט"ח לא הומרו – אין שער זמין` :
            `ב-${db.accounts.length} חשבונות${Object.keys(fxBal).length ? ' · כולל מט"ח לפי שער יציג' : ''}${usd != null ? ` · ≈ ${money(usd, 'USD')}` : ''}`}</div></div>
        <a class="kpi" href="#/e/loans"><div class="top"><span class="lbl">תיק ההלוואות</span>${tile(Lo)}</div>
          <div class="val">${money(totalLoans)}</div><div class="foot">${db.loans.length} הלוואות · ריבית משוקללת ${avgRate.toFixed(1)}%</div></a>
        <a class="kpi" href="#/e/customers"><div class="top"><span class="lbl">לקוחות</span>${tile(C)}</div>
          <div class="val">${db.customers.length}</div><div class="foot">ב-${db.branches.length} סניפים</div></a>
        <a class="kpi" href="#/e/accounts"><div class="top"><span class="lbl">חשבונות פעילים</span>${tile(A)}</div>
          <div class="val">${active}<span class="muted" style="font-size:18px;font-weight:500"> / ${db.accounts.length}</span></div>
          <div class="foot">${db.ownerships.length} קשרי בעלות</div></a>
      </div>

      <div class="grid c3">
        ${fxCard(fxBal)}
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
            <span><div class="pname">${esc(x.c.fullName)}</div><div class="psub">${x.n} חשבונות</div></span>
            <span class="amt">${money(x.sum)}</span></a>`).join('')}</div></div>
      </div>

      <div class="card"><div class="card-head"><h2>ישויות במערכת</h2><a class="more" href="erd.html">לתרשים ה-ERD</a></div>
        <div class="ent-strip">${S.entities.map(e => `<a class="ent-chip" href="#/e/${e.key}" style="--c:${e.color}">
          ${tile(e, 18)}<b class="num">${db[e.key].length}</b><span>${esc(e.label)}</span></a>`).join('')}</div></div>

      <div class="foot-note">הנתונים נשמרים בדפדפן בלבד (localStorage) · כל הנתונים פיקטיביים
        <button class="btn sm ghost" id="resetBtn" type="button">איפוס לנתוני הדגמה</button></div>`;
    $('#qAdd').addEventListener('click', () => openForm('customers'));
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
    const rels = relationsFor(key).map(r => {
      const other = r.a === r.b ? 'עצמה' : ent(r.a === key ? r.b : r.a).single;
      return `<span class="rel-badge"><b>${esc(r.label)}</b> · ${esc(other)}</span>`;
    }).join('');

    $('#view').innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow" style="--c:${e.color}">${tile(e, 16)}${e.relTable ? 'טבלת קשר' : 'ישות'}</div>
          <h1>${esc(e.label)} <span class="count-pill" style="vertical-align:middle">${db[key].length}</span></h1>
          <p>${esc(e.desc)}</p><div class="rel-badges">${rels}</div></div>
        <div class="actions">
          <label class="search">${ICON('search', 17)}<input id="q" type="search" placeholder="חיפוש ב${esc(e.label)}..." value="${esc(searchState[key] || '')}" aria-label="חיפוש"></label>
          <button class="btn primary" id="addBtn" type="button">${ICON('plus', 17)} ${esc(e.single)} חדש</button>
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
        : `<div class="empty">${q ? 'לא נמצאו רשומות תואמות לחיפוש' : 'אין עדיין רשומות'}</div>`;
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
      const relDef = S.relations.find(x => (x.a === key && x.b === re.key) || (x.b === key && x.a === re.key) || (re.relTable && x.key === 'r_owns'));
      const name = re.key === key ? 'עובדים כפופים' : re.label;
      return `<div class="card flush">
        <div class="card-head" style="padding:20px 24px 6px">${tile(re, 18)}<h2>${esc(name)}</h2>
          <span class="count-pill">${rows.length}</span>
          ${relDef ? `<span class="sub" style="margin-inline-start:auto">קשר "${esc(relDef.label)}"</span>` : ''}</div>
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
      <div class="card"><div class="card-head"><h2>תכונות</h2><span class="sub">Attributes</span></div>
        <div class="attr-grid">
          ${e.fields.map(f => `<div class="attr"><div class="k">${esc(f.label)}</div><div class="v">${fmt(f, r) || '<span class="muted">—</span>'}</div></div>`).join('')}
          ${(e.computed || []).map(c => `<div class="attr"><div class="k">${esc(c.label)} · מחושב</div><div class="v">${fmtComputed(c, r)}</div></div>`).join('')}
        </div></div>
      ${relSections}`;
    $('#edBtn').addEventListener('click', () => openForm(key, r));
    $('#dlBtn').addEventListener('click', () => { if (remove(key, id)) location.hash = `#/e/${key}`; });
  }

  /* ---------- Delete (שלמות התייחסות) ---------- */
  function remove(key, id) {
    const e = ent(key);
    const r = findBy(key, id);
    if (!r) return false;
    const blockers = related(key, id).filter(x => x.rows.length);
    if (blockers.length) {
      toast(`לא ניתן למחוק – קיימות רשומות קשורות (${blockers.map(b => `${b.e.key === key ? 'עובדים כפופים' : b.e.label}: ${b.rows.length}`).join(', ')})`, true);
      return false;
    }
    if (!confirm(`למחוק את "${titleOf(key, r)}"?`)) return false;
    db[key] = db[key].filter(x => pkOf(e, x) !== String(id));
    save(); toast(`${e.single} נמחק`);
    if (!location.hash.includes(`/e/${key}/`)) route();
    return true;
  }

  /* =====================================================================
     מנגנון בדיקת תקינות – משמש גם את הטופס (בזמן הקלדה ובשמירה)
     וגם את דוח "בדיקת תקינות הנתונים" שסורק את כל מסד הנתונים
     ===================================================================== */
  const TODAY = () => new Date().toISOString().slice(0, 10);
  function validIsraeliId(id) {
    const s = String(id);
    if (!/^\d{9}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) { const d = Number(s[i]) * ((i % 2) + 1); sum += d > 9 ? d - 9 : d; }
    return sum % 10 === 0;
  }
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
      if (f.idCheck && !validIsraeliId(v)) return err(f.key, 'מספר זהות לא תקין (ספרת ביקורת שגויה)');
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
    if (key === 'employees' && data.managerId !== '' && data.managerId != null) {
      if (String(data.managerId) === String(data.empId)) err('managerId', 'עובד לא יכול לנהל את עצמו');
      let cur = findBy('employees', data.managerId), guard = 0;
      while (cur && guard++ < 100) {
        if (String(cur.empId) === String(data.empId)) { err('managerId', 'מעגל ניהול: העובד אינו יכול להיות מנהל של המנהל שלו'); break; }
        cur = cur.managerId === '' || cur.managerId == null ? null : findBy('employees', cur.managerId);
      }
    }
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
    if (key === 'accounts' && rec && rec.currency !== data.currency &&
        db.transactions.some(t => String(t.accountNo) === String(rec.accountNo)))
      err('currency', 'לא ניתן לשנות מטבע לחשבון שיש בו תנועות');
  }

  /** סריקת כל מסד הנתונים – מחזיר רשימת ממצאים */
  function scanAll() {
    const issues = [];
    const add = (sev, key, r, field, msg) => issues.push({ sev, key, r, field, msg });
    S.entities.forEach(e => {
      const seen = new Map();
      db[e.key].forEach(r => {
        const k = pkOf(e, r);
        if (seen.has(k)) add('error', e.key, r, e.pk[0], 'מפתח ראשי כפול');
        seen.set(k, true);
        const errs = validateRecord(e.key, r, r);
        Object.keys(errs).filter(f => f !== '_form').forEach(f => add('error', e.key, r, f, errs[f]));
      });
    });
    // כללי השתתפות בקשרים (אזהרות)
    db.accounts.forEach(a => {
      if (!db.ownerships.some(o => String(o.accountNo) === String(a.accountNo))) add('warn', 'accounts', a, null, 'חשבון ללא בעלים (אין רשומה בטבלת "בעלות בחשבונות")');
      if (a.status === 'סגור' && balanceOf(a) !== 0) add('warn', 'accounts', a, null, `חשבון סגור עם יתרה של ${money(balanceOf(a), curOf(a))}`);
      if (a.type === 'עו"ש' && balanceOf(a) < 0) add('warn', 'accounts', a, null, `חשבון במשיכת יתר (${money(balanceOf(a), curOf(a))})`);
    });
    db.customers.forEach(c => {
      if (!db.ownerships.some(o => String(o.customerId) === String(c.customerId))) add('warn', 'customers', c, null, 'לקוח ללא חשבון');
    });
    db.branches.forEach(b => {
      if (!db.employees.some(x => String(x.branchId) === String(b.branchId))) add('warn', 'branches', b, null, 'סניף ללא עובדים');
    });
    return issues;
  }
  window.__scanAll = () => scanAll();

  /* ---------- Integrity report ---------- */
  function viewCheck() {
    shell('check', [['לוח בקרה', '#/'], ['בדיקת תקינות', '#/check']]);
    const issues = scanAll();
    const errors = issues.filter(i => i.sev === 'error'), warns = issues.filter(i => i.sev === 'warn');
    const records = S.entities.reduce((s, e) => s + db[e.key].length, 0);
    const fieldOf = (key, f) => (f ? (ent(key).fields.find(x => x.key === f) || {}).label || f : '—');
    const rows = issues.map(i => {
      const e = ent(i.key);
      return `<tr data-go="${href(i.key, i.r)}">
        <td><span class="tag ${i.sev === 'error' ? 'bad' : 'mid'}">${i.sev === 'error' ? 'שגיאה' : 'אזהרה'}</span></td>
        <td><span class="chip" style="--c:${e.color}">${esc(e.single)}</span></td>
        <td style="font-weight:600">${esc(titleOf(i.key, i.r))}</td>
        <td class="muted">${esc(fieldOf(i.key, i.field))}</td>
        <td style="white-space:normal">${esc(i.msg)}</td>
        <td class="actions" style="opacity:1"><button class="btn sm" data-fix="${i.key}" data-pk="${esc(pkOf(e, i.r))}" type="button">${ICON('edit', 14)} תיקון</button></td></tr>`;
    }).join('');
    $('#view').innerHTML = `
      <div class="page-head"><div>
        <div class="eyebrow" style="--c:#16a34a"><span class="tile" style="--c:#16a34a">${ICON('check', 16)}</span>איכות נתונים</div>
        <h1>בדיקת תקינות הנתונים</h1>
        <p>סריקה של כל הרשומות במערכת: שדות חובה, פורמטים (ת.ז עם ספרת ביקורת, טלפון, דוא"ל, תאריכים), טווחי ערכים, מפתחות ראשיים כפולים, מפתחות זרים יתומים וכללים עסקיים.</p></div>
        <div class="actions"><button class="btn" id="rescan" type="button">${ICON('check', 16)} הרצת בדיקה מחדש</button></div></div>
      <div class="kpis">
        <div class="kpi ${issues.length ? '' : 'hero ok'}"><div class="top"><span class="lbl">סטטוס</span><span class="tile" style="--c:${errors.length ? '#e11d48' : warns.length ? '#d97706' : '#16a34a'}">${ICON('check', 20)}</span></div>
          <div class="val" style="font-size:24px">${errors.length ? 'נמצאו שגיאות' : warns.length ? 'תקין, עם אזהרות' : 'הנתונים תקינים'}</div>
          <div class="foot">נבדק ב-${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div></div>
        <div class="kpi"><div class="top"><span class="lbl">רשומות שנבדקו</span></div><div class="val">${records}</div><div class="foot">ב-${S.entities.length} טבלאות</div></div>
        <div class="kpi"><div class="top"><span class="lbl">שגיאות</span></div><div class="val ${errors.length ? 'neg' : ''}">${errors.length}</div><div class="foot">חובה לתקן</div></div>
        <div class="kpi"><div class="top"><span class="lbl">אזהרות</span></div><div class="val" style="${warns.length ? 'color:#b45309' : ''}">${warns.length}</div><div class="foot">מומלץ לבדוק</div></div>
      </div>
      <div class="card flush">${issues.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>חומרה</th><th>ישות</th><th>רשומה</th><th>שדה</th><th>תיאור</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="empty">${ICON('check', 28)}<div style="margin-top:8px;font-weight:600;color:var(--ink)">לא נמצאו בעיות</div>כל ${records} הרשומות עומדות בכל כללי התקינות.</div>`}</div>
      <div class="card"><div class="card-head"><h2>הכללים שנבדקים</h2></div>
        <div class="rules">
          <div><b>שלמות ישות</b><span>שדות חובה מלאים, מפתח ראשי ייחודי (כולל מפתח משולב)</span></div>
          <div><b>שלמות התייחסות</b><span>כל מפתח זר מצביע על רשומה קיימת; אין מחיקה של רשומה שיש לה רשומות תלויות</span></div>
          <div><b>תחום ערכים</b><span>ת.ז עם ספרת ביקורת, טלפון, דוא"ל, תאריכים לא עתידיים, ריבית 0–30%, מספרים שלמים</span></div>
          <div><b>כללים עסקיים</b><span>אין תנועות בחשבון סגור, אין משיכת יתר מחוץ לעו"ש, אין מעגל ניהול, תנועה/צירוף לא לפני פתיחת החשבון</span></div>
          <div><b>השתתפות בקשרים</b><span>לכל חשבון יש בעלים, לכל לקוח יש חשבון, לכל סניף יש עובדים (אזהרה)</span></div>
        </div></div>`;
    $('#rescan').addEventListener('click', () => { route(true); toast('הבדיקה הושלמה'); });
  }

  /* ---------- Form ---------- */
  let formCtx = null;
  const NUMERIC = ['number', 'money', 'percent'];
  const nextId = (key, field) => db[key].reduce((m, r) => Math.max(m, Number(r[field]) || 0), 0) + 1;
  function inputFor(e, f, rec, isEdit) {
    const v = rec ? rec[f.key] : (f.auto ? nextId(e.key, f.key) : '');
    const lock = isEdit && e.pk.includes(f.key);
    const id = `f_${f.key}`;
    let ctl;
    if (f.type === 'select') {
      ctl = `<select id="${id}" name="${f.key}" ${lock ? 'disabled' : ''}><option value="">בחירה...</option>
        ${f.options.map(o => `<option value="${esc(o)}" ${String(v) === o ? 'selected' : ''}>${esc(optLabel(f, o))}</option>`).join('')}</select>`;
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
      ${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="err" data-err="${f.key}"></span></div>`;
  }
  function openForm(key, rec) {
    const e = ent(key);
    formCtx = { key, rec, touched: new Set(), submitted: false };
    $('#dlgTitle').textContent = rec ? `עריכת ${e.single}` : `${e.single} חדש`;
    $('#dlgTile').style.setProperty('--c', e.color);
    $('#dlgTile').innerHTML = ICON(key, 20);
    $('#dlgBody').innerHTML = e.fields.map(f => inputFor(e, f, rec, !!rec)).join('');
    $('#dlgBody').scrollTop = 0;
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
  function readValue(f, form) {
    const el = form.elements[f.key];
    if (!el) return '';
    if (el.disabled && formCtx.rec) return formCtx.rec[f.key];
    const v = String(el.value || '').trim();
    if (v === '') return '';
    if (NUMERIC.includes(f.type)) return parseNum(v, f.type);
    if (f.type === 'tel') return v.replace(/\s/g, '');
    if (f.type === 'ref') {
      const te = ent(f.ref), tf = te.fields.find(x => x.key === te.pk[0]);
      return tf.type === 'number' ? Number(v) : v;
    }
    return v;
  }
  function readForm() {
    const e = ent(formCtx.key), form = $('#dlgForm'), data = {};
    e.fields.forEach(f => { data[f.key] = readValue(f, form); });
    return data;
  }
  /** מציג שגיאות: בזמן הקלדה רק לשדות שנגעו בהם; בשמירה – לכולם */
  function showErrors(errs, all) {
    const form = $('#dlgForm');
    form.querySelectorAll('.field').forEach(fld => {
      const k = fld.dataset.field, show = all || formCtx.touched.has(k);
      const msg = show ? errs[k] : '';
      fld.classList.toggle('invalid', !!msg);
      const val = readValue(ent(formCtx.key).fields.find(f => f.key === k), form);
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
    showErrors(validateRecord(formCtx.key, readForm(), formCtx.rec), formCtx.submitted);
  }
  function submitForm(ev) {
    if (ev) ev.preventDefault();
    if (!formCtx) return;
    const { key, rec } = formCtx;
    const e = ent(key);
    formCtx.submitted = true;
    const data = readForm();
    const errs = validateRecord(key, data, rec);
    showErrors(errs, true);
    if (Object.keys(errs).length) return formFail();
    if (rec) Object.assign(rec, data); else db[key].push(data);
    save(); closeForm();
    toast(rec ? 'השינויים נשמרו' : `${e.single} נוסף בהצלחה`);
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

  /* ---------- Router ---------- */
  function route(keepScroll) {
    const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    if (parts[0] === 'e' && parts[1] && parts[2]) viewDetail(parts[1], parts.slice(2).join('/'));
    else if (parts[0] === 'e' && parts[1]) viewList(parts[1]);
    else if (parts[0] === 'check') viewCheck();
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
  $('#dlgForm').addEventListener('focusout', ev => { if (ev.target.matches('input,select')) liveValidate(ev); });
  $('#dlgBody').addEventListener('scroll', updateMoreHint, { passive: true });
  $('#dlgCancel').addEventListener('click', closeForm);
  $('#dlg').addEventListener('close', () => { formCtx = null; });
  document.addEventListener('click', ev => {
    const fx = ev.target.closest('[data-fix]');
    if (fx) { ev.stopPropagation(); const r = findBy(fx.dataset.fix, fx.dataset.pk); if (r) openForm(fx.dataset.fix, r); }
  }, true);
  window.addEventListener('hashchange', route);

  $('#menuBtn').innerHTML = ICON('menu', 20);
  $('#today').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  load();
  if (window.FX) FX.load(() => { const h = location.hash; if (!h || h === '#/' || h === '#' || h.startsWith('#/e/accounts') || h.startsWith('#/e/transactions')) route(true); });
  route();
})();
