/* מעטפת משותפת: אייקונים, תפריט צד ופס עליון – משמשת את שני העמודים */
(function () {
  'use strict';
  const svg = (p, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const P = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    accounts: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    ownerships: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    transactions: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    loans: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    branches: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2 20 7H4z"/>',
    employees: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>',
    erd: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    back: '<path d="m9 18 6-6-6-6"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
    fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  window.ICON = (name, size) => svg(P[name] || '', size);

  /**
   * בניית תפריט הצד.
   * @param {string} active  מפתח הפריט הפעיל ('home' | שם ישות | 'erd')
   * @param {string} base    '' באפליקציה, 'index.html' בעמוד ה-ERD
   * @param {object} counts  מספר רשומות לכל ישות (אופציונלי)
   */
  window.renderSidebar = function (active, base, counts) {
    const S = window.SCHEMA;
    const link = (href, key, label, extra = '') =>
      `<a href="${href}" class="nav-item${active === key ? ' active' : ''}" ${extra}>
        <span class="nav-ic">${ICON(key)}</span><span class="nav-lbl">${label}</span>
        ${counts && counts[key] != null ? `<span class="nav-count">${counts[key]}</span>` : ''}</a>`;
    document.getElementById('sidebar').innerHTML = `
      <a class="brand" href="${base}#/">
        <span class="brand-mark">${ICON('bank', 20)}</span>
        <span><b>ניהול לקוחות</b><small>מערכת בנקאית · הדגמה</small></span>
      </a>
      <div class="nav-sec">ראשי</div>
      ${link(`${base}#/`, 'home', 'לוח בקרה')}
      <div class="nav-sec">ישויות</div>
      ${S.entities.map(e => link(`${base}#/e/${e.key}`, e.key, e.label, `style="--c:${e.color}"`)).join('')}
      <div class="nav-sec">מודל הנתונים</div>
      ${link('erd.html', 'erd', 'תרשים ERD')}
      <div class="side-foot">גרסת הדגמה · נתונים פיקטיביים</div>`;
  };

  // תפריט נייד
  document.addEventListener('click', ev => {
    const app = document.querySelector('.app');
    if (ev.target.closest('#menuBtn')) { app.classList.toggle('nav-open'); return; }
    if (ev.target.closest('.scrim') || ev.target.closest('.nav-item')) app.classList.remove('nav-open');
  });
})();
