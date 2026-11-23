/* איורים מקוריים (SVG) – משותפים לאפליקציה ולעמוד ה-ERD. ללא קבצים חיצוניים. */
(function () {
  'use strict';
  const S = (vb, body, cls) => `<svg class="illus ${cls || ''}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const blob = (fill) => `<path d="M206 48c26 22 34 66 14 94s-74 34-112 26S36 140 30 104 44 30 86 18s94 8 120 30z" fill="${fill}"/>`;
  const sparkle = (x, y, c) => `<path d="M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${c}"/>`;
  const coin = (x, y, r) => `<g><ellipse cx="${x}" cy="${y + 3}" rx="${r}" ry="${r * .45}" fill="#d97706"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .45}" fill="#fbbf24"/><ellipse cx="${x}" cy="${y}" rx="${r * .55}" ry="${r * .22}" fill="none" stroke="#f59e0b" stroke-width="1.5"/></g>`;
  const person = (x, y, c, s) => { s = s || 1; return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-34" r="15" fill="#fde2cf"/><path d="M-15 -40c2-12 28-12 30 0-6-6-24-6-30 0z" fill="#334155"/><path d="M-28 12c0-22 12-32 28-32s28 10 28 32z" fill="${c}"/></g>`; };
  const card = (x, y, rot, c) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="96" height="60" rx="10" fill="${c}"/><rect x="11" y="13" width="19" height="14" rx="3" fill="#fde68a"/><rect x="11" y="40" width="48" height="5" rx="2.5" fill="#fff" opacity=".75"/><circle cx="78" cy="44" r="7" fill="#fff" opacity=".35"/><circle cx="70" cy="44" r="7" fill="#fff" opacity=".25"/></g>`;

  window.ILLUS = {
    /* פס הפתיחה – על רקע כהה */
    bank: S('0 0 320 220', `
      <ellipse cx="160" cy="204" rx="136" ry="11" fill="#000" opacity=".18"/>
      <path d="M66 84 160 36l94 48z" fill="#e0e7ff"/><path d="M160 36l94 48H160z" fill="#c7d2fe"/>
      <circle cx="160" cy="68" r="9" fill="#fbbf24"/><circle cx="160" cy="68" r="4" fill="#f59e0b"/>
      <rect x="74" y="84" width="172" height="11" rx="2" fill="#a5b4fc"/>
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${88 + i * 32}" y="97" width="16" height="72" rx="3" fill="#fff"/><rect x="${88 + i * 32}" y="97" width="5" height="72" fill="#e0e7ff"/>`).join('')}
      <rect x="68" y="169" width="184" height="12" rx="2" fill="#c7d2fe"/><rect x="58" y="181" width="204" height="12" rx="2" fill="#a5b4fc"/>
      ${card(214, 118, -14, '#14b8a6')}
      ${coin(46, 176, 17)}${coin(46, 166, 17)}${coin(46, 156, 17)}${coin(76, 184, 13)}
      <path d="M268 64l18-18 12 12 18-22" fill="none" stroke="#86efac" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M306 34h12v12" fill="none" stroke="#86efac" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      ${sparkle(34, 64, '#fde68a')}${sparkle(288, 140, '#bfdbfe')}${sparkle(118, 24, '#fff')}`, 'il-bank'),

    customers: S('0 0 240 170', `${blob('#dbeafe')}
      ${person(96, 128, '#3b82f6', 1.15)}${person(152, 134, '#14b8a6', 1)}
      <rect x="168" y="44" width="52" height="34" rx="8" fill="#fff" stroke="#bfdbfe" stroke-width="2"/><circle cx="182" cy="58" r="6" fill="#93c5fd"/><rect x="192" y="54" width="20" height="4" rx="2" fill="#bfdbfe"/><rect x="192" y="62" width="14" height="4" rx="2" fill="#dbeafe"/>
      ${sparkle(42, 46, '#fbbf24')}${sparkle(214, 116, '#93c5fd')}`),

    accounts: S('0 0 240 170', `${blob('#ccfbf1')}
      ${card(60, 70, -16, '#8b5cf6')}${card(74, 62, -6, '#3b82f6')}${card(92, 58, 6, '#14b8a6')}
      ${coin(196, 136, 14)}${coin(196, 127, 14)}${sparkle(48, 40, '#fbbf24')}${sparkle(210, 50, '#5eead4')}`),

    ownerships: S('0 0 240 170', `${blob('#ede9fe')}
      ${card(110, 64, 8, '#8b5cf6')}
      <g transform="translate(46 70) rotate(-28)"><circle cx="20" cy="20" r="18" fill="#fbbf24"/><circle cx="20" cy="20" r="7" fill="#ede9fe"/><rect x="34" y="15" width="52" height="10" rx="4" fill="#fbbf24"/><rect x="70" y="25" width="7" height="12" rx="2" fill="#fbbf24"/><rect x="58" y="25" width="7" height="9" rx="2" fill="#fbbf24"/></g>
      <path d="M96 112c10 14 22 18 34 14" fill="none" stroke="#a78bfa" stroke-width="3" stroke-dasharray="5 6" stroke-linecap="round"/>
      ${sparkle(206, 40, '#c4b5fd')}${sparkle(40, 138, '#fbbf24')}`),

    transactions: S('0 0 240 170', `${blob('#fef3c7')}
      <path d="M70 70a52 52 0 0 1 90-18" fill="none" stroke="#f59e0b" stroke-width="10" stroke-linecap="round"/><path d="M152 34l14 20-24 4z" fill="#f59e0b"/>
      <path d="M170 104a52 52 0 0 1-90 18" fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round"/><path d="M88 140l-14-20 24-4z" fill="#3b82f6"/>
      ${coin(120, 90, 18)}${sparkle(44, 120, '#fbbf24')}${sparkle(204, 50, '#93c5fd')}`),

    loans: S('0 0 240 170', `${blob('#ffe4e6')}
      <path d="M62 86l58-46 58 46" fill="#fb7185"/><rect x="72" y="84" width="96" height="62" rx="4" fill="#fff"/><rect x="72" y="84" width="96" height="10" fill="#fecdd3"/>
      <rect x="108" y="110" width="24" height="36" rx="3" fill="#f43f5e"/><rect x="82" y="102" width="18" height="16" rx="2" fill="#bfdbfe"/><rect x="140" y="102" width="18" height="16" rx="2" fill="#bfdbfe"/>
      <circle cx="184" cy="52" r="22" fill="#f43f5e"/><path d="M175 61l18-18" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="176" cy="45" r="4" fill="#fff"/><circle cx="192" cy="59" r="4" fill="#fff"/>
      ${coin(44, 132, 13)}${sparkle(40, 50, '#fbbf24')}`),

    branches: S('0 0 240 170', `${blob('#e0e7ff')}
      <rect x="64" y="58" width="78" height="88" rx="5" fill="#fff"/><rect x="64" y="58" width="78" height="14" rx="5" fill="#6366f1"/>
      ${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${74 + c * 22}" y="${80 + r * 18}" width="14" height="11" rx="2" fill="#c7d2fe"/>`).join('')).join('')}
      <rect x="94" y="128" width="18" height="18" rx="2" fill="#818cf8"/>
      <path d="M180 96c-16-18-22-28-22-38a22 22 0 0 1 44 0c0 10-6 20-22 38z" fill="#f43f5e"/><circle cx="180" cy="58" r="8" fill="#fff"/>
      <ellipse cx="180" cy="148" rx="26" ry="6" fill="#c7d2fe"/>${sparkle(40, 44, '#fbbf24')}`),

    erd: S('0 0 240 170', `${blob('#e0e7ff')}
      <path d="M70 70L120 100M170 70L120 100M120 100v30" stroke="#64748b" stroke-width="3"/>
      <rect x="34" y="50" width="72" height="34" rx="5" fill="#fff8e8" stroke="#c9802b" stroke-width="3"/>
      <rect x="134" y="50" width="72" height="34" rx="5" fill="#fff8e8" stroke="#c9802b" stroke-width="3"/>
      <path d="M120 82l24 18-24 18-24-18z" fill="#e4f0fb" stroke="#2b4f9e" stroke-width="3"/>
      <ellipse cx="120" cy="140" rx="30" ry="13" fill="#eef6e7" stroke="#5c9a4b" stroke-width="3"/>
      ${sparkle(212, 120, '#fbbf24')}${sparkle(30, 128, '#93c5fd')}`),

    empty: S('0 0 200 140', `<ellipse cx="100" cy="122" rx="70" ry="8" fill="#e2e8f0"/>
      <path d="M50 60l50-22 50 22v50l-50 20-50-20z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/><path d="M50 60l50 20 50-20M100 80v50" fill="none" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M50 60l-14 18 50 20 14-18zM150 60l14 18-50 20-14-18z" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>
      ${sparkle(150, 30, '#fbbf24')}${sparkle(46, 36, '#93c5fd')}`, 'il-empty')
  };
})();
