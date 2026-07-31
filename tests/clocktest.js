const {boot,tick,mkServer}=require('./harness');
let pass=0,fail=0;const fails=[];
function ok(n,c,d){if(c){pass++;console.log('  ✓ '+n);}else{fail++;fails.push(n);console.log('  ✗ '+n+(d?' → '+d:''));}}
(async()=>{
  console.log('\n25 · שעון ותאריך — שתי האפליקציות');
  for(const f of ['index.html','dashboard.html']){
    const S=mkServer();
    const {w,errors}=await boot(f,{server:S,storage:{afcon_reporter:'אבי',afcon_me:'דנה'}});
    await tick(500);
    const bar=w.document.getElementById('clockBar');
    ok(f+' — הרכיב קיים', !!bar);
    const txt=bar?bar.textContent:'';
    console.log('     ['+f+'] '+txt);
    ok(f+' — מוצגת שעה', /\d{2}:\d{2}:\d{2}/.test(txt), txt);
    ok(f+' — מוצג יום בשבוע', /יום\s+\S+/.test(txt), txt);
    ok(f+' — מוצג תאריך לועזי', /\d{2}\.\d{2}\.\d{4}/.test(txt), txt);
    ok(f+' — מוצג תאריך עברי', /5\d{3}/.test(txt), txt);
    const real=errors.filter(e=>!/canvas|getContext|lineWidth/.test(String(e)));
    ok(f+' — אין שגיאות ריצה', real.length===0, real.join('|').slice(0,150));
    w.closed=true;
  }

  console.log('\n26 · השעון מתקדם בזמן אמת');
  {
    const S=mkServer();
    const {w}=await boot('index.html',{server:S,storage:{afcon_reporter:'אבי'}});
    await tick(300);
    const bar=w.document.getElementById('clockBar');
    const t1=bar.querySelector('.clk-time').textContent;
    await tick(1400);
    const t2=bar.querySelector('.clk-time').textContent;
    ok('השעה השתנתה אחרי שנייה', t1!==t2, t1+' → '+t2);
    w.closed=true;
  }

  console.log('\n'+'='.repeat(50));
  console.log('עברו: '+pass+'   נכשלו: '+fail);
  if(fails.length) fails.forEach(f=>console.log(' • '+f));
  process.exit(fail?1:0);
})().catch(e=>{console.error('נכשל:',e.message,e.stack);process.exit(2);});
