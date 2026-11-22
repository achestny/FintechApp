/* ============================================================
   מודל הנתונים – משותף לאפליקציה ולעמוד ה-ERD
   ישויות, תכונות (attributes), מפתחות ראשיים/זרים וקשרים
   ============================================================ */
window.SCHEMA = {
  entities: [
    {
      key: 'customers', label: 'לקוחות', single: 'לקוח', en: 'Customer', color: '#3b82f6',
      desc: 'הלקוחות של הבנק. כל לקוח משויך לסניף אחד, יכול להחזיק בכמה חשבונות ולקחת הלוואות.',
      pk: ['customerId'],
      fields: [
        { key: 'customerId', label: 'תעודת זהות', type: 'text', required: true, pattern: '^\\d{9}$', idCheck: true, hint: '9 ספרות, כולל ספרת ביקורת' },
        { key: 'fullName', label: 'שם מלא', type: 'text', required: true },
        { key: 'phone', label: 'טלפון', type: 'tel', required: true, pattern: '^0\\d{1,2}-?\\d{7}$', hint: 'לדוגמה 050-1234567' },
        { key: 'email', label: 'דוא"ל', type: 'email' },
        { key: 'joinDate', label: 'תאריך הצטרפות', type: 'date', required: true, noFuture: true },
        { key: 'branchId', label: 'סניף', type: 'ref', ref: 'branches', required: true }
      ],
      title: r => r.fullName
    },
    {
      key: 'accounts', label: 'חשבונות', single: 'חשבון', en: 'Account', color: '#14b8a6',
      desc: 'חשבונות הבנק. חשבון מתנהל בסניף אחד, מנוהל במטבע אחד (שקל, דולר או אירו) ויכול להיות משותף לכמה לקוחות. היתרה מחושבת מהתנועות.',
      pk: ['accountNo'],
      fields: [
        { key: 'accountNo', label: 'מספר חשבון', type: 'number', required: true, auto: true },
        { key: 'type', label: 'סוג חשבון', type: 'select', required: true, options: ['עו"ש', 'חיסכון', 'פיקדון', 'עסקי'] },
        { key: 'currency', label: 'מטבע', type: 'select', required: true, options: ['ILS', 'USD', 'EUR'],
          optionLabels: { ILS: 'שקל (₪)', USD: 'דולר ($)', EUR: 'אירו (€)' } },
        { key: 'openDate', label: 'תאריך פתיחה', type: 'date', required: true, noFuture: true },
        { key: 'status', label: 'סטטוס', type: 'select', required: true, options: ['פעיל', 'מוקפא', 'סגור'] },
        { key: 'branchId', label: 'סניף', type: 'ref', ref: 'branches', required: true }
      ],
      computed: [
        { key: 'balance', label: 'יתרה', type: 'money', currency: r => r.currency || 'ILS',
          fn: (r, db) => db.transactions
            .filter(t => String(t.accountNo) === String(r.accountNo))
            .reduce((s, t) => s + (t.type === 'הפקדה' ? 1 : -1) * Number(t.amount || 0), 0) }
      ],
      title: r => `חשבון ${r.accountNo} (${r.type}${r.currency && r.currency !== 'ILS' ? ' · ' + r.currency : ''})`
    },
    {
      key: 'ownerships', label: 'בעלות בחשבונות', single: 'בעלות', en: 'Ownership', color: '#8b5cf6',
      relTable: true,
      desc: 'טבלת קשר (N:M) בין לקוחות לחשבונות: לקוח יכול להחזיק כמה חשבונות, וחשבון יכול להיות משותף לכמה לקוחות. מפתח ראשי משולב.',
      pk: ['customerId', 'accountNo'],
      fields: [
        { key: 'customerId', label: 'לקוח', type: 'ref', ref: 'customers', required: true },
        { key: 'accountNo', label: 'חשבון', type: 'ref', ref: 'accounts', required: true },
        { key: 'role', label: 'סוג בעלות', type: 'select', required: true, options: ['בעלים ראשי', 'שותף', 'מיופה כוח'] },
        { key: 'since', label: 'תאריך צירוף', type: 'date', required: true, noFuture: true }
      ],
      title: (r, db) => {
        const c = db && db.customers.find(x => String(x.customerId) === String(r.customerId));
        return `${c ? c.fullName : r.customerId} ↔ חשבון ${r.accountNo}`;
      }
    },
    {
      key: 'transactions', label: 'תנועות', single: 'תנועה', en: 'Transaction', color: '#f59e0b',
      desc: 'הפקדות ומשיכות. כל תנועה שייכת לחשבון אחד; בחשבון תנועות רבות.',
      pk: ['txnId'],
      fields: [
        { key: 'txnId', label: 'מזהה תנועה', type: 'number', required: true, auto: true },
        { key: 'accountNo', label: 'חשבון', type: 'ref', ref: 'accounts', required: true },
        { key: 'date', label: 'תאריך', type: 'date', required: true, noFuture: true },
        { key: 'type', label: 'סוג תנועה', type: 'select', required: true, options: ['הפקדה', 'משיכה'] },
        { key: 'amount', label: 'סכום', type: 'money', required: true, min: 1,
          currency: (r, db) => { const a = db.accounts.find(x => String(x.accountNo) === String(r.accountNo)); return (a && a.currency) || 'ILS'; } },
        { key: 'description', label: 'תיאור', type: 'text' }
      ],
      title: r => `תנועה ${r.txnId}`
    },
    {
      key: 'loans', label: 'הלוואות', single: 'הלוואה', en: 'Loan', color: '#f43f5e',
      desc: 'הלוואות שהבנק העניק. כל הלוואה שייכת ללקוח אחד; ללקוח יכולות להיות כמה הלוואות.',
      pk: ['loanId'],
      fields: [
        { key: 'loanId', label: 'מספר הלוואה', type: 'number', required: true, auto: true },
        { key: 'customerId', label: 'לקוח', type: 'ref', ref: 'customers', required: true },
        { key: 'purpose', label: 'מטרה', type: 'select', required: true, options: ['משכנתא', 'רכב', 'לימודים', 'כללית'] },
        { key: 'amount', label: 'סכום', type: 'money', required: true, min: 1 },
        { key: 'rate', label: 'ריבית שנתית', type: 'percent', required: true, min: 0, max: 30, step: 0.1 },
        { key: 'startDate', label: 'תאריך התחלה', type: 'date', required: true },
        { key: 'months', label: 'מספר תשלומים', type: 'number', required: true, min: 1, max: 360 }
      ],
      title: r => `הלוואה ${r.loanId} (${r.purpose})`
    },
    {
      key: 'branches', label: 'סניפים', single: 'סניף', en: 'Branch', color: '#6366f1',
      desc: 'סניפי הבנק. סניף מעסיק עובדים, משרת לקוחות ומנהל חשבונות.',
      pk: ['branchId'],
      fields: [
        { key: 'branchId', label: 'קוד סניף', type: 'text', required: true, pattern: '^\\d{3}$', hint: '3 ספרות' },
        { key: 'name', label: 'שם סניף', type: 'text', required: true },
        { key: 'city', label: 'עיר', type: 'text', required: true },
        { key: 'phone', label: 'טלפון', type: 'tel', pattern: '^0\\d{1,2}-?\\d{7}$', hint: 'לדוגמה 03-5551234' }
      ],
      title: r => `${r.name} (${r.branchId})`
    },
    {
      key: 'employees', label: 'עובדים', single: 'עובד', en: 'Employee', color: '#64748b',
      desc: 'עובדי הבנק. כל עובד מועסק בסניף, ולכל עובד (מלבד המנהל הבכיר) יש מנהל שהוא עובד בעצמו – קשר רקורסיבי.',
      pk: ['empId'],
      fields: [
        { key: 'empId', label: 'מספר עובד', type: 'number', required: true, auto: true },
        { key: 'fullName', label: 'שם מלא', type: 'text', required: true },
        { key: 'role', label: 'תפקיד', type: 'select', required: true, options: ['מנהל אזור', 'מנהל סניף', 'בנקאי', 'פקיד'] },
        { key: 'hireDate', label: 'תאריך העסקה', type: 'date', required: true, noFuture: true },
        { key: 'branchId', label: 'סניף', type: 'ref', ref: 'branches', required: true },
        { key: 'managerId', label: 'מנהל ישיר', type: 'ref', ref: 'employees' }
      ],
      title: r => r.fullName
    }
  ],

  /* קשרים בין הישויות – משמשים לעמוד ה-ERD ולתצוגת הקשרים באפליקציה */
  relations: [
    { key: 'r_owns', label: 'מחזיק', a: 'customers', b: 'accounts', pA: '(1,M)', pB: '(1,N)', part: ['לקוח מחזיק לפחות חשבון אחד ועד M חשבונות', 'חשבון מוחזק בידי לקוח אחד לפחות ועד N לקוחות'], card: 'N:M', degree: 'בינארי',
      impl: 'טבלת קשר נפרדת "בעלות בחשבונות" עם מפתח ראשי משולב (ת.ז + מספר חשבון)', attrs: ['סוג בעלות', 'תאריך צירוף'],
      text: 'לקוח מחזיק בחשבונות רבים, וחשבון יכול להיות משותף לכמה לקוחות' },
    { key: 'r_cust_branch', label: 'משויך ל', a: 'customers', b: 'branches', pA: '(1,1)', pB: '(0,N)', part: ['כל לקוח משויך לסניף אחד בדיוק', 'בסניף 0 עד N לקוחות'], card: '1:N', degree: 'בינארי',
      impl: 'מפתח זר "קוד סניף" בטבלת לקוחות (צד ה"רבים")', text: 'כל לקוח משויך לסניף אחד; בסניף לקוחות רבים' },
    { key: 'r_acc_branch', label: 'מתנהל ב', a: 'accounts', b: 'branches', pA: '(1,1)', pB: '(0,N)', part: ['כל חשבון מתנהל בסניף אחד בדיוק', 'בסניף 0 עד N חשבונות'], card: '1:N', degree: 'בינארי',
      impl: 'מפתח זר "קוד סניף" בטבלת חשבונות', text: 'כל חשבון מתנהל בסניף אחד; בסניף חשבונות רבים' },
    { key: 'r_txn', label: 'כולל', a: 'accounts', b: 'transactions', pA: '(0,N)', pB: '(1,1)', part: ['בחשבון 0 עד N תנועות', 'כל תנועה שייכת לחשבון אחד בדיוק'], card: '1:N', degree: 'בינארי',
      impl: 'מפתח זר "מספר חשבון" בטבלת תנועות', text: 'חשבון כולל תנועות רבות; כל תנועה שייכת לחשבון אחד' },
    { key: 'r_loan', label: 'לוקח', a: 'customers', b: 'loans', pA: '(0,N)', pB: '(1,1)', part: ['ללקוח 0 עד N הלוואות', 'כל הלוואה שייכת ללקוח אחד בדיוק'], card: '1:N', degree: 'בינארי',
      impl: 'מפתח זר "ת.ז" בטבלת הלוואות', text: 'לקוח יכול לקחת הלוואות רבות; כל הלוואה שייכת ללקוח אחד' },
    { key: 'r_emp_branch', label: 'מועסק ב', a: 'employees', b: 'branches', pA: '(1,1)', pB: '(1,N)', part: ['כל עובד מועסק בסניף אחד בדיוק', 'בסניף עובד אחד לפחות ועד N עובדים'], card: '1:N', degree: 'בינארי',
      impl: 'מפתח זר "קוד סניף" בטבלת עובדים', text: 'עובד מועסק בסניף אחד; בסניף עובדים רבים' },
    { key: 'r_manages', label: 'מנהל של', a: 'employees', b: 'employees', pA: '(0,N)', pB: '(0,1)', part: ['בתפקיד מנהל: מנהל 0 עד N עובדים', 'בתפקיד מנוהל: יש לו 0 או 1 מנהל ישיר'], card: '1:N', degree: 'אונארי (רקורסיבי)',
      roles: ['מנהל', 'מנוהל'],
      impl: 'מפתח זר "מנהל ישיר" בטבלת עובדים, המפנה לאותה טבלה', text: 'מנהל אחד מנהל עובדים רבים; לכל עובד מנהל ישיר אחד לכל היותר' }
  ]
};

