const { boot, tick, mkServer } = require('./harness');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}
function head(t) { console.log('\n' + t); }

const WH_STORE = { afcon_reporter: 'אבי', afcon_reporter_phone: '0501112222' };
const DB_STORE = { afcon_me: 'דנה' };

// ממלא טופס דיווח באפליקציית המחסן דרך ה-DOM האמיתי
function fillReport(w, sku, qty) {
  const d = w.document;
  d.getElementById('txtSku').value = sku;
  const q = d.getElementById('qtyText'); if (q) q.value = qty || '3';
}

(async () => {

  // ============================================================
  head('1 · דיווח תקין מגיע לשרת ומקבל מספר קריאה');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    fillReport(w, '1000123', '5');
    await w.submitReport('text');
    await tick(300);
    ok('נוצרה פנייה אחת בשרת', S.alerts.length === 1, 'בפועל ' + S.alerts.length);
    ok('התקבל מספר קריאה 26-0001', S.alerts[0] && S.alerts[0].ticket === '26-0001', S.alerts[0] && S.alerts[0].ticket);
    ok('שם המדווח נשמר', S.alerts[0] && S.alerts[0].reporter === 'אבי');
    ok('התור ריק', w.obxLoad().length === 0);
    const h = w.loadHist();
    ok('ההיסטוריה מסומנת כנשלחה', h.length === 1 && h[0].q === 0 && h[0].tk === '26-0001', JSON.stringify(h[0] || {}));
    w.closed = true;
  }

  // ============================================================
  head('2 · אין רשת → הדיווח נשמר בתור ולא אובד');
  {
    const S = mkServer(); S.mode = 'offline';
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    fillReport(w, '2000456', '2');
    await w.submitReport('text');
    await tick(300);
    ok('לא נוצרה פנייה בשרת', S.alerts.length === 0);
    ok('הדיווח בתור', w.obxLoad().length === 1);
    ok('ההיסטוריה מסומנת כממתינה', (w.loadHist()[0] || {}).q === 1);
    const bar = w.document.getElementById('obxBar');
    ok('שורת ההמתנה מוצגת', bar && !bar.classList.contains('hidden'));

    // הרשת חוזרת
    S.mode = 'ok';
    await w.obxFlush(true);
    await tick(400);
    ok('אחרי חזרת הרשת — הפנייה נוצרה', S.alerts.length === 1, 'בפועל ' + S.alerts.length);
    ok('התור התרוקן', w.obxLoad().length === 0);
    ok('ההיסטוריה עודכנה למספר קריאה', (w.loadHist()[0] || {}).tk === '26-0001', JSON.stringify(w.loadHist()[0] || {}));
    w.closed = true;
  }

  // ============================================================
  head('3 · התשובה אבדה בדרך → אין דיווח כפול');
  {
    const S = mkServer(); S.mode = 'lostresponse';
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    fillReport(w, '3000789', '1');
    await w.submitReport('text');
    await tick(300);
    ok('השרת קלט את הפנייה', S.alerts.length === 1, 'בפועל ' + S.alerts.length);
    ok('הלקוח חושב שנכשל ושמר בתור', w.obxLoad().length === 1);

    S.mode = 'ok';
    await w.obxFlush(true);
    await tick(500);
    ok('אחרי ניסיון חוזר — עדיין פנייה אחת בלבד', S.alerts.length === 1, 'בפועל ' + S.alerts.length + ' (כפילות!)');
    ok('התור התרוקן', w.obxLoad().length === 0);
    w.closed = true;
  }

  // ============================================================
  head('4 · טוקן שגוי → נחשב כישלון ולא כהצלחה');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    S.mode = 'badtoken';   // השרת דוחה — כמו טוקן שהוחלף בצד השרת
    fillReport(w, '4000111', '4');
    await w.submitReport('text');
    await tick(300);
    ok('לא נוצרה פנייה', S.alerts.length === 0);
    ok('הדיווח נשמר בתור ולא אבד', w.obxLoad().length === 1, 'בתור ' + w.obxLoad().length);
    w.closed = true;
  }

  // ============================================================
  head('5 · בדיקת "מה עוד חסר" מזהה שדות ריקים');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    let miss = w.missingBits();
    ok('טופס ריק → חסר מק״ט', miss.length === 1 && miss[0].why === 'מק״ט', JSON.stringify(miss));
    w.document.getElementById('txtSku').value = '5000222';
    miss = w.missingBits();
    ok('אחרי מילוי מק״ט → אין חוסרים', miss.length === 0, JSON.stringify(miss));
    w.closed = true;
  }

  // ============================================================
  head('6 · הודעת צ׳אט שנכשלה מסומנת ונשמרת');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    // יוצרים פנייה כדי שיהיה למה לכתוב
    fillReport(w, '6000333', '1');
    await w.submitReport('text');
    await tick(300);
    const id = S.alerts[0].id;

    // מדמים שורת צ׳אט במסך "הדיווחים שלי"
    const row = w.document.createElement('div');
    row.innerHTML = '<div class="wthread"></div><textarea class="win"></textarea><div class="wpending"></div>';
    w.document.body.appendChild(row);
    row.querySelector('.win').value = 'שלום, מה קורה עם הפריט?';

    S.mode = 'offline';
    await w.sendWhMsg(row, id);
    await tick(200);
    const msg = row.querySelector('.wmsg');
    ok('ההודעה מוצגת בשרשור', !!msg);
    ok('מסומנת כלא-נשלחה', msg && msg.classList.contains('unsent'));
    ok('יש כפתור "נסה שוב"', !!row.querySelector('.msg-fail button'));
    ok('נשמרה בתור ההודעות', w.mqLoad().length === 1);
    ok('לא נכתבה בשרת', !S.alerts[0].chat);

    S.mode = 'ok';
    await w.mqFlush(true);
    await tick(300);
    ok('אחרי חזרת הרשת — ההודעה בשרת', !!S.alerts[0].chat, 'chat=' + (S.alerts[0].chat || 'ריק'));
    ok('התור התרוקן', w.mqLoad().length === 0);
    ok('הסימון האדום הוסר', !row.querySelector('.msg-fail'));
    w.closed = true;
  }

  // ============================================================
  head('7 · לוח הקניינים — טעינה, שיוך וסימון טופל');
  {
    const S = mkServer();
    S.alerts.push({
      id: 'A1', ticket: '26-0001', type: 'חוסר מלאי', sku: '7000444', desc: 'ברגים',
      qty: '2', urgency: 'דחוף', reporter: 'אבי', status: 'ממתין', assignee: '',
      response: '', chat: '', created: new Date(Date.now() - 5 * 3600000).toISOString(),
      updated: new Date().toISOString()
    });
    const { w } = await boot('dashboard.html', { server: S, storage: DB_STORE });
    await tick(400);
    ok('הפנייה נטענה ללוח', w.document.querySelectorAll('#list .card').length === 1,
      'כרטיסים: ' + w.document.querySelectorAll('#list .card').length);
    const ageEl = w.document.querySelector('.age');
    ok('מוצג תג גיל', !!ageEl, ageEl ? ageEl.textContent : '(אין)');
    ok('התג מציג 5 שעות', ageEl && /5 שע/.test(ageEl.textContent), ageEl ? ageEl.textContent : '');

    await w.assignTo('A1', 'דנה', 'בטיפול', '');
    await tick(400);
    ok('השיוך נשמר בשרת', S.alerts[0].assignee === 'דנה', 'בפועל ' + S.alerts[0].assignee);
    ok('הסטטוס בטיפול', S.alerts[0].status === 'בטיפול');
    w.closed = true;
  }

  // ============================================================
  head('8 · שני קניינים לוקחים אותה פנייה → נחסם');
  {
    const S = mkServer();
    S.alerts.push({ id: 'A1', ticket: '26-0001', sku: '8000555', status: 'ממתין', assignee: '', reporter: 'אבי', chat: '', created: new Date().toISOString() });
    const { w } = await boot('dashboard.html', { server: S, storage: DB_STORE });
    await tick(400);
    // יוסי לקח בינתיים מאחורי הקלעים — המסך של דנה עדיין ישן
    S.alerts[0].assignee = 'יוסי'; S.alerts[0].status = 'בטיפול';
    await w.assignTo('A1', 'דנה', 'בטיפול', '');
    await tick(400);
    ok('הפנייה נשארה אצל יוסי', S.alerts[0].assignee === 'יוסי', 'בפועל ' + S.alerts[0].assignee);
    const t = w.document.getElementById('toast');
    ok('הוצגה אזהרה לדנה', t && /יוסי/.test(t.textContent), t ? t.textContent : '');
    w.closed = true;
  }

  // ============================================================
  head('9 · כישלון עדכון → המסך חוזר למצב הקודם');
  {
    const S = mkServer();
    S.alerts.push({ id: 'A1', ticket: '26-0001', sku: '9000666', status: 'ממתין', assignee: '', reporter: 'אבי', chat: '', created: new Date().toISOString() });
    const { w } = await boot('dashboard.html', { server: S, storage: DB_STORE });
    await tick(400);
    S.mode = 'offline';
    await w.assignTo('A1', 'דנה', 'בטיפול', '');
    await tick(400);
    const local = w.eval("ALERTS.find(function(x){return x.id==='A1';})");
    ok('הסטטוס במסך הוחזר ל"ממתין"', local && local.status === 'ממתין', local ? local.status : '?');
    ok('השיוך במסך רוקן', local && !local.assignee, local ? local.assignee : '?');
    w.closed = true;
  }

  // ============================================================
  head('10 · מסלול מקצה לקצה: מחסנאי → קניין → חזרה למחסנאי');
  {
    const S = mkServer();
    const A = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    fillReport(A.w, '1234567', '2');
    await A.w.submitReport('text');
    await tick(300);
    ok('המחסנאי שלח', S.alerts.length === 1);

    const B = await boot('dashboard.html', { server: S, storage: DB_STORE });
    await tick(400);
    ok('הקניין רואה את הפנייה', B.w.document.querySelectorAll('#list .card').length === 1);

    await B.w.assignTo(S.alerts[0].id, 'דנה', 'טופל', 'הוזמן מהספק, מגיע ביום ראשון');
    await tick(400);
    ok('התגובה נשמרה', /הוזמן מהספק/.test(S.alerts[0].response || ''), S.alerts[0].response);
    ok('הסטטוס טופל', S.alerts[0].status === 'טופל');

    // המחסנאי בודק משוב
    await A.w.checkFeedback();
    await tick(300);
    const badge = A.w.document.getElementById('inboxBadge');
    ok('נדלקה התראה אצל המחסנאי', badge && badge.style.display !== 'none', 'display=' + (badge ? badge.style.display : '?'));
    A.w.closed = true; B.w.closed = true;
  }

  // ============================================================
  head('11 · אורך כתובת ה-URL בדיווח עם הערה ארוכה');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH_STORE });
    await tick(200);
    w.document.getElementById('txtSku').value = '1112223';
    const note = w.document.getElementById('noteText');
    note.value = 'נ'.repeat(300);
    let blocked = false;
    try { await w.apiSend({ id: 'X1', type: 'פריט פגום', sku: '1112223', note: note.value, reporter: 'אבי' }); }
    catch (e) { blocked = !!e.tooLong; }
    ok('טקסט חורג נחסם בשכבת התעבורה', blocked);
    ok('שדה ההערה מוגבל מראש', note.getAttribute('maxlength') === '220', note.getAttribute('maxlength'));
    w.closed = true;
  }

  // ============================================================
  console.log('\n' + '='.repeat(54));
  console.log('עברו: ' + pass + '   נכשלו: ' + fail);
  if (fails.length) { console.log('\nכשלים:'); fails.forEach(f => console.log(' • ' + f)); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nהרצה נכשלה:', e.message, '\n', e.stack); process.exit(2); });
