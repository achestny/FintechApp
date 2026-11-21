/* עמוד ה-ERD – ציור תרשים Chen ב-SVG מתוך מודל הנתונים המשותף */
(function () {
  'use strict';
  const S = window.SCHEMA;
  const ent = k => S.entities.find(e => e.key === k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const W = 1460, H = 1020;          // גודל לוח הציור
  const EW = 136, EH = 50;           // ישות
  const DW = 64, DH = 33;            // חצי רוחב/גובה מעוין

  /* מיקומי ישויות ותכונות (תכונות = שדות שאינם מפתח זר) */
  const L = {
    customers:    { x: 1180, y: 520, attrs: { customerId: [1345, 440], fullName: [1372, 522], phone: [1345, 604], email: [1240, 405], joinDate: [1330, 690] } },
    accounts:     { x: 580,  y: 520, attrs: { accountNo: [465, 630], type: [590, 662], openDate: [690, 628], status: [492, 420], balance: [606, 402] } },
    transactions: { x: 170,  y: 520, attrs: { txnId: [105, 418], type: [240, 418], date: [72, 622], amount: [190, 650], description: [305, 622] } },
    loans:        { x: 1180, y: 880, attrs: { loanId: [1015, 828], purpose: [1005, 918], amount: [1090, 988], rate: [1275, 988], startDate: [1352, 918], months: [1345, 828] } },
    branches:     { x: 880,  y: 200, attrs: { branchId: [762, 92], name: [880, 64], city: [998, 92], phone: [1040, 192] } },
    employees:    { x: 380,  y: 200, attrs: { empId: [258, 96], fullName: [380, 68], role: [502, 96], hireDate: [222, 205] } }
  };
  const R = {
    r_owns:        { x: 880,  y: 520, attrs: [['סוג בעלות', 830, 648], ['תאריך צירוף', 955, 628]] },
    r_cust_branch: { x: 1030, y: 360 },
    r_acc_branch:  { x: 730,  y: 360 },
    r_txn:         { x: 375,  y: 520 },
    r_loan:        { x: 1180, y: 700 },
    r_emp_branch:  { x: 630,  y: 200 },
    r_manages:     { x: 380,  y: 362 }
  };

  const rx = t => Math.max(42, t.length * 4.1 + 18);
  const parts = { lines: [], attrs: [], shapes: [], labels: [] };

  function cardLabel(ex, ey, tx, ty, text) {
    // נקודה ליד גבול הישות לאורך הקו לכיוון המעוין
    const dx = tx - ex, dy = ty - ey, len = Math.hypot(dx, dy) || 1;
    const tEdge = Math.min(Math.abs((EW / 2) / (dx || 1e-9)), Math.abs((EH / 2) / (dy || 1e-9)));
    const t = Math.min(tEdge + 16 / len, 0.5);
    const px = ex + dx * t, py = ey + dy * t;
    const nx = -dy / len, ny = dx / len;               // ניצב לקו
    return `<text class="card" x="${px + nx * 11}" y="${py + ny * 11 + 5}" text-anchor="middle">${text}</text>`;
  }

  /* ---- ישויות ותכונותיהן ---- */
  Object.keys(L).forEach(k => {
    const e = ent(k), p = L[k];
    const fields = e.fields.filter(f => f.type !== 'ref').map(f => ({ key: f.key, label: f.label, pk: e.pk.includes(f.key) }))
      .concat((e.computed || []).map(c => ({ key: c.key, label: c.label, derived: true })));
    fields.forEach(f => {
      const pos = p.attrs[f.key]; if (!pos) return;
      const [ax, ay] = pos;
      parts.lines.push(`<line class="ln attr-ln" data-n="A:${k}" x1="${p.x}" y1="${p.y}" x2="${ax}" y2="${ay}"/>`);
      parts.attrs.push(`<g class="attr${f.pk ? ' pk' : ''}${f.derived ? ' derived' : ''}" data-n="A:${k}">
        <ellipse cx="${ax}" cy="${ay}" rx="${rx(f.label)}" ry="19" stroke="${e.color}"/>
        <text x="${ax}" y="${ay + 4.5}" text-anchor="middle" direction="rtl">${esc(f.label)}</text>
        <title>${esc(f.label)}${f.pk ? ' – מפתח ראשי' : ''}${f.derived ? ' – תכונה נגזרת (מחושבת מהתנועות)' : ''}</title></g>`);
    });
    parts.shapes.push(`<g class="ent clickable" data-n="E:${k}" data-sel="E:${k}">
      <rect x="${p.x - EW / 2}" y="${p.y - EH / 2}" width="${EW}" height="${EH}" rx="4" stroke="${e.color}"/>
      <rect x="${p.x - EW / 2}" y="${p.y - EH / 2}" width="6" height="${EH}" fill="${e.color}" stroke="none"/>
      <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" direction="rtl" fill="${e.color}">${esc(e.single)}</text>
      <title>${esc(e.single)} (${e.en}) – לחצו להדגשה</title></g>`);
  });

  /* ---- קשרים ---- */
  S.relations.forEach(r => {
    const p = R[r.key];
    const n = `R:${r.key}`;
    const A = L[r.a], B = L[r.b];
    if (r.a === r.b) {
      // קשר רקורסיבי: שתי זרועות מאותה ישות
      const by = A.y + EH / 2;
      parts.lines.push(`<path class="ln" data-n="E:${r.a} ${n}" d="M ${A.x - 34} ${by} Q ${A.x - 92} ${p.y - 30} ${p.x - DW} ${p.y}"/>`);
      parts.lines.push(`<path class="ln" data-n="E:${r.a} ${n}" d="M ${A.x + 34} ${by} Q ${A.x + 92} ${p.y - 30} ${p.x + DW} ${p.y}"/>`);
      parts.labels.push(`<g data-n="E:${r.a} ${n}">
        <text class="card" x="${A.x - 66}" y="${by + 30}" text-anchor="middle">${r.cardA}</text>
        <text class="role" x="${A.x - 104}" y="${by + 54}" text-anchor="middle" direction="rtl">${esc(r.roles[0])}</text>
        <text class="card" x="${A.x + 66}" y="${by + 30}" text-anchor="middle">${r.cardB}</text>
        <text class="role" x="${A.x + 106}" y="${by + 54}" text-anchor="middle" direction="rtl">${esc(r.roles[1])}</text></g>`);
    } else {
      parts.lines.push(`<line class="ln" data-n="E:${r.a} ${n}" x1="${A.x}" y1="${A.y}" x2="${p.x}" y2="${p.y}"/>`);
      parts.lines.push(`<line class="ln" data-n="E:${r.b} ${n}" x1="${B.x}" y1="${B.y}" x2="${p.x}" y2="${p.y}"/>`);
      parts.labels.push(`<g data-n="E:${r.a} ${n}">${cardLabel(A.x, A.y, p.x, p.y, r.cardA)}</g>`);
      parts.labels.push(`<g data-n="E:${r.b} ${n}">${cardLabel(B.x, B.y, p.x, p.y, r.cardB)}</g>`);
    }
    (p.attrs || []).forEach(([label, ax, ay]) => {
      parts.lines.push(`<line class="ln attr-ln" data-n="A:${r.key}" x1="${p.x}" y1="${p.y}" x2="${ax}" y2="${ay}"/>`);
      parts.attrs.push(`<g class="attr" data-n="A:${r.key}"><ellipse cx="${ax}" cy="${ay}" rx="${rx(label)}" ry="19" stroke="#16325c"/>
        <text x="${ax}" y="${ay + 4.5}" text-anchor="middle" direction="rtl">${esc(label)}</text><title>תכונה של הקשר "${esc(r.label)}"</title></g>`);
    });
    parts.shapes.push(`<g class="rel clickable" data-n="${n}" data-sel="${n}">
      <polygon points="${p.x},${p.y - DH} ${p.x + DW},${p.y} ${p.x},${p.y + DH} ${p.x - DW},${p.y}" stroke="#16325c"/>
      <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" direction="rtl" fill="#16325c">${esc(r.label)}</text>
      <title>${esc(r.text)} (${r.card})</title></g>`);
  });

  const svg = `<svg id="erd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Heebo, Arial, sans-serif" role="img" aria-label="תרשים ישויות-קשרים של מערכת ניהול לקוחות בנק">
    ${parts.lines.join('')}${parts.attrs.join('')}${parts.labels.join('')}${parts.shapes.join('')}</svg>`;
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = svg;
  const svgEl = document.getElementById('erd');

  /* ---- הדגשה בלחיצה ---- */
  const info = document.getElementById('selInfo');
  function select(id) {
    if (!id) { svgEl.classList.remove('focus'); svgEl.querySelectorAll('.dim').forEach(x => x.classList.remove('dim')); info.textContent = 'לא נבחר רכיב'; return; }
    const active = new Set([id]);
    const [kind, key] = id.split(':');
    if (kind === 'E') {
      active.add('A:' + key);
      S.relations.filter(r => r.a === key || r.b === key).forEach(r => { active.add('R:' + r.key); active.add('E:' + r.a); active.add('E:' + r.b); });
      const e = ent(key);
      const rels = S.relations.filter(r => r.a === key || r.b === key).map(r => `${r.label} (${r.card})`).join(' · ');
      info.textContent = `${e.single}: ${rels}`;
    } else {
      const r = S.relations.find(x => x.key === key);
      active.add('A:' + key); active.add('E:' + r.a); active.add('E:' + r.b);
      info.textContent = `${r.label} – ${r.text} (${r.card})`;
    }
    svgEl.classList.add('focus');
    svgEl.querySelectorAll('[data-n]').forEach(el => {
      const ok = el.dataset.n.split(' ').every(t => active.has(t));
      el.classList.toggle('dim', !ok);
    });
  }
  svgEl.addEventListener('click', ev => {
    const g = ev.target.closest('[data-sel]');
    select(g ? g.dataset.sel : null);
  });
  document.getElementById('clearSel').addEventListener('click', () => select(null));

  /* ---- זום ---- */
  let scale = 1;
  const apply = () => { svgEl.setAttribute('width', W * scale); svgEl.setAttribute('height', H * scale); };
  const fit = () => { scale = Math.min(1, (canvas.clientWidth - 4) / W); apply(); };
  document.getElementById('zoomIn').addEventListener('click', () => { scale = Math.min(2.5, scale * 1.2); apply(); });
  document.getElementById('zoomOut').addEventListener('click', () => { scale = Math.max(0.3, scale / 1.2); apply(); });
  document.getElementById('zoomFit').addEventListener('click', fit);
  const tBtn = document.getElementById('toggleAttrs');
  tBtn.addEventListener('click', () => {
    const off = svgEl.classList.toggle('no-attrs');
    tBtn.textContent = off ? 'הצגת תכונות' : 'הסתרת תכונות';
  });
  fit();
  // במסך צר – לא להקטין מתחת לגודל קריא; ניתן לגלול
  if (scale < 0.55) { scale = 0.55; apply(); }

  /* ---- טבלת קשרים ---- */
  const chip = k => { const e = ent(k); return `<span class="chip" style="--c:${e.color}">${esc(e.single)}</span>`; };
  document.getElementById('relTable').innerHTML = `
    <thead><tr><th>קשר</th><th>ישויות</th><th>עוצמה</th><th>דרגה</th><th>משמעות</th><th>מימוש בטבלאות</th></tr></thead>
    <tbody>${S.relations.map(r => `<tr>
      <td><b>${esc(r.label)}</b>${r.attrs ? `<div class="muted" style="font-size:13px">תכונות: ${r.attrs.map(esc).join(', ')}</div>` : ''}</td>
      <td>${chip(r.a)} ${r.a === r.b ? '↺' : '–'} ${chip(r.b)}</td>
      <td><b class="ltr">${r.card}</b></td><td>${esc(r.degree)}</td>
      <td>${esc(r.text)}</td><td>${esc(r.impl)}</td></tr>`).join('')}</tbody>`;

  /* ---- סכמה יחסית ---- */
  document.getElementById('schemaGrid').innerHTML = S.entities.map(e => `
    <div class="schema-tbl">
      <div class="h" style="background:${e.color}"><span>${esc(e.label)}${e.relTable ? ' · טבלת קשר' : ''}</span><small>${e.en === 'Branch' ? 'Branches' : e.en + 's'}</small></div>
      <ul>${e.fields.map(f => `<li>
          ${e.pk.includes(f.key) ? '<span class="key-ic pk">PK</span>' : ''}${f.type === 'ref' ? '<span class="key-ic fk">FK</span>' : ''}
          <span${e.pk.includes(f.key) ? ' style="text-decoration:underline;font-weight:600"' : ''}>${esc(f.label)}</span>
          ${f.type === 'ref' ? `<span class="ref">← ${esc(ent(f.ref).label)}</span>` : ''}</li>`).join('')}
        ${(e.computed || []).map(c => `<li class="der">${esc(c.label)} <span class="ref">נגזרת – לא נשמרת, מחושבת</span></li>`).join('')}
      </ul></div>`).join('');
})();