/* נתוני הדגמה (פיקטיביים) */
window.SEED = {
  branches: [
    { branchId: '101', name: 'מרכז העיר', city: 'תל אביב', phone: '03-5550101' },
    { branchId: '205', name: 'הדר', city: 'חיפה', phone: '04-5550205' },
    { branchId: '312', name: 'קריית אונו', city: 'קריית אונו', phone: '03-5550312' }
  ],
  employees: [
    { empId: 1, fullName: 'מיכל ברק', role: 'מנהל אזור', hireDate: '2012-03-01', branchId: '101', managerId: '' },
    { empId: 2, fullName: 'יוסי אדלר', role: 'מנהל סניף', hireDate: '2015-06-15', branchId: '101', managerId: 1 },
    { empId: 3, fullName: 'רונית שחר', role: 'מנהל סניף', hireDate: '2016-09-01', branchId: '205', managerId: 1 },
    { empId: 4, fullName: 'עמית גל', role: 'בנקאי', hireDate: '2019-01-10', branchId: '101', managerId: 2 },
    { empId: 5, fullName: 'נועה פרץ', role: 'בנקאי', hireDate: '2021-04-20', branchId: '205', managerId: 3 },
    { empId: 6, fullName: 'דני אורן', role: 'פקיד', hireDate: '2023-11-05', branchId: '312', managerId: 1 }
  ],
  customers: [
    { customerId: '012345674', fullName: 'שרה כהן', phone: '050-1112233', email: 'sarah@example.com', joinDate: '2018-02-14', branchId: '101' },
    { customerId: '023456783', fullName: 'דוד לוי', phone: '052-2223344', email: 'david@example.com', joinDate: '2019-07-01', branchId: '101' },
    { customerId: '034567891', fullName: 'רחל אברהם', phone: '054-3334455', email: 'rachel@example.com', joinDate: '2020-11-23', branchId: '205' },
    { customerId: '045678901', fullName: 'אבי מזרחי', phone: '053-4445566', email: 'avi@example.com', joinDate: '2021-03-08', branchId: '312' },
    { customerId: '056789019', fullName: 'תמר פרידמן', phone: '058-5556677', email: 'tamar@example.com', joinDate: '2022-05-30', branchId: '205' },
    { customerId: '067890129', fullName: 'יעקב חדד', phone: '050-6667788', email: '', joinDate: '2024-01-17', branchId: '312' }
  ],
  accounts: [
    { accountNo: 10001, currency: 'ILS', type: 'עו"ש', openDate: '2018-02-14', status: 'פעיל', branchId: '101' },
    { accountNo: 10002, currency: 'EUR', type: 'חיסכון', openDate: '2019-01-03', status: 'פעיל', branchId: '101' },
    { accountNo: 10003, currency: 'ILS', type: 'עו"ש', openDate: '2019-07-01', status: 'פעיל', branchId: '101' },
    { accountNo: 10004, currency: 'ILS', type: 'עו"ש', openDate: '2020-11-23', status: 'פעיל', branchId: '205' },
    { accountNo: 10005, currency: 'ILS', type: 'עסקי', openDate: '2021-03-08', status: 'פעיל', branchId: '312' },
    { accountNo: 10006, currency: 'USD', type: 'פיקדון', openDate: '2022-05-30', status: 'מוקפא', branchId: '205' },
    { accountNo: 10007, currency: 'ILS', type: 'עו"ש', openDate: '2024-01-17', status: 'פעיל', branchId: '312' }
  ],
  ownerships: [
    { customerId: '012345674', accountNo: 10001, role: 'בעלים ראשי', since: '2018-02-14' },
    { customerId: '012345674', accountNo: 10002, role: 'בעלים ראשי', since: '2019-01-03' },
    { customerId: '023456783', accountNo: 10001, role: 'שותף', since: '2020-06-01' },
    { customerId: '023456783', accountNo: 10003, role: 'בעלים ראשי', since: '2019-07-01' },
    { customerId: '034567891', accountNo: 10004, role: 'בעלים ראשי', since: '2020-11-23' },
    { customerId: '045678901', accountNo: 10005, role: 'בעלים ראשי', since: '2021-03-08' },
    { customerId: '056789019', accountNo: 10006, role: 'בעלים ראשי', since: '2022-05-30' },
    { customerId: '034567891', accountNo: 10006, role: 'מיופה כוח', since: '2023-02-10' },
    { customerId: '067890129', accountNo: 10007, role: 'בעלים ראשי', since: '2024-01-17' }
  ],
  transactions: [
    { txnId: 1, accountNo: 10001, date: '2026-09-01', type: 'הפקדה', amount: 14500, description: 'משכורת' },
    { txnId: 2, accountNo: 10001, date: '2026-09-05', type: 'משיכה', amount: 4200, description: 'שכר דירה' },
    { txnId: 3, accountNo: 10002, date: '2026-09-10', type: 'הפקדה', amount: 30000, description: 'הפקדה לחיסכון' },
    { txnId: 4, accountNo: 10003, date: '2026-09-12', type: 'הפקדה', amount: 9800, description: 'משכורת' },
    { txnId: 5, accountNo: 10003, date: '2026-09-20', type: 'משיכה', amount: 1250, description: 'כרטיס אשראי' },
    { txnId: 6, accountNo: 10004, date: '2026-10-01', type: 'הפקדה', amount: 12000, description: 'משכורת' },
    { txnId: 7, accountNo: 10005, date: '2026-10-03', type: 'הפקדה', amount: 56000, description: 'תקבולים מלקוחות' },
    { txnId: 8, accountNo: 10005, date: '2026-10-15', type: 'משיכה', amount: 18700, description: 'תשלום לספקים' },
    { txnId: 9, accountNo: 10006, date: '2026-10-20', type: 'הפקדה', amount: 50000, description: 'פיקדון שנתי' },
    { txnId: 10, accountNo: 10007, date: '2026-11-01', type: 'הפקדה', amount: 7600, description: 'משכורת' },
    { txnId: 11, accountNo: 10001, date: '2026-11-02', type: 'משיכה', amount: 850, description: 'משיכת מזומן' },
    { txnId: 12, accountNo: 10004, date: '2026-11-10', type: 'משיכה', amount: 3100, description: 'העברה בנקאית' }
  ],
  loans: [
    { loanId: 501, customerId: '012345674', purpose: 'משכנתא', amount: 950000, rate: 4.2, startDate: '2021-05-01', months: 300 },
    { loanId: 502, customerId: '034567891', purpose: 'רכב', amount: 85000, rate: 5.9, startDate: '2024-02-15', months: 60 },
    { loanId: 503, customerId: '045678901', purpose: 'כללית', amount: 120000, rate: 6.5, startDate: '2025-08-01', months: 48 },
    { loanId: 504, customerId: '012345674', purpose: 'לימודים', amount: 30000, rate: 3.1, startDate: '2026-01-10', months: 36 }
  ]
};
