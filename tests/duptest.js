/* חסימת דיווח חוזר על אותו מק״ט — בדיקה באפליקציית המחסן עצמה, לא תלויה בשרת.
   • פנייה פתוחה — חוסמת תמיד (גם אחרי 14 יום).
   • פנייה שטופלה — חוסמת 14 יום מרגע הטיפול.
   כדי להוכיח שהאפליקציה חוסמת בעצמה, השרת המדומה כאן סופר כל קריאת create:
   דיווח חסום לא אמור להגיע לשרת בכלל. */
const { boot, tick, mkServer } = require('./harness');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}
function head(t) { console.log('\n' + t); }

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const STORE = { afcon_reporter: 'משה', afcon_reporter_phone: '0502223333' };

function server(opts) {
  opts = opts || {};
  const S = mkServer();
  const orig = S.handle.bind(S);
  S.creates = 0;
  S.handle = function (a, p) {
    if (a === 'create') S.creates++;
    if (a === 'all' && opts.allFails) throw new Error('all down');
    return orig(a, p);
  };
  return S;
}
function seed(S, sku, status, daysAgo, type) {
  S.alerts.push({ id: 'OLD' + S.alerts.length, ticket: '26-09' + S.alerts.length, type: (type === undefined ? 'חוסר מלאי' : type), sku: sku,
    desc: '', qty: '', status: status, reporter: 'אבי', assignee: '', response: '',
    created: iso(daysAgo), updated: iso(daysAgo), chat: '' });
}
async function report(S, sku, type) {
  const { w } = await boot('index.html', { server: S, storage: STORE });
  await tick(200);
  if (type) { w.applyType(type); w.document.getElementById('noteText').value = 'שבור'; }
  w.document.getElementById('txtSku').value = sku;
  await w.submitReport('text');
  await tick(300);
  const dupShown = !w.document.getElementById('dupWrap').classList.contains('hidden');
  w.closed = true;
  return { w, dupShown };
}

(async () => {
  head('1 · פנייה פתוחה מאתמול → מחסנאי אחר חסום, הקניין לא מקבל');
  { const S = server(); seed(S, '1000123', 'ממתין', 1);
    const r = await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates);
    ok('חלון "המק״ט כבר דווח" מוצג', r.dupShown); }

  head('2 · פנייה פתוחה (בטיפול) מלפני 30 יום → עדיין חסום');
  { const S = server(); seed(S, '1000123', 'בטיפול', 30);
    const r = await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates);
    ok('חלון כפילות מוצג', r.dupShown); }

  head('3 · מק״ט עם אפסים מובילים נחשב אותו מק״ט');
  { const S = server(); seed(S, '001000123', 'ממתין', 2);
    await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates); }

  head('4 · טופל לפני 5 ימים → חסום');
  { const S = server(); seed(S, '1000123', 'טופל', 5);
    const r = await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates);
    ok('חלון כפילות מוצג', r.dupShown); }

  head('5 · טופל לפני 13.9 ימים → עדיין חסום');
  { const S = server(); seed(S, '1000123', 'טופל', 13.9);
    await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates); }

  head('6 · טופל לפני 15 ימים → מותר לדווח שוב');
  { const S = server(); seed(S, '1000123', 'טופל', 15);
    const r = await report(S, '1000123');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates);
    ok('נוצרה פנייה חדשה', S.alerts.length === 2);
    ok('אין חלון כפילות', !r.dupShown); }

  head('7 · מק״ט אחר → נשלח כרגיל');
  { const S = server(); seed(S, '1000123', 'ממתין', 1);
    await report(S, '1234567');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates); }

  head('8 · הבדיקה נכשלת (השרת לא עונה על all) → הדיווח לא נתקע');
  { const S = server({ allFails: true });
    await report(S, '1234567');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates); }

  head('9 · דיווח שנשמר אופליין, ובינתיים מחסנאי אחר דיווח → לא נשלח שוב');
  { const S = server(); S.mode = 'offline';
    const { w } = await boot('index.html', { server: S, storage: STORE });
    await tick(200);
    w.document.getElementById('txtSku').value = '1000123';
    await w.submitReport('text'); await tick(300);
    ok('הדיווח בתור', w.obxLoad().length === 1);
    seed(S, '1000123', 'ממתין', 0);      // מחסנאי אחר דיווח בזמן שלא הייתה קליטה
    S.mode = 'ok';
    await w.obxFlush(true); await tick(400);
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates);
    ok('התור התרוקן', w.obxLoad().length === 0);
    ok('בהיסטוריה מסומן ככפול', (w.loadHist()[0] || {}).dup === 1 || JSON.stringify(w.loadHist()[0] || {}).indexOf('dup') >= 0, JSON.stringify(w.loadHist()[0] || {}));
    w.closed = true; }

  head('10 · חוסר פתוח על המק״ט → דיווח "פגום" על אותו מק״ט לא נחסם באפליקציה');
  { const S = server(); seed(S, '1000123', 'ממתין', 1);
    await report(S, '1000123', 'פריט פגום');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates); }

  head('11 · "פגום" פתוח על המק״ט → דיווח חוסר על אותו מק״ט לא נחסם באפליקציה');
  { const S = server(); seed(S, '1000123', 'ממתין', 1, 'פריט פגום');
    await report(S, '1000123');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates); }

  head('12 · "אי-התאמה" פתוחה על המק״ט → דיווח חוסר לא נחסם באפליקציה');
  { const S = server(); seed(S, '1000123', 'בטיפול', 1, 'אי-התאמה');
    await report(S, '1000123');
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates); }

  head('13 · פנייה ישנה בלי סוג רשום נחשבת חוסר מלאי → חוסמת חוסר');
  { const S = server(); seed(S, '1000123', 'ממתין', 1, '');
    await report(S, '1000123');
    ok('לא נשלח לשרת', S.creates === 0, 'create=' + S.creates); }

  console.log('\n' + '='.repeat(54));
  console.log('עברו: ' + pass + '   נכשלו: ' + fail);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('הרצה נכשלה:', e); process.exit(1); });
