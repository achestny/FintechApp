/* ניהול לקוחות בנק – אפליקציית CRUD פשוטה, צד-לקוח בלבד */
(function () {
  'use strict';

  const S = window.SCHEMA;
  const STORE = 'bank-crm-v1';
  let db;

  /* ---------- Storage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { db = JSON.parse(raw); }
    } catch (e) { db = null; }
    if (!db || !S.entities.every(e => Array.isArray(db[e.key]))) db = JSON.parse(JSON.stringify(window.SEED));
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* ignore */ } }

  /* ---------- Helpers ---------- */
  const $ = s => document.querySelector(s);
  const ent = k => S.entities.find(e => e.key === k);
  const pkOf = (e, r) => e.pk.map(k => String(r[k])).join('|');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
  const money = n => nf.format(Number(n) || 0);
  const fdate = d => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? esc(d) : x.toLocaleDateString('he-IL'); };
  const findBy = (key, id) => { const e = ent(key); return db[key].find(r => pkOf(e, r) === String(id)); };
  const titleOf = (key, r) => r ? ent(key).title(r, db) : '—';
  const href = (key, r) => `#/e/${key}/${encodeURIComponent(pkOf(ent(key), r))}`;
  const TAGS = { 'פעיל': 'ok', 'סגור': 'bad', 'מוקפא': 'mid', 'הפקדה': 'ok', 'משיכה': 'bad' };
  const ICON = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    del: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function fmt(f, r) {
    const v = r[f.key];
    switch (f.type) {
      case 'money': return money(v);
      case 'date': return fdate(v);
      case 'percent': return v === '' || v == null ? '' : `${esc(v)}%`;
      case 'select': return `<span class="tag ${TAGS[v] || ''}">${esc(v)}</span>`;
      case 'ref': {
        if (v === '' || v == null) return '<span class="muted">—</span>';
        const t = findBy(f.ref, v);
        return t ? `<a class="chip" style="--c:${ent(f.ref).color}" href="${href(f.ref, t)}" onclick="event.stopPropagation()">${esc(titleOf(f.ref, t))}</a>` : `<span class="muted">${esc(v)}</span>`;
      }
      case 'tel': return `<span class="ltr">${esc(v)}</span>`;
      default: return esc(v);
    }
  }
  function fmtComputed(c, r) {
    const v = c.fn(r, db);
    return c.type === 'money' ? `<span class="${v < 0 ? 'neg' : ''}">${money(v)}</span>` : esc(v);
  }
  const keyIcons = (e, f) =>
    (e.pk.includes(f.key) ? '<span class="key-ic pk" title="מפתח ראשי">PK</span>' : '') +
    (f.type === 'ref' ? '<span class="key-ic fk" title="מפתח זר">FK</span>' : '');

  function reverseRefs(key) {
    const out = [];
    S.entities.forEach(e => e.fields.forEach(f => { if (f.type === 'ref' && f.ref === key) out.push({ e, f }); }));
    return out;
  }
  function related(key, id) {
    return reverseRefs(key)
      .map(({ e, f }) => ({ e, f, rows: db[e.key].filter(r => String(r[f.key]) === String(id)) }));
  }
  function relationsFor(key) {
    const e = ent(key);
    if (e.relTable) return S.relations.filter(r => r.key === 'r_owns');
    return S.relations.filter(r => r.a === key || r.b === key);
  }

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, 3200);
  }

  /* ---------- Navigation ---------- */
  function renderNav(active) {
    const items = S.entities.map(e =>
      `<a href="#/e/${e.key}" class="${active === e.key ? 'active' : ''}" style="--c:${e.color}">
        <span class="dot"></span>${esc(e.label)}<span class="count">${db[e.key].length}</span></a>`).join('');
    $('#nav').innerHTML =
      `<a href="#/" class="${active === 'home' ? 'active' : ''}"><span class="dot" style="--c:#16325c"></span>לוח בקרה</a>
       <hr><div class="sub">ישויות</div>${items}<hr>
       <a href="erd.html"><span class="dot" style="--c:#7c3aed"></span>תרשים ERD</a>`;
  }

  /* ---------- Dashboard ---------- */
  function viewHome() {
    renderNav('home');
    const acc = ent('accounts');
    const totalBal = db.accounts.reduce((s, a) => s + acc.computed[0].fn(a, db), 0);
    const totalLoans = db.loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const recent = db.transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.txnId - a.txnId).slice(0, 6);
    const tx = ent('transactions');
    const topCust = db.customers.map(c => ({
      c, n: db.ownerships.filter(o => String(o.customerId) === String(c.customerId)).length,
      l: db.loans.filter(l => String(l.customerId) === String(c.customerId)).length
    }));

    $('#view').innerHTML = `
      <div class="page-head"><div><h1>לוח בקרה</h1>
        <p>תמונת מצב של הבנק. לחצו על כל ישות כדי לצפות ברשומות, להוסיף, לערוך ולמחוק.</p></div></div>
      <div class="stats">
        ${S.entities.map(e => `<a class="stat" href="#/e/${e.key}" style="--c:${e.color}">
          <div class="num">${db[e.key].length}</div><div class="lbl">${esc(e.label)}</div></a>`).join('')}
      </div>
      <div class="stats">
        <div class="stat" style="--c:#15803d"><div class="num">${money(totalBal)}</div><div class="lbl">סך יתרות בחשבונות</div></div>
        <div class="stat" style="--c:#dc2626"><div class="num">${money(totalLoans)}</div><div class="lbl">סך הלוואות שניתנו</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h2>תנועות אחרונות</h2>
          <div class="table-wrap"><table class="data"><thead><tr><th>תאריך</th><th>חשבון</th><th>סוג</th><th>סכום</th></tr></thead><tbody>
          ${recent.map(t => `<tr data-go="${href('transactions', t)}"><td>${fdate(t.date)}</td><td>${fmt(tx.fields[1], t)}</td>
            <td>${fmt(tx.fields[3], t)}</td><td class="${t.type === 'הפקדה' ? 'pos' : 'neg'}">${money(t.amount)}</td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="card"><h2>לקוחות – חשבונות והלוואות</h2>
          <div class="table-wrap"><table class="data"><thead><tr><th>לקוח</th><th>חשבונות</th><th>הלוואות</th></tr></thead><tbody>
          ${topCust.map(x => `<tr data-go="${href('customers', x.c)}"><td>${esc(x.c.fullName)}</td><td>${x.n}</td><td>${x.l}</td></tr>`).join('')}
          </tbody></table></div></div>
      </div>
      <div class="card"><h2>איך הישויות קשורות זו לזו?</h2>
        <p class="muted" style="margin:0 0 10px">המערכת בנויה על ${S.entities.length - 1} ישויות וטבלת קשר אחת, עם ${S.relations.length} קשרים: <span class="ltr">1:N</span>, <span class="ltr">N:M</span> וקשר רקורסיבי.</p>
        <a class="btn primary" href="erd.html">לצפייה בתרשים ה-ERD</a></div>`;
  }

  /* ---------- List ---------- */
  const searchState = {};
  function viewList(key) {
    const e = ent(key);
    if (!e) return viewHome();
    renderNav(key);
    const rels = relationsFor(key).map(r => {
      const other = r.a === r.b ? 'עצמה' : ent(r.a === key ? r.b : r.a).single;
      return `<span class="rel-badge"><b>${esc(r.label)}</b> · ${esc(other)} (<span class="ltr">${r.card}</span>)</span>`;
    }).join('');

    $('#view').innerHTML = `
      <div class="page-head">
        <div><h1>${esc(e.label)}</h1><p>${esc(e.desc)}</p><div class="badge-line">${rels}</div></div>
        <div class="actions">
          <label class="search">${ICON.search}<input id="q" type="search" placeholder="חיפוש..." value="${esc(searchState[key] || '')}" aria-label="חיפוש"></label>
          <button class="btn primary" id="addBtn" type="button">${ICON.plus} ${esc(e.single)} חדש</button>
        </div>
      </div>
      <div class="card" style="padding:0"><div class="table-wrap" id="tbl"></div></div>`;

    const draw = () => {
      const q = (searchState[key] || '').trim().toLowerCase();
      const rows = db[key].filter(r => !q ||
        e.fields.some(f => {
          const v = f.type === 'ref' ? (findBy(f.ref, r[f.key]) ? titleOf(f.ref, findBy(f.ref, r[f.key])) : r[f.key]) : r[f.key];
          return String(v == null ? '' : v).toLowerCase().includes(q);
        }));
      const comp = e.computed || [];
      $('#tbl').innerHTML = rows.length ? `
        <table class="data"><thead><tr>
          ${e.fields.map(f => `<th>${esc(f.label)}${keyIcons(e, f)}</th>`).join('')}
          ${comp.map(c => `<th>${esc(c.label)} <span class="muted" title="תכונה נגזרת – מחושבת מהתנועות">(מחושב)</span></th>`).join('')}
          <th></th></tr></thead><tbody>
          ${rows.map(r => `<tr data-go="${href(key, r)}">
            ${e.fields.map(f => `<td>${fmt(f, r)}</td>`).join('')}
            ${comp.map(c => `<td>${fmtComputed(c, r)}</td>`).join('')}
            <td class="actions">
              <button class="icon-btn" data-edit="${esc(pkOf(e, r))}" title="עריכה" aria-label="עריכה">${ICON.edit}</button>
              <button class="icon-btn del" data-del="${esc(pkOf(e, r))}" title="מחיקה" aria-label="מחיקה">${ICON.del}</button>
            </td></tr>`).join('')}
          </tbody></table>`
        : `<div class="empty">${q ? 'לא נמצאו רשומות תואמות' : 'אין עדיין רשומות'}</div>`;
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
    renderNav(key);
    const rel = related(key, id);

    const relSections = rel.map(({ e: re, f, rows }) => {
      const cols = re.fields.filter(x => x.key !== f.key);
      const relDef = S.relations.find(x => (x.a === key && x.b === re.key) || (x.b === key && x.a === re.key) ||
        (re.relTable && x.key === 'r_owns'));
      const title = re.key === key ? 'עובדים כפופים (מנוהלים)' : re.label;
      return `<div class="card">
        <h2 class="rel-title"><span class="ent-pill" style="--c:${re.color}"><span class="dot"></span></span>${esc(title)}
          <small>${relDef ? `קשר "${esc(relDef.label)}" · <span class="ltr">${relDef.card}</span>` : ''} · ${rows.length} רשומות</small></h2>
        ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr>
          ${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}${(re.computed || []).map(c => `<th>${esc(c.label)}</th>`).join('')}
          </tr></thead><tbody>
          ${rows.map(x => `<tr data-go="${href(re.key, x)}">${cols.map(c => `<td>${fmt(c, x)}</td>`).join('')}
            ${(re.computed || []).map(c => `<td>${fmtComputed(c, x)}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>` : '<div class="muted">אין רשומות קשורות</div>'}
      </div>`;
    }).join('');

    $('#view').innerHTML = `
      <a class="back" href="#/e/${key}">→ חזרה ל${esc(e.label)}</a>
      <div class="page-head">
        <div><span class="ent-pill" style="--c:${e.color}"><span class="dot"></span>${esc(e.single)}</span>
          <h1>${esc(titleOf(key, r))}</h1></div>
        <div class="actions">
          <button class="btn" id="edBtn" type="button">${ICON.edit} עריכה</button>
          <button class="btn danger" id="dlBtn" type="button">${ICON.del} מחיקה</button>
        </div>
      </div>
      <div class="card"><h2>תכונות (Attributes)</h2>
        <div class="detail-grid">
          ${e.fields.map(f => `<div class="attr"><div class="k">${esc(f.label)}${keyIcons(e, f)}</div><div class="v">${fmt(f, r) || '<span class="muted">—</span>'}</div></div>`).join('')}
          ${(e.computed || []).map(c => `<div class="attr"><div class="k">${esc(c.label)} <span class="muted">(נגזרת)</span></div><div class="v">${fmtComputed(c, r)}</div></div>`).join('')}
        </div></div>
      ${relSections}`;
    $('#edBtn').addEventListener('click', () => openForm(key, r));
    $('#dlBtn').addEventListener('click', () => { if (remove(key, id)) location.hash = `#/e/${key}`; });
  }

  /* ---------- Delete (with referential integrity) ---------- */
  function remove(key, id) {
    const e = ent(key);
    const r = findBy(key, id);
    if (!r) return false;
    const blockers = related(key, id).filter(x => x.rows.length);
    if (blockers.length) {
      toast(`לא ניתן למחוק: קיימות רשומות קשורות (${blockers.map(b => `${b.e.key === key ? 'עובדים כפופים' : b.e.label}: ${b.rows.length}`).join(', ')}). שלמות התייחסות.`, true);
      return false;
    }
    if (!confirm(`למחוק את "${titleOf(key, r)}"?`)) return false;
    db[key] = db[key].filter(x => pkOf(e, x) !== String(id));
    save(); toast(`${e.single} נמחק`);
    if (!location.hash.includes(`/e/${key}/`)) route();
    return true;
  }

  /* ---------- Form ---------- */
  let formCtx = null;
  function nextId(key, field) {
    const max = db[key].reduce((m, r) => Math.max(m, Number(r[field]) || 0), 0);
    return max + 1;
  }
  function inputFor(e, f, rec, isEdit) {
    const v = rec ? rec[f.key] : (f.auto ? nextId(e.key, f.key) : '');
    const isPk = e.pk.includes(f.key);
    const lock = isEdit && isPk;
    const req = f.required ? 'required' : '';
    const id = `f_${f.key}`;
    let ctl;
    if (f.type === 'select') {
      ctl = `<select id="${id}" name="${f.key}" ${req} ${lock ? 'disabled' : ''}><option value="">בחירה...</option>
        ${f.options.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.type === 'ref') {
      const te = ent(f.ref);
      let opts = db[f.ref];
      if (f.ref === e.key && rec) opts = opts.filter(o => pkOf(te, o) !== pkOf(e, rec));
      ctl = `<select id="${id}" name="${f.key}" ${req} ${lock ? 'disabled' : ''}>
        <option value="">${f.required ? 'בחירה...' : '— ללא —'}</option>
        ${opts.map(o => { const k = pkOf(te, o); return `<option value="${esc(k)}" ${String(v) === k ? 'selected' : ''}>${esc(titleOf(f.ref, o))}</option>`; }).join('')}</select>`;
    } else {
      const t = { money: 'number', percent: 'number', number: 'number', date: 'date', email: 'email', tel: 'tel' }[f.type] || 'text';
      const extra = [f.min != null ? `min="${f.min}"` : '', f.max != null ? `max="${f.max}"` : '', f.step ? `step="${f.step}"` : (t === 'number' ? 'step="any"' : ''),
        (lock || f.auto) ? 'readonly' : ''].join(' ');
      ctl = `<input id="${id}" name="${f.key}" type="${t}" value="${esc(v)}" ${req} ${extra} ${t === 'tel' || t === 'email' ? 'dir="ltr" style="text-align:right"' : ''}>`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)} ${f.required ? '<span class="req">*</span>' : ''}${keyIcons(e, f)}</label>
      ${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="err" data-err="${f.key}"></span></div>`;
  }
  function openForm(key, rec) {
    const e = ent(key);
    formCtx = { key, rec };
    $('#dlgTitle').textContent = rec ? `עריכת ${e.single}` : `${e.single} חדש`;
    $('#dlgBody').innerHTML = e.fields.map(f => inputFor(e, f, rec, !!rec)).join('') + '<div class="form-msg" id="formMsg"></div>';
    const d = $('#dlg');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function closeForm() { const d = $('#dlg'); if (d.close) d.close(); else d.removeAttribute('open'); formCtx = null; }

  function readValue(e, f, form) {
    const el = form.elements[f.key];
    let v = el.value.trim();
    if (el.disabled && formCtx.rec) return formCtx.rec[f.key];
    if (v === '') return '';
    if (['number', 'money', 'percent'].includes(f.type)) return Number(v);
    if (f.type === 'ref') {
      const tf = ent(f.ref).fields.find(x => x.key === ent(f.ref).pk[0]);
      return tf.type === 'number' ? Number(v) : v;
    }
    return v;
  }
  function submitForm(ev) {
    ev.preventDefault();
    if (!formCtx) return;
    const { key, rec } = formCtx;
    const e = ent(key);
    const form = $('#dlgForm');
    const data = {};
    let ok = true;
    form.querySelectorAll('[data-err]').forEach(x => { x.textContent = ''; });
    $('#formMsg').textContent = '';
    const err = (k, m) => { ok = false; const x = form.querySelector(`[data-err="${k}"]`); if (x) x.textContent = m; };

    e.fields.forEach(f => {
      const v = readValue(e, f, form);
      data[f.key] = v;
      if (f.required && (v === '' || v == null)) return err(f.key, 'שדה חובה');
      if (v === '') return;
      if (f.pattern && !new RegExp(f.pattern).test(String(v))) err(f.key, `ערך לא תקין (${f.hint || ''})`);
      if (typeof v === 'number' && isNaN(v)) err(f.key, 'יש להזין מספר');
      if (f.min != null && v < f.min) err(f.key, `מינימום ${f.min}`);
      if (f.max != null && v > f.max) err(f.key, `מקסימום ${f.max}`);
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err(f.key, 'כתובת דוא"ל לא תקינה');
    });
    if (!ok) return;

    const newPk = pkOf(e, data);
    const oldPk = rec ? pkOf(e, rec) : null;
    if (newPk !== oldPk && db[key].some(r => pkOf(e, r) === newPk)) {
      $('#formMsg').textContent = e.pk.length > 1
        ? 'צירוף זה כבר קיים (מפתח ראשי משולב חייב להיות ייחודי).'
        : `${e.fields.find(f => f.key === e.pk[0]).label} כבר קיים – מפתח ראשי חייב להיות ייחודי.`;
      return;
    }
    if (rec) Object.assign(rec, data); else db[key].push(data);
    save(); closeForm();
    toast(rec ? 'השינויים נשמרו' : `${e.single} נוסף בהצלחה`);
    route();
  }

  /* ---------- Router ---------- */
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const parts = h.split('/');
    if (parts[0] === 'e' && parts[1] && parts[2] !== undefined && parts[2] !== '') viewDetail(parts[1], parts.slice(2).join('/'));
    else if (parts[0] === 'e' && parts[1]) viewList(parts[1]);
    else viewHome();
    window.scrollTo(0, 0);
  }

  /* ---------- Global events ---------- */
  document.addEventListener('click', ev => {
    const ed = ev.target.closest('[data-edit]');
    const dl = ev.target.closest('[data-del]');
    const key = (location.hash.match(/#\/e\/([^/]+)/) || [])[1];
    if (ed) { ev.stopPropagation(); return openForm(key, findBy(key, ed.dataset.edit)); }
    if (dl) { ev.stopPropagation(); return remove(key, dl.dataset.del); }
    const row = ev.target.closest('tr[data-go]');
    if (row && !ev.target.closest('a')) location.hash = row.dataset.go;
  });
  $('#dlgForm').addEventListener('submit', submitForm);
  $('#dlgCancel').addEventListener('click', closeForm);
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('לאפס את כל הנתונים לנתוני ההדגמה?')) return;
    db = JSON.parse(JSON.stringify(window.SEED)); save(); toast('הנתונים אופסו'); route();
  });
  window.addEventListener('hashchange', route);

  load();
  route();
})();
