const {boot,tick,mkServer}=require('./harness');
let pass=0,fail=0;const fails=[];
function ok(n,c,d){if(c){pass++;console.log('  ✓ '+n);}else{fail++;fails.push(n);console.log('  ✗ '+n+(d?' → '+d:''));}}
function head(t){console.log('\n'+t);}
const DB={afcon_me:'דנה'};
function mkAlert(id,seq){return{id:id,ticket:'26-'+String(seq).padStart(4,'0'),type:'חוסר מלאי',
  sku:'800'+seq,desc:'פריט '+seq,qty:'1',urgency:'דחוף',reporter:'אבי',status:'ממתין',
  assignee:'',response:'',chat:'',created:new Date().toISOString(),updated:new Date().toISOString()};}

(async()=>{
  head('27 · פנייה חדשה מופיעה בלי רענון ידני');
  {
    const S=mkServer(); S.alerts=[mkAlert('A1',1)];
    const {w}=await boot('dashboard.html',{server:S,storage:DB});
    await tick(700);
    ok('בהתחלה — כרטיס אחד', w.document.querySelectorAll('#list .card').length===1);

    // מחסנאי שולח בזמן שהלוח פתוח — בלי שאף אחד נגע בו
    S.alerts.push(mkAlert('A2',2));
    console.log('     ...ממתין לעדכון אוטומטי (בלי לגעת במסך)');
    await tick(12000);
    const n=w.document.querySelectorAll('#list .card').length;
    ok('הכרטיס החדש הופיע מעצמו', n===2, 'כרטיסים: '+n);
    const toast=w.document.getElementById('toast');
    ok('הוצגה התראה', /דיווח חדש/.test(toast.textContent), toast.textContent);
    w.closed=true;
  }

  head('28 · הקלדה בצ׳אט אינה נמחקת ברענון (הבאג ששיתק את הרענון)');
  {
    const S=mkServer(); S.alerts=[mkAlert('A1',1)];
    const {w}=await boot('dashboard.html',{server:S,storage:DB});
    await tick(700);
    // פותחים צ׳אט ומקלידים
    const card=w.document.querySelector('#list .card');
    const chat=card.querySelector('.genchat'); if(chat) chat.classList.add('open');
    let gin=card.querySelector('.gin');
    ok('נמצאה תיבת צ׳אט', !!gin);
    gin.value='הזמנתי מהספק, מגיע ביום ראשון';
    gin.focus();
    const before=gin.value;

    // מגיעה פנייה חדשה → רענון מלא
    S.alerts.push(mkAlert('A2',2));
    await w.load();
    await tick(400);

    const card2=w.document.querySelector('.card[data-id="A1"]');
    const gin2=card2?card2.querySelector('.gin'):null;
    ok('הטקסט שהוקלד שרד', gin2 && gin2.value===before, gin2?('"'+gin2.value+'"'):'התיבה נעלמה');
    ok('הפוקוס חזר לתיבה', w.document.activeElement===gin2);
    ok('גם הפנייה החדשה נטענה', w.document.querySelectorAll('#list .card').length===2);
    w.closed=true;
  }

  head('29 · סמן בתוך שדה כבר לא מקפיא את הלוח');
  {
    const S=mkServer(); S.alerts=[mkAlert('A1',1)];
    const {w}=await boot('dashboard.html',{server:S,storage:DB});
    await tick(700);
    const card=w.document.querySelector('#list .card');
    const chat=card.querySelector('.genchat'); if(chat) chat.classList.add('open');
    const gin=card.querySelector('.gin'); if(gin){ gin.value='טיוטה'; gin.focus(); }
    ok('הסמן בתוך שדה טקסט', !!w.document.activeElement && w.document.activeElement.classList.contains('gin'));

    S.alerts.push(mkAlert('A2',2));
    console.log('     ...הסמן נשאר בשדה, ממתין לעדכון אוטומטי');
    await tick(12000);
    const n=w.document.querySelectorAll('#list .card').length;
    ok('הפנייה החדשה נכנסה למרות ההקלדה', n===2, 'כרטיסים: '+n);
    w.closed=true;
  }

  head('30 · חיווי "חי" משקף את המצב');
  {
    const S=mkServer(); S.alerts=[mkAlert('A1',1)];
    const {w}=await boot('dashboard.html',{server:S,storage:DB});
    await tick(800);
    const tag=w.document.getElementById('liveTag');
    ok('החיווי קיים', !!tag);
    ok('מצב תקין = ירוק', tag && !/err|paused/.test(tag.className), tag?tag.className:'');
    console.log('     חיווי: "'+(w.document.getElementById('liveTxt')||{}).textContent+'"');

    S.mode='offline';
    await w.load(); await tick(300);
    w.eval('liveMark()');
    ok('נפילת רשת → חיווי אזהרה', /err/.test(w.document.getElementById('liveTag').className),
       w.document.getElementById('liveTag').className);
    console.log('     חיווי: "'+(w.document.getElementById('liveTxt')||{}).textContent+'"');
    w.closed=true;
  }

  head('31 · קצב השליפה מותאם — פעיל מול רקע');
  {
    const S=mkServer(); S.alerts=[mkAlert('A1',1)];
    const {w}=await boot('dashboard.html',{server:S,storage:DB});
    await tick(700);
    const fast=w.eval('liveInterval()');
    ok('משתמש פעיל → קצב מהיר (10 שניות)', fast===10000, String(fast));
    w.eval('LAST_ACT = Date.now() - 300000');   // חמש דקות ללא פעילות
    const slow=w.eval('liveInterval()');
    ok('ללא פעילות → קצב חסכוני (30 שניות)', slow===30000, String(slow));
    w.closed=true;
  }

  console.log('\n'+'='.repeat(52));
  console.log('עברו: '+pass+'   נכשלו: '+fail);
  if(fails.length) fails.forEach(f=>console.log(' • '+f));
  process.exit(fail?1:0);
})().catch(e=>{console.error('נכשל:',e.message,e.stack);process.exit(2);});
