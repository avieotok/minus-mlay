/* ימי אספקה — הקניין מכריז שהפריט הוזמן ותוך כמה ימים יגיע.
   בלוח הקניינים: לחצן "🚚 ימי אספקה", הפנייה עוברת להיסטוריה, ספירה לאחור, "📦 הפריט הגיע".
   באפליקציית המחסנאים: דיווח חוסר על המק״ט חסום עד מועד האספקה, עם הודעה וספירה לאחור. */
const { boot, tick, mkServer } = require('./harness');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}
function head(t) { console.log('\n' + t); }

const DAY = 86400000;
const pad = n => ('0' + n).slice(-2);
function dAgo(n) { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() - n); }
const ddmm = d => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
const iso = n => new Date(Date.now() - n * DAY).toISOString();
const supplyResp = (startDaysAgo, days, extra) =>
  '🚚 הוזמן · ימי אספקה: ' + days + ' · מתאריך ' + ddmm(dAgo(startDaysAgo)) + ' · ספק אלפא' + (extra || '');

const WH = { afcon_reporter: 'משה', afcon_reporter_phone: '0502223333' };
const DB = { afcon_me: 'דנה' };

function server() {
  const S = mkServer(); const orig = S.handle.bind(S); S.creates = 0;
  S.handle = (a, p) => { if (a === 'create') S.creates++; return orig(a, p); };
  return S;
}
function seed(S, o) {
  S.alerts.push(Object.assign({ id: 'A' + (S.alerts.length + 1), ticket: '26-000' + (S.alerts.length + 1), type: 'חוסר מלאי',
    sku: '1000123', desc: 'beam bolt', qty: '2', status: 'ממתין', reporter: 'אבי', assignee: '', response: '',
    created: iso(1), updated: iso(1), chat: '' }, o || {}));
}
async function whReport(S, sku) {
  const { w } = await boot('index.html', { server: S, storage: WH });
  await tick(200);
  w.document.getElementById('txtSku').value = sku || '1000123';
  await w.submitReport('text'); await tick(300);
  const d = w.document;
  const r = { w, shown: !d.getElementById('dupWrap').classList.contains('hidden'),
    title: d.getElementById('dupTitle').textContent, info: d.getElementById('dupInfo').textContent };
  w.closed = true; return r;
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

(async () => {
  head('1 · לוח הקניינים: לחצן "ימי אספקה" מופיע רק על חוסר מלאי פתוח');
  { const S = server(); seed(S); seed(S, { id: 'B1', type: 'פריט פגום', sku: '1234567', note: 'שבור' });
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    const cA = w.document.querySelector('.card[data-id="A1"]'), cB = w.document.querySelector('.card[data-id="B1"]');
    ok('יש לחצן בחוסר מלאי', !!(cA && cA.querySelector('[data-act="supply"]')));
    ok('אין לחצן בפריט פגום', !!cB && !cB.querySelector('[data-act="supply"]'));
    w.closed = true; }

  head('2 · הקניין מזין 120 ימים → הפנייה נשארת בלוח (בטיפול) עם התשובה');
  { const S = server(); seed(S);
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    const card = () => w.document.querySelector('.card[data-id="A1"]');
    click(w, card().querySelector('[data-act="supply"]'));
    ok('הפאנל נפתח', card().querySelector('.supply').classList.contains('open'));
    click(w, card().querySelector('.sgo'));          // בלי ימים
    await tick(200);
    ok('בלי מספר ימים — לא נשלח', S.alerts[0].status === 'ממתין');
    click(w, card().querySelector('.squick[data-sq="120"]'));
    ok('תאריך אספקה משוער מוצג', /אספקה משוערת: /.test(card().querySelector('.seta').textContent), card().querySelector('.seta').textContent);
    card().querySelector('.snote').value = 'ספק אלפא';
    click(w, card().querySelector('.sgo'));
    await tick(600);
    const a = S.alerts[0];
    ok('הסטטוס בטיפול — לא עבר להיסטוריה', a.status === 'בטיפול', a.status);
    ok('הכרטיס עדיין בלוח הפתוח', !!card(), '(אין כרטיס)');
    const lbl = card() && card().querySelector('[data-act="supply"]');
    ok('הלחצן מציג (120)', lbl && /\(120\)/.test(lbl.textContent), lbl ? lbl.textContent : '');
    const bd = card() && card().querySelector('.sbadge');
    ok('תג ספירה לאחור בכרטיס: 120', bd && /עוד 120 ימים/.test(bd.textContent), bd ? bd.textContent : '');
    ok('הפאנל נסגר אחרי השמירה', !card().querySelector('.supply').classList.contains('open'));
    ok('אין לחצן "החזר לממתין"/"קח לטיפול"', !card().querySelector('[data-act="בטיפול"]'));
    ok('אין לחצן "טופל" (נסגר רק ב"הפריט הגיע")', !card().querySelector('[data-act="טופל"]'));
    ok('הלחצן הראשון הוא "הפריט הגיע"', (card().querySelector('.acts .btn')||{}).dataset.act === 'arrived');
    ok('תווית הסטטוס "הוזמן"', /הוזמן/.test(card().querySelector('.row1 .pill').textContent), card().querySelector('.row1 .pill').textContent);
    ok('יש "בטל הזמנה"', !!card().querySelector('[data-act="unorder"]'));
    ok('הקניין משויך', a.assignee === 'דנה', a.assignee);
    ok('התשובה בתבנית ימי אספקה', a.response === '🚚 הוזמן · ימי אספקה: 120 · מתאריך ' + ddmm(dAgo(0)) + ' · ספק אלפא', a.response);
    w.closed = true; }

  head('2ג · "בטל הזמנה" מחזיר לבטיפול רגיל ומשחרר את המק״ט');
  { const S = server(); seed(S, { status: 'בטיפול', assignee: 'דנה', response: supplyResp(0, 120), updated: iso(0) });
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    w.confirm = () => true;
    click(w, w.document.querySelector('.card[data-id="A1"] [data-act="unorder"]')); await tick(600);
    const a = S.alerts[0];
    ok('נשאר בטיפול', a.status === 'בטיפול', a.status);
    ok('ימי האספקה נמחקו מהתשובה', !/ימי אספקה:/.test(a.response), a.response);
    const c = w.document.querySelector('.card[data-id="A1"]');
    ok('חזר הלחצן הרגיל', c && !!c.querySelector('[data-act="בטיפול"]'));
    w.closed = true; }

  head('2ב · לחצן "חזור" סוגר את הפאנל בלי לשמור');
  { const S = server(); seed(S);
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    const card = () => w.document.querySelector('.card[data-id="A1"]');
    click(w, card().querySelector('[data-act="supply"]'));
    card().querySelector('.sdays').value = '90';
    click(w, card().querySelector('.sback')); await tick(200);
    ok('הפאנל נסגר', !card().querySelector('.supply').classList.contains('open'));
    ok('השדה נוקה', card().querySelector('.sdays').value === '');
    ok('לא נשמר כלום', S.alerts[0].status === 'ממתין' && !S.alerts[0].response);
    w.closed = true; }

  head('3 · פנייה פתוחה עם ימי אספקה: ספירה לאחור + "הפריט הגיע" סוגר להיסטוריה');
  { const S = server(); seed(S, { status: 'בטיפול', assignee: 'דנה', response: supplyResp(1, 120), updated: iso(1) });
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    const c = w.document.querySelector('.card[data-id="A1"]');
    const b = c && c.querySelector('.sbadge');
    ok('מחר → 119 ימים', b && /עוד 119 ימים/.test(b.textContent), b ? b.textContent : '(אין)');
    w.confirm = () => true;
    click(w, c.querySelector('[data-act="arrived"]')); await tick(600);
    ok('סומן הגיע בשרת', /✅ הגיע /.test(S.alerts[0].response), S.alerts[0].response);
    ok('עבר להיסטוריה (טופל)', S.alerts[0].status === 'טופל', S.alerts[0].status);
    w.closed = true; }

  head('4 · מחסנאי מדווח על מק״ט שהוזמן לפני 10 ימים (120) → חסום, 110 ימים');
  { const S = server(); seed(S, { status: 'בטיפול', assignee: 'דנה', response: supplyResp(10, 120), updated: iso(30) });
    const r = await whReport(S);
    ok('לא נשלח לקניין', S.creates === 0, 'create=' + S.creates);
    ok('חלון מוצג', r.shown);
    ok('כותרת "הפריט כבר הוזמן"', /הפריט כבר הוזמן/.test(r.title), r.title);
    ok('ספירה: 110 ימים', /110\s*ימים לקבלה משוערת/.test(r.info), r.info);
    ok('שם הקניין מוצג', /דנה/.test(r.info));
    ok('באחריות הקניין', /באחריות הקניין/.test(r.info)); }

  head('5 · יום לפני הסוף → עדיין חסום (1 יום)');
  { const S = server(); seed(S, { status: 'טופל', response: supplyResp(119, 120), updated: iso(119) });
    const r = await whReport(S);
    ok('לא נשלח', S.creates === 0);
    ok('1 יום', /1\s*יום לקבלה/.test(r.info), r.info); }

  head('6 · מועד האספקה עבר → מותר לדווח');
  { const S = server(); seed(S, { status: 'טופל', response: supplyResp(121, 120), updated: iso(121) });
    await whReport(S);
    ok('נשלח לקניין', S.creates === 1, 'create=' + S.creates); }

  head('7 · הקניין סימן "הגיע" (לפני 20 יום) → מותר לדווח');
  { const S = server(); seed(S, { status: 'טופל', response: supplyResp(40, 120, ' · ✅ הגיע ' + ddmm(dAgo(20))), updated: iso(20) });
    await whReport(S);
    ok('נשלח לקניין', S.creates === 1, 'create=' + S.creates); }

  head('8 · ימי אספקה לא חוסמים מק״ט אחר');
  { const S = server(); seed(S, { status: 'טופל', response: supplyResp(1, 120), updated: iso(30) });
    await whReport(S, '1234567');
    ok('נשלח לקניין', S.creates === 1); }

  head('8ב · המדווח מקבל פופ-אפ "תגובה חדשה" עם ימי האספקה');
  { const S = server(); seed(S, { reporter: 'משה' });
    const { w } = await boot('index.html', { server: S, storage: WH }); await tick(200);
    await w.checkFeedback(); await tick(200);            // המחסנאי ראה את הדיווח במצב ממתין
    Object.assign(S.alerts[0], { status: 'בטיפול', assignee: 'דנה', response: supplyResp(0, 120), updated: iso(0) });
    await w.checkFeedback(); await tick(300);
    const wrap = w.document.getElementById('respWrap');
    const txt = w.document.getElementById('respBody').textContent;
    ok('הפופ-אפ קפץ', wrap && !wrap.classList.contains('hidden'));
    ok('כתוב "הפריט הוזמן" ו-120 ימים', /הפריט הוזמן/.test(txt) && /עוד 120 ימים/.test(txt), txt);
    w.closed = true; }

  head('9 · "הדיווחים שלי" אצל המדווח מציג ספירה לאחור');
  { const S = server(); seed(S, { status: 'טופל', reporter: 'משה', assignee: 'דנה', response: supplyResp(1, 120), updated: iso(1) });
    const { w } = await boot('index.html', { server: S, storage: WH }); await tick(200);
    await w.loadInbox(); await tick(200);
    const t = w.document.getElementById('inboxList').textContent;
    ok('מוצג "עוד 119 ימים"', /עוד 119 ימים לקבלה משוערת/.test(t), t.slice(0, 200));
    w.closed = true; }

  console.log('\n' + '='.repeat(54));
  console.log('עברו: ' + pass + '   נכשלו: ' + fail);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('הרצה נכשלה:', e); process.exit(1); });
