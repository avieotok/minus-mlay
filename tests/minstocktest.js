/* מלאי מינימום — רק פריטים מנוהלי מלאי מינימום נשלחים לקניין כרגיל.
   פריט שאינו ברשימה = ייחודי לפרויקט: המחסנאי נשאל; "כן" שולח עם סימון, "לא" מבטל ומאפס את המסך.
   בלוח הקניינים: הפנייה מסומנת, ואפשר להעביר אותה ישר להיסטוריה. */
const { boot, tick, mkServer } = require('./harness');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const fails = [];
function ok(n, c, d) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; fails.push(n + (d ? ' → ' + d : '')); console.log('  ✗ ' + n + (d ? ' → ' + d : '')); } }
function head(t) { console.log('\n' + t); }
const WH = { afcon_reporter: 'משה', afcon_reporter_phone: '0502223333' };
const DB = { afcon_me: 'דנה' };
const MS = ['1000123'];          // רק 1000123 מנוהל מינימום; 7777777 ייחודי לפרויקט
function server() { const S = mkServer(); const o = S.handle.bind(S); S.creates = 0; S.handle = (a, p) => { if (a === 'create') S.creates++; return o(a, p); }; return S; }
async function wh(S, opts) { const r = await boot('index.html', Object.assign({ server: S, storage: WH, minstock: MS }, opts || {})); await tick(200); return r.w; }
const vis = (w, id) => !w.document.getElementById(id).classList.contains('hidden');
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

