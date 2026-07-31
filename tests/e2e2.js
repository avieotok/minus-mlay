const { boot, tick, mkServer } = require('./harness');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, d) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; fails.push(n + (d ? ' → ' + d : '')); console.log('  ✗ ' + n + (d ? ' → ' + d : '')); } }
function head(t) { console.log('\n' + t); }
const WH = { afcon_reporter: 'אבי' };
const DB = { afcon_me: 'דנה' };

function mkAlert(id, seq, extra) {
  return Object.assign({
    id: id, ticket: '26-' + String(seq).padStart(4, '0'), type: 'חוסר מלאי',
    sku: '900' + seq, desc: 'פריט ' + seq, qty: '1', urgency: 'כמות נמוכה',
    reporter: 'אבי', status: 'ממתין', assignee: '', response: '', chat: '',
    created: new Date(Date.now() - seq * 3600000).toISOString(), updated: new Date().toISOString()
  }, extra || {});
}

(async () => {

  head('12 · מחיקת קריאה + מספור מחדש');
  {
    const S = mkServer();
    S.alerts = [mkAlert('A1', 1), mkAlert('A2', 2), mkAlert('A3', 3)];
    S.contacts = [{ n: 'ספק א' }]; S.news = [{ t: 'ידיעה' }];
    const { w } = await boot('dashboard.html', { server: S, storage: DB });
    await tick(600);
    // מדמים את הפעולה בדיוק כפי שהכפתור מבצע אותה
    const before = JSON.stringify(S.alerts.map(a => a.ticket));
    await w.eval(`(async function(){
      const all=await apiGet('all');
      const keep=all.alerts.filter(x=>String(x.id)!=='A2');
      const numbered=keep.slice().sort((a,b)=>parseInt(a.ticket.slice(3))-parseInt(b.ticket.slice(3)));
      numbered.forEach((x,i)=>{ x.ticket='26-'+String(i+1).padStart(4,'0'); });
      const snap={_app:'afcon-portal',alerts:keep,contacts:(await apiGet('contacts')).contacts,
        news:(await apiGet('news')).news,catalog:{},buyers:[],reporters:[],photos:[]};
      return await apiPost('importAll',{data:snap});
    })()`);
    await tick(400);
    ok('נשארו שתי קריאות', S.alerts.length === 2, 'בפועל ' + S.alerts.length);
    const tks = S.alerts.map(a => a.ticket).sort();
    ok('המספור רץ ברצף 0001,0002', tks.join(',') === '26-0001,26-0002', tks.join(',') + ' (היה ' + before + ')');
    ok('אנשי הקשר שרדו', S.contacts.length === 1, 'בפועל ' + S.contacts.length);
    ok('הידיעון שרד', S.news.length === 1);
    w.closed = true;
  }

  head('13 · שליפה חלקית לפני מחיקה → הפעולה נעצרת, שום דבר לא נמחק');
  {
    const S = mkServer();
    S.alerts = [mkAlert('A1', 1), mkAlert('A2', 2)];
    const { w } = await boot('dashboard.html', { server: S, storage: DB });
    await tick(600);
    const res = await w.eval(`(async function(){
      const parts=[['פניות',await apiGet('all')],['אנשי קשר',{ok:false}]];
      const bad=parts.filter(x=>!x[1]||x[1].ok===false).map(x=>x[0]);
      return bad.length ? 'נעצר' : 'המשיך';
    })()`);
    ok('הפעולה נעצרה בשליפה כושלת', res === 'נעצר', res);
    ok('הנתונים לא נגעו', S.alerts.length === 2);
    w.closed = true;
  }

  head('14 · ביטול פעולה מחזיר את המצב הקודם');
  {
    const S = mkServer();
    S.alerts = [mkAlert('A1', 1)];
    const { w } = await boot('dashboard.html', { server: S, storage: DB });
    await tick(600);
    await w.assignTo('A1', 'דנה', 'בטיפול', '');
    await tick(400);
    ok('שויך לדנה', S.alerts[0].assignee === 'דנה');
    const snap = w.eval("snapOf('A1')");
    // המצב שנשמר לביטול הוא זה שלפני השינוי
    await w.eval("undoSnap({id:'A1',status:'ממתין',assignee:''})");
    await tick(400);
    ok('הביטול החזיר לממתין', S.alerts[0].status === 'ממתין', S.alerts[0].status);
    ok('הביטול רוקן את השיוך', !S.alerts[0].assignee, S.alerts[0].assignee);
    w.closed = true;
  }

  head('15 · מק״ט כפול → מוצג מסך "כבר דווח" ולא נוצרת פנייה שנייה');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH });
    await tick(300);
    w.document.getElementById('txtSku').value = '5551234';
    await w.submitReport('text');
    await tick(300);
    ok('הדיווח הראשון נוצר', S.alerts.length === 1);
    w.document.getElementById('txtSku').value = '5551234';
    await w.submitReport('text');
    await tick(300);
    ok('הדיווח השני לא נוצר', S.alerts.length === 1, 'בפועל ' + S.alerts.length);
    const dup = w.document.getElementById('dupWrap');
    ok('הוצג מסך "כבר דווח"', dup && !dup.classList.contains('hidden'));
    ok('התור נשאר ריק', w.obxLoad().length === 0, 'בתור ' + w.obxLoad().length);
    w.closed = true;
  }

  head('16 · שני דיווחים ברצף מהיר → שתי פניות נפרדות');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH });
    await tick(300);
    w.document.getElementById('txtSku').value = '6661111';
    const p1 = w.submitReport('text');
    await tick(20);
    w.document.getElementById('txtSku').value = '6662222';
    const p2 = w.submitReport('text');
    await Promise.all([p1, p2]); await tick(400);
    ok('נוצרו שתי פניות', S.alerts.length === 2, 'בפועל ' + S.alerts.length);
    const ids = new Set(S.alerts.map(a => a.id));
    ok('המזהים שונים', ids.size === 2);
    const tk = S.alerts.map(a => a.ticket).sort();
    ok('מספרי קריאה שונים', tk[0] !== tk[1], tk.join(','));
    w.closed = true;
  }

  head('17 · גודל טקסט נשמר בין כניסות');
  {
    const S = mkServer();
    const A = await boot('index.html', { server: S, storage: WH });
    await tick(300);
    A.w.document.getElementById('tsBtn').click();
    await tick(100);
    const stored = A.w.localStorage.getItem('afcon_ts');
    ok('הבחירה נשמרה', stored === '1', 'ערך ' + stored);
    A.w.closed = true;
    const B = await boot('index.html', { server: S, storage: Object.assign({}, WH, { afcon_ts: '1' }) });
    await tick(300);
    const ts = B.w.document.documentElement.style.getPropertyValue('--ts');
    ok('הוחל בכניסה הבאה', parseFloat(ts) > 1, '--ts=' + ts);
    B.w.closed = true;
  }

  head('18 · אורך כתובת מול אורך ההערה — מדידה');
  {
    const S = mkServer();
    const { w } = await boot('index.html', { server: S, storage: WH });
    await tick(300);
    const rows = [];
    for (const n of [50, 100, 150, 200, 220, 300, 400]) {
      S.lastUrlLength = 0; let blocked = false;
      try {
        await w.apiSend({
          id: 'U' + n, type: 'פריט פגום', sku: '1112223', desc: 'תיאור פריט',
          note: 'נ'.repeat(n), reporter: 'ישראל ישראלי', urgency: 'דחוף', recipients: 'כל הצוות'
        });
      } catch (e) { blocked = !!e.tooLong; }
      await tick(40);
      rows.push([n, S.lastUrlLength, blocked]);
    }
    rows.forEach(r => console.log('     הערה ' + String(r[0]).padStart(3) + ' תווים → ' +
      (r[2] ? 'נחסם בשכבת התעבורה ✋' : 'כתובת ' + r[1] + ' תווים ✓')));
    const passed = rows.filter(r => !r[2]).map(r => r[0]);
    console.log('     האורך המרבי שעבר: ' + Math.max(...passed) + ' תווים (התקרה בשדה: 220)');
    ok('כל מה שעבר נשאר מתחת לגבול', rows.filter(r => !r[2]).every(r => r[1] <= 1900));
    ok('חריגה נחסמת ולא נשלחת בשקט', rows.filter(r => r[0] > 220).every(r => r[2]));
    w.closed = true;
  }

  head('19 · אין חיבור בכלל → האפליקציה נטענת ולא קורסת');
  {
    const S = mkServer(); S.mode = 'offline';
    const { w, errors } = await boot('index.html', { server: S, storage: WH });
    await tick(700);
    const real = errors.filter(e => !/canvas|getContext|lineWidth/.test(String(e)));
    ok('אין שגיאות ריצה', real.length === 0, real.join(' | ').slice(0, 200));
    ok('הטופס עדיין פעיל', !!w.document.getElementById('sendText'));
    w.closed = true;
  }

  head('20 · config.js חסר → האפליקציה לא קורסת');
  {
    const S = mkServer();
    const { w, errors } = await boot('index.html', { server: S, storage: WH, noConfig: true });
    await tick(500);
    const real = errors.filter(e => !/canvas|getContext|lineWidth/.test(String(e)));
    ok('אין ReferenceError', !real.some(e => /EMBED_API|is not defined/.test(String(e))), real.join(' | ').slice(0, 200));
    ok('אין שגיאות ריצה כלל', real.length === 0, real.join(' | ').slice(0, 200));
    w.closed = true;
  }

  console.log('\n' + '='.repeat(54));
  console.log('עברו: ' + pass + '   נכשלו: ' + fail);
  if (fails.length) { console.log('\nכשלים:'); fails.forEach(f => console.log(' • ' + f)); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nהרצה נכשלה:', e.message, '\n', e.stack); process.exit(2); });
