/* עמוד ה-ERD – תרשים בסימון Chen (מלבן = ישות, מעוין = קשר, אליפסה = תכונה) */
(function () {
  'use strict';
  const S = window.SCHEMA;
  const ent = k => S.entities.find(e => e.key === k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);

  /* ---------- מעטפת ---------- */
  renderSidebar('erd', 'index.html');
  $('crumbs').innerHTML = `<a href="index.html#/">לוח בקרה</a>${ICON('back', 14)}<b>תרשים ERD</b>`;
  $('menuBtn').innerHTML = ICON('menu', 20);
  $('today').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('erdTile').innerHTML = ICON('erd', 16);
  $('zoomIn').innerHTML = ICON('zoomIn', 18); $('zoomOut').innerHTML = ICON('zoomOut', 18); $('zoomFit').innerHTML = ICON('fit', 18);

  /* ---------- פריסה ---------- */
  const W = 1460, H = 1020, EW = 140, EH = 52, DW = 66, DH = 34;
  const L = {
    customers:    { x: 1180, y: 520, attrs: { customerId: [1345, 440], fullName: [1372, 522], phone: [1345, 604], email: [1240, 405], joinDate: [1330, 690] } },
    accounts:     { x: 580,  y: 520, attrs: { accountNo: [465, 630], type: [590, 662], openDate: [700, 630], status: [500, 412], currency: [614, 404] } },
    transactions: { x: 170,  y: 520, attrs: { txnId: [105, 418], type: [240, 418], date: [72, 622], amount: [190, 650], description: [305, 622] } },
    loans:        { x: 1180, y: 880, attrs: { loanId: [1015, 828], purpose: [1005, 918], amount: [1090, 988], rate: [1275, 988], startDate: [1352, 918], months: [1345, 828] } },
    branches:     { x: 880,  y: 200, attrs: { branchId: [762, 92], name: [880, 64], city: [998, 92], phone: [1040, 192] } }
  };
  const R = {
    r_owns:        { x: 880,  y: 520, attrs: [['סוג בעלות', 826, 648], ['תאריך צירוף', 955, 628]] },
    r_cust_branch: { x: 1030, y: 360 },
    r_acc_branch:  { x: 730,  y: 360 },
    r_txn:         { x: 375,  y: 520 },
    r_loan:        { x: 1180, y: 700 }
  };
  const rx = t => Math.max(42, t.length * 4.1 + 18);
  const P = { lines: [], attrs: [], labels: [], shapes: [] };

  /* צבעי הסגנון: ישות כתומה, קשר כחול, תכונה ירוקה, (min,max) באדום */
  const C = { entF: '#fff8e8', entS: '#c9802b', relF: '#e4f0fb', relS: '#2b4f9e', atF: '#eef6e7', atS: '#5c9a4b', ln: '#555' };
  const LRI = '\u2066', PDI = '\u2069';
  const badge = (x, y, t) => !t ? '' : `<text class="mm" x="${x}" y="${y + 5}" text-anchor="middle">${LRI}${t}${PDI}</text>`;
  function cardLabel(ex, ey, tx, ty, text) {
    const dx = tx - ex, dy = ty - ey, len = Math.hypot(dx, dy) || 1;
    const tEdge = Math.min(Math.abs((EW / 2) / (dx || 1e-9)), Math.abs((EH / 2) / (dy || 1e-9)));
    const t = Math.min(tEdge + 32 / len, 0.5);
    const px = ex + dx * t, py = ey + dy * t, nx = -dy / len, ny = dx / len;
    return badge(px + nx * 20, py + ny * 20, text);
  }

  // ישויות + תכונות (שדות שאינם מפתח זר)
  Object.keys(L).forEach(k => {
    const e = ent(k), p = L[k];
    e.fields.filter(f => f.type !== 'ref').forEach(f => {
      const pos = p.attrs[f.key]; if (!pos) return;
      const [ax, ay] = pos, pk = e.pk.includes(f.key);
      P.lines.push(`<line class="ln attr-ln" data-n="A:${k}" x1="${p.x}" y1="${p.y}" x2="${ax}" y2="${ay}"/>`);
      P.attrs.push(`<g class="attr${pk ? ' pk' : ''}" data-n="A:${k}">
        <ellipse cx="${ax}" cy="${ay}" rx="${rx(f.label)}" ry="20" fill="${C.atF}" stroke="${C.atS}"/>
        <text x="${ax}" y="${ay + 4.5}" text-anchor="middle" direction="rtl">${esc(f.label)}</text>
        <title>${esc(f.label)}${pk ? ' – מפתח ראשי' : ''}</title></g>`);
    });
    P.shapes.push(`<g class="ent clickable" data-n="E:${k}" data-sel="E:${k}">
      <rect class="box" x="${p.x - EW / 2}" y="${p.y - EH / 2}" width="${EW}" height="${EH}" rx="5" fill="${C.entF}" stroke="${C.entS}"/>
      <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" direction="rtl" fill="#1f1a14">${esc(e.single)}</text>
      <title>${esc(e.single)} – ${esc(e.desc)}</title></g>`);
  });

  // קשרים
  S.relations.forEach(r => {
    const p = R[r.key], n = `R:${r.key}`, A = L[r.a], B = L[r.b];
    if (r.a === r.b) {
      // קשר רקורסיבי בסגנון הדוגמה: קשת מצד הישות + קו ישר, עם שמות התפקידים
      const lx = A.x - EW / 2, by = A.y + EH / 2;
      P.lines.push(`<path class="ln" data-n="E:${r.a} ${n}" d="M ${lx} ${A.y} C ${lx - 95} ${A.y} ${p.x - DW - 95} ${p.y} ${p.x - DW} ${p.y}"/>`);
      P.lines.push(`<line class="ln" data-n="E:${r.a} ${n}" x1="${A.x}" y1="${by}" x2="${p.x}" y2="${p.y - DH}"/>`);
      P.labels.push(`<g data-n="E:${r.a} ${n}">${badge(lx - 34, A.y - 12, r.pA)}${badge(A.x + 34, by + 26, r.pB)}
        <text class="role" x="${lx - 62}" y="${(A.y + p.y) / 2 + 4}" text-anchor="middle" direction="rtl">${esc(r.roles[0])}</text>
        <text class="role" x="${A.x + 40}" y="${(by + p.y - DH) / 2 + 22}" text-anchor="start" direction="ltr">${esc(r.roles[1])}</text></g>`);
    } else {
      P.lines.push(`<line class="ln" data-n="E:${r.a} ${n}" x1="${A.x}" y1="${A.y}" x2="${p.x}" y2="${p.y}"/>`);
      P.lines.push(`<line class="ln" data-n="E:${r.b} ${n}" x1="${B.x}" y1="${B.y}" x2="${p.x}" y2="${p.y}"/>`);
      P.labels.push(`<g data-n="E:${r.a} ${n}">${cardLabel(A.x, A.y, p.x, p.y, r.pA)}</g>`);
      P.labels.push(`<g data-n="E:${r.b} ${n}">${cardLabel(B.x, B.y, p.x, p.y, r.pB)}</g>`);
    }
    (p.attrs || []).forEach(([label, ax, ay]) => {
      P.lines.push(`<line class="ln attr-ln" data-n="A:${r.key}" x1="${p.x}" y1="${p.y}" x2="${ax}" y2="${ay}"/>`);
      P.attrs.push(`<g class="attr" data-n="A:${r.key}"><ellipse cx="${ax}" cy="${ay}" rx="${rx(label)}" ry="20" fill="${C.atF}" stroke="${C.atS}"/>
        <text x="${ax}" y="${ay + 4.5}" text-anchor="middle" direction="rtl">${esc(label)}</text><title>תכונה של הקשר "${esc(r.label)}"</title></g>`);
    });
    P.shapes.push(`<g class="rel clickable" data-n="${n}" data-sel="${n}">
      <polygon points="${p.x},${p.y - DH} ${p.x + DW},${p.y} ${p.x},${p.y + DH} ${p.x - DW},${p.y}" fill="${C.relF}" stroke="${C.relS}"/>
      <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" direction="rtl" fill="${C.relS}">${esc(r.label)}</text>
      <title>${esc(r.text)} (${r.card})</title></g>`);
  });

  const canvas = $('canvas');
  canvas.innerHTML = `<svg id="erd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Heebo, Arial, sans-serif" role="img" aria-label="תרשים ישויות-קשרים בסימון Chen">
    ${P.lines.join('')}${P.attrs.join('')}${P.shapes.join('')}${P.labels.join('')}</svg>`;
  const svgEl = $('erd');

  /* ---------- מקרא ---------- */
  $('legend').innerHTML = `
    <span class="item"><svg width="42" height="24"><rect x="1.5" y="2" width="39" height="20" rx="3" fill="${C.entF}" stroke="${C.entS}" stroke-width="2"/></svg>ישות</span>
    <span class="item"><svg width="42" height="26"><polygon points="21,2 40,13 21,24 2,13" fill="${C.relF}" stroke="${C.relS}" stroke-width="2"/></svg>קשר</span>
    <span class="item"><svg width="46" height="24"><ellipse cx="23" cy="12" rx="21" ry="10" fill="${C.atF}" stroke="${C.atS}" stroke-width="1.6"/></svg>תכונה</span>
    <span class="item"><svg width="46" height="24"><ellipse cx="23" cy="12" rx="21" ry="10" fill="${C.atF}" stroke="${C.atS}" stroke-width="1.6"/><text x="23" y="16" text-anchor="middle" font-size="10" font-weight="700" text-decoration="underline">מזהה</text></svg>מפתח ראשי</span>
    <span class="item"><b class="ltr" style="color:#a2332a">(min,max)</b>&nbsp;השתתפות הישות בקשר – למשל <b class="ltr" style="color:#a2332a">(1,N)</b> = לפחות אחד ועד N</span>
`;

  /* ---------- הדגשה ---------- */
  const info = $('selInfo'), clearBtn = $('clearSel'), DEFAULT_INFO = info.textContent;
  function select(id) {
    if (!id) {
      svgEl.classList.remove('focus'); svgEl.querySelectorAll('.dim').forEach(x => x.classList.remove('dim'));
      info.textContent = DEFAULT_INFO; clearBtn.hidden = true; return;
    }
    const active = new Set([id]);
    const [kind, key] = id.split(':');
    if (kind === 'E') {
      active.add('A:' + key);
      const rels = S.relations.filter(r => r.a === key || r.b === key);
      // הישות, הקשרים הישירים שלה, הישויות המחוברות – וגם התכונות של כולן (כולל תכונות הקשר)
      rels.forEach(r => {
        ['R:' + r.key, 'A:' + r.key, 'E:' + r.a, 'E:' + r.b, 'A:' + r.a, 'A:' + r.b].forEach(t => active.add(t));
      });
      info.innerHTML = `<b style="color:var(--ink)">${esc(ent(key).single)}</b> · ${rels.map(r => `${esc(r.label)} <span class="ltr">${r.card}</span>`).join(' · ')}`;
    } else {
      const r = S.relations.find(x => x.key === key);
      ['A:' + key, 'E:' + r.a, 'E:' + r.b, 'A:' + r.a, 'A:' + r.b].forEach(t => active.add(t));
      info.innerHTML = `<b style="color:var(--ink)">${esc(r.label)}</b> · ${esc(r.text)} (<span class="ltr">${r.card}</span>)`;
    }
    svgEl.classList.add('focus'); clearBtn.hidden = false;
    svgEl.querySelectorAll('[data-n]').forEach(el => el.classList.toggle('dim', !el.dataset.n.split(' ').every(t => active.has(t))));
  }
  svgEl.addEventListener('click', ev => { const g = ev.target.closest('[data-sel]'); select(g ? g.dataset.sel : null); });
  clearBtn.addEventListener('click', () => select(null));

  /* ---------- זום ותכונות ---------- */
  let scale = 1;
  const apply = () => { svgEl.setAttribute('width', W * scale); svgEl.setAttribute('height', H * scale); };
  const fit = () => { scale = Math.max(0.55, Math.min(1, (canvas.clientWidth - 4) / W)); apply(); };
  $('zoomIn').addEventListener('click', () => { scale = Math.min(2.5, scale * 1.2); apply(); });
  $('zoomOut').addEventListener('click', () => { scale = Math.max(0.3, scale / 1.2); apply(); });
  $('zoomFit').addEventListener('click', fit);
  const tBtn = $('toggleAttrs');
  const setT = off => { tBtn.innerHTML = `${ICON('eye', 16)} ${off ? 'הצגת תכונות' : 'הסתרת תכונות'}`; };
  setT(false);
  tBtn.addEventListener('click', () => setT(svgEl.classList.toggle('no-attrs')));
  fit();
  window.addEventListener('resize', () => { if (scale <= 1) fit(); });

  /* ---------- טבלת קשרים ---------- */
  const chip = k => { const e = ent(k); return `<span class="chip" style="--c:${e.color}">${esc(e.single)}</span>`; };
  $('relCount').textContent = `${S.relations.length} קשרים`;
  $('relTable').innerHTML = `
    <thead><tr><th>קשר</th><th>ישויות</th><th>עוצמה</th><th>דרגה</th><th>השתתפות (min,max)</th><th>מימוש בטבלאות</th></tr></thead>
    <tbody>${S.relations.map(r => `<tr>
      <td><b>${esc(r.label)}</b>${r.attrs ? `<div class="muted" style="font-size:12.5px;margin-top:2px">תכונות: ${r.attrs.map(esc).join(', ')}</div>` : ''}</td>
      <td><span class="ent-pair">${chip(r.a)}${r.a === r.b ? '<span class="muted">↺</span>' : ''}${r.a === r.b ? '' : chip(r.b)}</span></td>
      <td><span class="rel-type">${r.card}</span></td><td>${esc(r.degree)}</td>
      <td style="white-space:normal"><div>${esc(r.part[0])} <span class="rel-type mmc">${r.pA}</span></div><div style="margin-top:4px">${esc(r.part[1])} <span class="rel-type mmc">${r.pB}</span></div></td>
      <td class="muted">${esc(r.impl)}</td></tr>`).join('')}</tbody>`;

  /* ---------- סכמה יחסית ---------- */
  const plural = e => e.en === 'Branch' ? 'Branches' : e.en + 's';
  $('schemaGrid').innerHTML = S.entities.map(e => `
    <div class="schema-tbl" style="--c:${e.color}">
      <div class="h"><span class="tile">${ICON(e.key, 16)}</span><b>${esc(e.label)}</b>${e.relTable ? '<span class="count-pill">טבלת קשר</span>' : ''}<small>${plural(e)}</small></div>
      <ul>${e.fields.map(f => {
        const pk = e.pk.includes(f.key);
        return `<li>${pk ? '<span class="key-ic pk">PK</span>' : ''}${f.type === 'ref' ? '<span class="key-ic fk">FK</span>' : ''}
          <span${pk ? ' style="text-decoration:underline;font-weight:600"' : ''}>${esc(f.label)}</span>
          ${f.type === 'ref' ? `<span class="ref">← ${esc(ent(f.ref).label)}</span>` : ''}</li>`;
      }).join('')}</ul></div>`).join('');
})();