(async () => {
  head('1 · מק״ט מנוהל מינימום → נשלח כרגיל, בלי שאלה');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '1000123'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון "ייחודי לפרויקט"', !vis(w, 'projWrap'));
    ok('נשלח לקניין', S.creates === 1, 'create=' + S.creates);
    ok('בלי סימון פרויקט', !String((S.alerts[0] || {}).note || '').includes('ייחודי'));
    w.closed = true; }

  head('2 · מק״ט עם אפסים מובילים נמצא ברשימה');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '001000123'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון', !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('3 · מק״ט ייחודי לפרויקט → חלון עם שאלה, ושום דבר לא נשלח עדיין');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(300);
    ok('החלון מוצג', vis(w, 'projWrap'));
    const t = w.document.getElementById('projInfo').textContent;
    ok('כתוב שאין צורך לעדכן את הרכש', /אין צורך לעדכן את הרכש/.test(t), t);
    ok('השאלה מוצגת', /האם בכל זאת לעדכן את הקניין/.test(w.document.querySelector('#projWrap .proj-q').textContent));
    ok('לא נשלח לשרת', S.creates === 0);

    head('3א · "לא" → מבוטל, המסך חוזר להתחלה');
    click(w, w.document.getElementById('projNo')); await tick(200);
    ok('החלון נסגר', !vis(w, 'projWrap'));
    ok('לא נשלח', S.creates === 0);
    ok('שדה המק״ט התאפס', w.document.getElementById('txtSku').value === '');
    w.closed = true; }

  head('4 · "כן" → נשלח לקניין עם סימון "ייחודי לפרויקט"');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(200);
    click(w, w.document.getElementById('projYes')); await tick(400);
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates);
    ok('מסומן ייחודי לפרויקט', /^🏷️ ייחודי לפרויקט/.test((S.alerts[0] || {}).note || ''), (S.alerts[0] || {}).note);
    ok('מסך "נשלח" מוצג', vis(w, 'sentWrap'));
    w.closed = true; }

  head('5 · פגום / אי-התאמה — לא נבדקים מול הרשימה');
  { const S = server(); const w = await wh(S);
    w.applyType('פריט פגום'); w.document.getElementById('noteText').value = 'שבור';
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון', !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('6 · הרשימה לא נטענה → לא חוסמים');
  { const S = server(); const w = await wh(S, { minstock: [] });
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון', !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('7 · אין רשת + "כן" → נשמר בתור עם הסימון');
  { const S = server(); S.mode = 'offline'; const w = await wh(S);
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(200);
    ok('החלון מוצג גם בלי רשת', vis(w, 'projWrap'));
    click(w, w.document.getElementById('projYes')); await tick(300);
    const q = w.obxLoad(); ok('בתור', q.length === 1); ok('הסימון נשמר בתור', /ייחודי לפרויקט/.test(((q[0] || {}).payload || {}).note || ''));
    w.closed = true; }

  head('8 · לוח הקניינים: פנייה מסומנת + "העבר להיסטוריה"');
  { const S = server();
    S.alerts.push({ id: 'P1', ticket: '26-0099', type: 'חוסר מלאי', sku: '7777777', desc: '', qty: '', status: 'ממתין', reporter: 'משה', assignee: '', response: '',
      note: '🏷️ ייחודי לפרויקט — המחסנאי ביקש לעדכן בכל זאת', created: new Date().toISOString(), updated: new Date().toISOString(), chat: '' });
    S.alerts.push({ id: 'N1', ticket: '26-0098', type: 'חוסר מלאי', sku: '1000123', desc: '', qty: '', status: 'ממתין', reporter: 'משה', assignee: '', response: '', note: '',
      created: new Date().toISOString(), updated: new Date().toISOString(), chat: '' });
    const { w } = await boot('dashboard.html', { server: S, storage: DB }); await tick(400);
    const c = w.document.querySelector('.card[data-id="P1"]'), n = w.document.querySelector('.card[data-id="N1"]');
    ok('הכרטיס צבוע (proj)', c && c.classList.contains('proj'));
    ok('פס "ייחודי לפרויקט"', c && /ייחודי לפרויקט/.test((c.querySelector('.proj-band') || {}).textContent || ''));
    ok('יש "העבר להיסטוריה"', c && !!c.querySelector('[data-act="projclose"]'));
    ok('אפשר גם לטפל כרגיל ("קח לטיפול")', c && !!c.querySelector('[data-act="בטיפול"]'));
    ok('כרטיס רגיל לא מסומן', n && !n.classList.contains('proj') && !n.querySelector('[data-act="projclose"]'));
    w.confirm = () => true;
    click(w, c.querySelector('[data-act="projclose"]')); await tick(600);
    const a = S.alerts.find(x => x.id === 'P1');
    ok('עבר להיסטוריה (טופל)', a.status === 'טופל', a.status);
    ok('תשובה למחסנאי: אין צורך ברכש', /אין צורך בהזמנת רכש/.test(a.response), a.response);
    w.closed = true; }

  head('9 · עדכון שבועי: קריאת קובץ האקסל האמיתי');
  { const { w } = await boot('dashboard.html', { server: server(), storage: DB }); await tick(300);
    const XLSXlib = require(path.join(process.env.NODE_PATH || '', 'xlsx'));
    const f = path.join(__dirname, 'fixtures', 'minstock.xlsx');
    if (fs.existsSync(f)) {
      const wb = XLSXlib.read(fs.readFileSync(f)); const rows = XLSXlib.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      const r = w.__msParse(rows);
      ok('שורת הכותרות זוהתה', r.header === 1, r.header);
      ok('1,937 פריטים', Object.keys(r.items).length === 1937, Object.keys(r.items).length);
      ok('אפסים מובילים הוסרו', '1030166' in r.items);
      ok('מק״ט עם אותיות נשמר', '00GW10001L'.replace(/^0+/, '') in r.items);
    } else { console.log('  (אין קובץ דוגמה — דילוג)'); }
    const r2 = w.__msParse([['מק"ט', 'תאור', 'מנוהל מלאי?', 'מנוהל מלאי מינימום'], ['001', 'א', 'Y', 'Y'], ['002', 'ב', 'Y', 'N'], ['', '', '', '']]);
    ok('רק שורות Y נכללות', Object.keys(r2.items).length === 1 && '1' in r2.items && r2.notY === 1);
    ok('קובץ בלי כותרת מק״ט → שגיאה', !!w.__msParse([['a', 'b'], ['1', '2']]).err);
    w.closed = true; }

  console.log('\n' + '='.repeat(54));
  console.log('עברו: ' + pass + '   נכשלו: ' + fail);
  if (fail) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('הרצה נכשלה:', e); process.exit(1); });
