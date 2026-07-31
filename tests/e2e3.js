const {boot,tick,mkServer}=require('./harness');
let pass=0,fail=0;const fails=[];
function ok(n,c,d){if(c){pass++;console.log('  ✓ '+n);}else{fail++;fails.push(n);console.log('  ✗ '+n+(d?' → '+d:''));}}
function head(t){console.log('\n'+t);}
const WH={afcon_reporter:'אבי'};

(async()=>{
  head('21 · שומר אורך הכתובת — טקסט ארוך נחסם עם הודעה במקום להיעלם');
  {
    const S=mkServer();
    const {w}=await boot('index.html',{server:S,storage:WH});
    await tick(300);
    let threw=null;
    try{ await w.apiSend({id:'X1',sku:'1',note:'נ'.repeat(900),reporter:'אבי'}); }
    catch(e){ threw=e; }
    ok('נזרקה שגיאה מפורשת', !!threw && !!threw.tooLong, threw?threw.message:'לא נזרק');
    ok('הבקשה לא הגיעה לשרת', S.calls.filter(c=>c.action==='create').length===0, 'create: '+S.calls.filter(c=>c.action==='create').length);

    // טקסט תקין עדיין עובר
    S.calls=[];
    const r=await w.apiSend({id:'X2',sku:'2',note:'נ'.repeat(150),reporter:'אבי'});
    ok('טקסט באורך סביר עובר כרגיל', r && r.ok);
    w.closed=true;
  }

  head('22 · תקרות על שדות הקלט');
  {
    const S=mkServer();
    const {w}=await boot('index.html',{server:S,storage:WH});
    await tick(300);
    const note=w.document.getElementById('noteText');
    ok('שדה ההערה מוגבל ל-220', note && note.getAttribute('maxlength')==='220', note?note.getAttribute('maxlength'):'?');
    w.closed=true;
    const S2=mkServer();
    const B=await boot('dashboard.html',{server:S2,storage:{afcon_me:'דנה'}});
    await tick(500);
    const src=B.w.document.documentElement.innerHTML;
    ok('תיבת הצ׳אט בלוח מוגבלת', /class="gin" maxlength="250"/.test(src));
    B.w.closed=true;
  }

  head('23 · דיווח ארוך מדי בתור לא נתקע בלולאת ניסיונות');
  {
    const S=mkServer();
    const {w}=await boot('index.html',{server:S,storage:WH});
    await tick(300);
    // מכניסים ידנית לתור דיווח שלא ניתן לשלוח לעולם
    w.eval(`(function(){var q=obxLoad();q.push({id:'BIG',payload:{id:'BIG',sku:'9',note:'נ'.repeat(1200),reporter:'אבי'},photos:[],t:Date.now(),tries:0,label:'ארוך'});obxSave(q);})()`);
    ok('הדיווח בתור', w.obxLoad().length===1);
    await w.obxFlush(true);
    await tick(400);
    ok('הוסר מהתור במקום להיתקע', w.obxLoad().length===0, 'בתור '+w.obxLoad().length);
    w.closed=true;
  }

  head('24 · מדידה חוזרת אחרי התיקון — התקרה מונעת חריגה');
  {
    const S=mkServer();
    const {w}=await boot('index.html',{server:S,storage:WH});
    await tick(300);
    S.lastUrlLength=0;
    await w.apiSend({id:'M1',type:'פריט פגום',sku:'1112223',desc:'תיאור פריט',
      note:'נ'.repeat(220),reporter:'ישראל ישראלי',urgency:'דחוף',recipients:'כל הצוות'});
    await tick(60);
    console.log('     הערה במלוא התקרה (220) → כתובת '+S.lastUrlLength+' תווים');
    ok('נשאר מתחת לגבול הבטוח', S.lastUrlLength>0 && S.lastUrlLength<=1900, String(S.lastUrlLength));
    w.closed=true;
  }

  console.log('\n'+'='.repeat(54));
  console.log('עברו: '+pass+'   נכשלו: '+fail);
  if(fails.length){console.log('כשלים:');fails.forEach(f=>console.log(' • '+f));}
  process.exit(fail?1:0);
})().catch(e=>{console.error('הרצה נכשלה:',e.message,e.stack);process.exit(2);});
