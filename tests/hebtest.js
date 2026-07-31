// בדיקת החלפת התאריך העברי בשקיעה — מול תאריכים ידועים
function sunsetOn(date, lat, lon) {
  var rad=Math.PI/180, deg=180/Math.PI;
  var start=Date.UTC(1970,0,1);
  var day=Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-start)/86400000);
  var n=Math.round(day+2440587.5-2451545.0+0.0008-(-lon/360));
  var jStar=n+0.0009+(-lon/360);
  var M=(357.5291+0.98560028*jStar)%360;
  var C=1.9148*Math.sin(M*rad)+0.02*Math.sin(2*M*rad)+0.0003*Math.sin(3*M*rad);
  var lam=(M+C+180+102.9372)%360;
  var jT=2451545.0+jStar+0.0053*Math.sin(M*rad)-0.0069*Math.sin(2*lam*rad);
  var decl=Math.asin(Math.sin(lam*rad)*Math.sin(23.44*rad));
  var cosH=(Math.sin(-0.833*rad)-Math.sin(lat*rad)*Math.sin(decl))/(Math.cos(lat*rad)*Math.cos(decl));
  if(cosH>1||cosH<-1) return null;
  return new Date((jT+Math.acos(cosH)*deg/360-2440587.5)*86400000);
}
function heb(now){
  const d=new Date(now.getTime());
  const ss=sunsetOn(now,31.9,34.8);
  if(ss && now.getTime()>=ss.getTime()) d.setDate(d.getDate()+1);
  return new Intl.DateTimeFormat('he-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric'}).format(d);
}
const IL = s => new Date(s); // שעות ישראל (UTC+3 בקיץ)
console.log('בדיקת מעבר בשקיעה — 31.7.2026, שקיעה בישראל ~19:40\n');
[['2026-07-31T15:00:00+03:00','אחה״צ (לפני שקיעה)'],
 ['2026-07-31T19:00:00+03:00','19:00 (לפני שקיעה)'],
 ['2026-07-31T20:30:00+03:00','20:30 (אחרי שקיעה)'],
 ['2026-07-31T23:30:00+03:00','לפני חצות'],
 ['2026-08-01T01:00:00+03:00','אחרי חצות']
].forEach(([t,label])=>console.log(label.padEnd(24),'→',heb(IL(t))));
console.log('\nמצופה: לפני השקיעה = יז באב · אחרי השקיעה = יח באב, כולל אחרי חצות.');
console.log('\nבדיקת שנה מעוברת (אדר א׳/ב׳):');
[['2027-03-01T12:00:00+02:00'],['2024-03-15T12:00:00+02:00']].forEach(([t])=>
  console.log('  ',t.slice(0,10),'→',heb(new Date(t))));
console.log('\nראש השנה 5787 — 11.9.2026 בערב:');
console.log('   11.9 16:00 →',heb(new Date('2026-09-11T16:00:00+03:00')));
console.log('   11.9 20:00 →',heb(new Date('2026-09-11T20:00:00+03:00')),' ← אמור לעבור לא׳ בתשרי');
