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
const MS = ['1000123'];          // רק 1000123 מנוהל מינימום; 1234567 בקטלוג אבל ייחודי לפרויקט; 7777777 לא מופיע באף קובץ
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
    w.document.getElementById('txtSku').value = '1234567'; await w.submitReport('text'); await tick(300);
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
    w.document.getElementById('txtSku').value = '1234567'; await w.submitReport('text'); await tick(200);
    click(w, w.document.getElementById('projYes')); await tick(400);
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates);
    ok('מסומן ייחודי לפרויקט', /^🏷️ ייחודי לפרויקט/.test((S.alerts[0] || {}).note || ''), (S.alerts[0] || {}).note);
    ok('מסך "נשלח" מוצג', vis(w, 'sentWrap'));
    w.closed = true; }

  head('5 · פגום / אי-התאמה — לא נבדקים מול הרשימה');
  { const S = server(); const w = await wh(S);
    w.applyType('פריט פגום'); w.document.getElementById('noteText').value = 'שבור';
    w.document.getElementById('txtSku').value = '1234567'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון', !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('6 · הרשימה לא נטענה → לא חוסמים');
  { const S = server(); const w = await wh(S, { minstock: [] });
    w.document.getElementById('txtSku').value = '1234567'; await w.submitReport('text'); await tick(300);
    ok('לא הוצג חלון', !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('7 · אין רשת + "כן" → נשמר בתור עם הסימון');
  { const S = server(); S.mode = 'offline'; const w = await wh(S);
    w.document.getElementById('txtSku').value = '1234567'; await w.submitReport('text'); await tick(200);
    ok('החלון מוצג גם בלי רשת', vis(w, 'projWrap'));
    click(w, w.document.getElementById('projYes')); await tick(300);
    const q = w.obxLoad(); ok('בתור', q.length === 1); ok('הסימון נשמר בתור', /ייחודי לפרויקט/.test(((q[0] || {}).payload || {}).note || ''));
    w.closed = true; }

  head('7ב · מק״ט שלא מופיע באף קובץ → "בדוק שוב" (לא נשלח כלום)');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '7777777'; w.refreshDesc();
    ok('אזהרה מתחת לשדה כבר לפני השליחה', /לא נמצא בקובץ הפריטים/.test(w.document.getElementById('descText').textContent), w.document.getElementById('descText').textContent);
    await w.submitReport('text'); await tick(300);
    ok('חלון "המק״ט לא נמצא בקובץ" מוצג', vis(w, 'unkWrap'));
    ok('חלון "ייחודי לפרויקט" לא מוצג במקביל', !vis(w, 'projWrap'));
    ok('המק״ט מוצג בחלון', /7777777/.test(w.document.getElementById('unkInfo').textContent));
    ok('לא נשלח', S.creates === 0);
    click(w, w.document.getElementById('unkBack')); await tick(200);
    ok('"חזור ובדוק" — החלון נסגר', !vis(w, 'unkWrap'));
    ok('המק״ט נשאר בשדה לתיקון', w.document.getElementById('txtSku').value === '7777777');
    ok('נפתחה מקלדת המק״ט', vis(w, 'kpWrap'));
    ok('עדיין לא נשלח', S.creates === 0);
    w.closed = true; }

  head('7ב2 · מקלדת המק״ט: השאלה עולה מיד באנטר');
  { const S = server(); const w = await wh(S);
    w.openKeypad('sku'); w.eval("kpVal='7777777'; kpRender();");
    ok('אזהרה בתוך המקלדת', /לא נמצא בקובץ הפריטים/.test(w.document.getElementById('kpDesc').textContent), w.document.getElementById('kpDesc').textContent);
    click(w, w.document.getElementById('kpEnter')); await tick(150);
    ok('השאלה מוצגת מיד', vis(w, 'unkWrap'));
    ok('השאלה: "האם המק״ט הוקלד נכון?"', /האם המק״ט הוקלד נכון/.test(w.document.querySelector('#unkWrap .unk-q').textContent));
    ok('המקלדת נשארת פתוחה מתחת', vis(w, 'kpWrap'));
    click(w, w.document.getElementById('unkBack')); await tick(100);
    ok('"אתקן" — חוזרים למקלדת עם המספר לתיקון', !vis(w, 'unkWrap') && vis(w, 'kpWrap') && w.eval('kpVal') === '7777777' && w.eval('kpStep') === 'sku');
    click(w, w.document.getElementById('kpEnter')); await tick(100);
    ok('הלחצן: "כן, בדקתי — שלח לקניינים"', /שלח לקניינים/.test(w.document.getElementById('unkGo').textContent));
    click(w, w.document.getElementById('unkGo')); await tick(500);
    ok('"כן, בדקתי" — נשלח מיד, בלי שלב כמות', S.creates === 1, 'create=' + S.creates);
    ok('המקלדת נסגרה', !vis(w, 'kpWrap'));
    ok('לא נשאלים שוב', !vis(w, 'unkWrap'));
    ok('נשלח עם סימון "מק״ט לא מוכר"', /^❓ מק״ט לא מוכר/.test((S.alerts[0] || {}).note || ''), (S.alerts[0] || {}).note);
    ok('המחסנאי רואה "✅ הדיווח נשלח"', vis(w, 'sentWrap') && /הדיווח נשלח/.test(w.document.getElementById('sentTitle').textContent));
    ok('בהודעה כתוב שסומן "מק״ט לא מוכר"', /מק״ט לא מוכר/.test(w.document.getElementById('sentInfo').textContent));
    ok('אחרי השליחה האישור מתאפס', w.eval('skuConfirmed') === '');
    w.closed = true; }

  head('7ג · "כן, בדקתי — שלח לקניינים" → נשלח עם סימון, בלי לשאול שוב על פרויקט');
  { const S = server(); const w = await wh(S);
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(200);
    click(w, w.document.getElementById('unkGo')); await tick(400);
    ok('חלון פרויקט לא הופיע', !vis(w, 'projWrap'));
    ok('נשלח לשרת', S.creates === 1, 'create=' + S.creates);
    ok('מסומן "מק״ט לא מוכר"', /^❓ מק״ט לא מוכר/.test((S.alerts[0] || {}).note || ''), (S.alerts[0] || {}).note);
    w.closed = true; }

  head('7ד · פגום עם מק״ט לא מוכר → נבדק גם כן; ההערה של המחסנאי נשמרת');
  { const S = server(); const w = await wh(S);
    w.applyType('פריט פגום'); w.document.getElementById('noteText').value = 'שבור בפינה';
    w.document.getElementById('txtSku').value = '7777777'; await w.submitReport('text'); await tick(200);
    ok('חלון מוצג גם בפגום', vis(w, 'unkWrap'));
    click(w, w.document.getElementById('unkGo')); await tick(400);
    const n = (S.alerts[0] || {}).note || '';
    ok('נשלח עם סימון + ההערה המקורית', /^❓ מק״ט לא מוכר · שבור בפינה$/.test(n), n);
    w.closed = true; }

  head('7ה · מק״ט שמופיע רק ברשימת המינימום (לא בקטלוג) נחשב מוכר');
  { const S = server(); const w = await wh(S, { minstock: ['1000123', '5550001'] });
    w.document.getElementById('txtSku').value = '5550001'; await w.submitReport('text'); await tick(300);
    ok('אין חלון', !vis(w, 'unkWrap') && !vis(w, 'projWrap')); ok('נשלח', S.creates === 1); w.closed = true; }

  head('7ו · לוח הקניינים: פנייה עם מק״ט לא מוכר מסומנת');
  { const S = server(); S.alerts.push({ id: 'U1', ticket: '26-0200', type: 'חוסר מלאי', sku: '7777777', desc: '', status: 'ממתין', reporter: 'משה', assignee: '', response: '',
      note: '❓ מק״ט לא מוכר — לא מופיע בקובץ הפריטים, המחסנאי אישר שהוקלד נכון', created: new Date().toISOString(), updated: new Date().toISOString(), chat: '' });
    const { w } = await boot('dashboard.html', { server: S, storage: DB, minstock: MS }); await tick(400);
    const c = w.document.querySelector('.card[data-id="U1"]');
    ok('פס "מק״ט לא מוכר"', c && !!c.querySelector('.unk-band'));
    ok('בלי פס פרויקט כפול', c && !c.querySelector('.proj-band'));
    ok('אפשר להעביר להיסטוריה', c && !!c.querySelector('[data-act="projclose"]'));
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

  head('8ב · סריקה: פניות ישנות (בלי סימון) על פריטים ייחודיים מסומנות אוטומטית');
  { const S = server(); const iso = h => new Date(Date.now() - h * 3600e3).toISOString();
    const add = (id, sku, type, status, note) => S.alerts.push({ id, ticket: '26-' + id, type, sku, desc: '', qty: '', status, reporter: 'אבי', assignee: '', response: '', note: note || '', created: iso(48), updated: iso(48), chat: '' });
    add('O1', '7777777', 'חוסר מלאי', 'ממתין');          // ייחודי, ישן, בלי סימון
    add('O2', '0007777777', 'חוסר מלאי', 'בטיפול');      // ייחודי עם אפסים מובילים
    add('O3', '1000123', 'חוסר מלאי', 'ממתין');          // מנוהל מינימום
    add('O4', '7777777', 'פריט פגום', 'ממתין', 'שבור');  // פגום — לא נבדק
    add('O5', '8888888', 'חוסר מלאי', 'טופל');           // ייחודי אבל סגור — לא נספר
    const { w } = await boot('dashboard.html', { server: S, storage: DB, minstock: MS }); await tick(400);
    const card = id => w.document.querySelector('.card[data-id="' + id + '"]');
    ok('O1 מסומן סגול', card('O1') && card('O1').classList.contains('proj'));
    ok('O1 — "זוהה בסריקה"', /זוהה בסריקה/.test(((card('O1') || {}).textContent) || ''));
    ok('O1 — יש "העבר להיסטוריה"', !!(card('O1') && card('O1').querySelector('[data-act="projclose"]')));
    ok('O2 (אפסים מובילים) מסומן', card('O2') && card('O2').classList.contains('proj'));
    ok('O3 (מנוהל מינימום) לא מסומן', card('O3') && !card('O3').classList.contains('proj'));
    ok('O4 (פגום) לא מסומן', card('O4') && !card('O4').classList.contains('proj'));
    const sum = w.document.querySelector('.proj-sum');
    ok('פס סיכום: 2 פניות פתוחות', sum && /\b2\b/.test(sum.textContent), sum ? sum.textContent : '(אין)');
    click(w, sum.querySelector('[data-projfilter]')); await tick(150);
    const ids = [...w.document.querySelectorAll('#list .card')].map(c => c.dataset.id).sort().join(',');
    ok('"הצג רק אותן" — רק O1,O2', ids === 'O1,O2', ids);
    click(w, w.document.querySelector('[data-projfilter]')); await tick(150);
    ok('"הצג הכל" מחזיר את כל הפתוחות', w.document.querySelectorAll('#list .card').length === 4, w.document.querySelectorAll('#list .card').length);
    w.closed = true; }
  { const S = server(); S.alerts.push({ id: 'X1', ticket: '26-1', type: 'חוסר מלאי', sku: '7777777', desc: '', status: 'ממתין', reporter: 'אבי', assignee: '', response: '', note: '', created: new Date().toISOString(), updated: new Date().toISOString(), chat: '' });
    const { w } = await boot('dashboard.html', { server: S, storage: DB, minstock: [] }); await tick(400);
    ok('בלי רשימה — שום דבר לא מסומן', !w.document.querySelector('.card.proj') && !w.document.querySelector('.proj-sum'));
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
