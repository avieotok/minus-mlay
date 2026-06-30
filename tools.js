/* כלים משותפים — רשימות, ספר טלפונים, ממיר מטבעות וממיר שטחים.
   חולץ מתוך index.html ו-dashboard.html (היה משוכפל בייט-בבייט בשניהם).
   רץ ב-scope גלובלי בדיוק כמו קודם. */

(function(){
  var $=function(id){return document.getElementById(id);};
  var modal=$('tkModal'); if(!modal) return;
  function esc(s){ return (s||'').toString().replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  /* ---------- גישה לשרת (לספר טלפונים משותף) ---------- */
  function apiCfg(){ var a=window.__AFCON_API||{}; return {url:(a.url||'').trim(), token:(a.token||'').trim()}; }
  function myName(){ try{ return (localStorage.getItem('afcon_me')||localStorage.getItem('afcon_reporter')||'').trim(); }catch(e){ return ''; } }
  function srvGet(action, params){
    return new Promise(function(resolve){
      var c=apiCfg(); if(!c.url){ resolve(null); return; }
      var cb='tkcb'+Date.now()+Math.floor(Math.random()*100000);
      var qs='?action='+encodeURIComponent(action)+'&token='+encodeURIComponent(c.token)+'&callback='+cb;
      var pr=params||{}; for(var k in pr){ qs+='&'+encodeURIComponent(k)+'='+encodeURIComponent(pr[k]); }
      qs+='&_='+Date.now();
      var s=document.createElement('script'); var done=false;
      window[cb]=function(data){ done=true; try{ delete window[cb]; }catch(e){} try{ s.remove(); }catch(e){} resolve(data); };
      s.onerror=function(){ if(!done){ try{ delete window[cb]; }catch(e){} try{ s.remove(); }catch(e){} resolve(null); } };
      s.src=c.url+qs; document.body.appendChild(s);
      setTimeout(function(){ if(!done){ try{ delete window[cb]; }catch(e){} try{ s.remove(); }catch(e){} resolve(null); } }, 15000);
    });
  }
  function srvPost(payload){
    var c=apiCfg(); if(!c.url) return Promise.resolve();
    return fetch(c.url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({token:c.token},payload))}).catch(function(){});
  }

  var opener=$('tkOpen'); if(opener) opener.addEventListener('click', function(){ modal.classList.add('open'); renderLists(); });
  $('tkClose').addEventListener('click', function(){ modal.classList.remove('open'); try{ recStop(); }catch(e){} });
  modal.addEventListener('click', function(e){ if(e.target===modal){ modal.classList.remove('open'); try{ recStop(); }catch(e){} } });
  var tabs=modal.querySelectorAll('.tk-tab');
  tabs.forEach(function(t){ t.addEventListener('click', function(){
    tabs.forEach(function(x){ x.classList.toggle('on', x===t); });
    var v=t.getAttribute('data-tk');
    $('tkLists').hidden=(v!=='lists'); $('tkPhone').hidden=(v!=='phone'); $('tkCur').hidden=(v!=='cur'); $('tkArea').hidden=(v!=='area'); $('tkRec').hidden=(v!=='rec');
    var _np={todo:'tkTodo',decode:'tkDecode'};
    for(var _k in _np){ var _el=$(_np[_k]); if(_el) _el.hidden=(v!==_k); }
    if(v!=='rec'){ try{ recStop(); }catch(e){} }
    if(v==='phone'){ renderPhones(); loadShared(); } if(v==='cur') openCur(); if(v==='area') openArea(); if(v==='rec') initRec();
    if(v==='todo') openTodo(); if(v==='decode') openDecode();
  }); });

  /* ---------- רשימות ---------- */
  var LK='afcon_tools_lists';
  function loadLists(){ try{ return JSON.parse(localStorage.getItem(LK)||'[]')||[]; }catch(e){ return []; } }
  function saveLists(){ try{ localStorage.setItem(LK, JSON.stringify(LISTS)); }catch(e){} }
  var LISTS=loadLists();
  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function renderLists(){
    var box=$('tkLists');
    var html='<button class="tk-newlist" id="tkNewList">➕ רשימה חדשה</button>';
    if(!LISTS.length){ html+='<div class="tk-empty">אין רשימות עדיין. צור/י רשימה חדשה.</div>'; }
    LISTS.forEach(function(L){
      var items=(L.items||[]).map(function(it){
        if(it.type==='draw'){ return '<div class="tk-item'+(it.done?' done':'')+'" data-iid="'+it.id+'"><input type="checkbox" '+(it.done?'checked':'')+'><div class="tk-iimg"><img src="'+it.img+'"></div><button class="tk-idel">✕</button></div>'; }
        if(it.type==='audio'){ return '<div class="tk-item'+(it.done?' done':'')+'" data-iid="'+it.id+'"><input type="checkbox" '+(it.done?'checked':'')+'><div class="tk-iaudio"><span class="tk-aud-ic">🎙️</span><audio controls preload="metadata" src="'+it.audio+'"></audio></div><button class="tk-idel">✕</button></div>'; }
        return '<div class="tk-item'+(it.done?' done':'')+'" data-iid="'+it.id+'"><input type="checkbox" '+(it.done?'checked':'')+'><span class="tk-itext">'+esc(it.text)+'</span><button class="tk-idel">✕</button></div>';
      }).join('');
      if(!items) items='<div class="tk-empty">רשימה ריקה</div>';
      html+='<div class="tk-list" data-id="'+L.id+'">'
        +'<div class="tk-list-head"><input class="tk-list-name" value="'+esc(L.name)+'"><button class="tk-dellist" title="מחק רשימה">🗑️</button></div>'
        +'<div class="tk-items">'+items+'</div>'
        +'<div class="tk-additem"><input class="tk-iteminput" placeholder="הוסף נושא…"><button class="tk-add" title="הוסף">➕</button><button class="tk-mic" title="הקלטת שמע">🎤</button><button class="tk-drawbtn" title="כתב יד / ציור">✏️</button></div>'
        +'</div>';
    });
    box.innerHTML=html;
  }
  function listById(id){ for(var i=0;i<LISTS.length;i++){ if(LISTS[i].id===id) return LISTS[i]; } return null; }
  $('tkLists').addEventListener('click', function(e){
    var t=e.target;
    if(t.id==='tkNewList'){ LISTS.unshift({id:uid(), name:'רשימה חדשה', items:[]}); saveLists(); renderLists(); return; }
    var listEl=t.closest('.tk-list'); if(!listEl) return; var L=listById(listEl.getAttribute('data-id')); if(!L) return;
    if(t.classList.contains('tk-dellist')){ if(confirm('למחוק את הרשימה "'+L.name+'"?')){ LISTS=LISTS.filter(function(x){return x!==L;}); saveLists(); renderLists(); } return; }
    if(t.classList.contains('tk-add')){ var inp=listEl.querySelector('.tk-iteminput'); addText(L, inp.value); inp.value=''; renderLists(); return; }
    if(t.classList.contains('tk-mic')){ startAudio(L, t); return; }
    if(t.classList.contains('tk-drawbtn')){ openDraw(L); return; }
    if(t.classList.contains('tk-idel')){ var iid=t.closest('.tk-item').getAttribute('data-iid'); L.items=(L.items||[]).filter(function(x){return x.id!==iid;}); saveLists(); renderLists(); return; }
    if(t.classList.contains('tk-itext')){ var iid2=t.closest('.tk-item').getAttribute('data-iid'); var it=findItem(L,iid2); if(it){ var nv=prompt('עריכת פריט:', it.text); if(nv!==null){ it.text=nv.trim(); saveLists(); renderLists(); } } return; }
  });
  $('tkLists').addEventListener('change', function(e){
    var t=e.target; var listEl=t.closest('.tk-list'); if(!listEl) return; var L=listById(listEl.getAttribute('data-id')); if(!L) return;
    if(t.type==='checkbox'){ var iid=t.closest('.tk-item').getAttribute('data-iid'); var it=findItem(L,iid); if(it){ it.done=t.checked; saveLists(); renderLists(); } return; }
    if(t.classList.contains('tk-list-name')){ L.name=t.value.trim()||'רשימה'; saveLists(); return; }
  });
  $('tkLists').addEventListener('keydown', function(e){
    if(e.key==='Enter' && e.target.classList.contains('tk-iteminput')){ var listEl=e.target.closest('.tk-list'); var L=listById(listEl.getAttribute('data-id')); if(L){ addText(L, e.target.value); e.target.value=''; renderLists(); var ne=document.querySelector('.tk-list[data-id="'+L.id+'"] .tk-iteminput'); if(ne) ne.focus(); } }
  });
  function findItem(L,iid){ var a=L.items||[]; for(var i=0;i<a.length;i++){ if(a[i].id===iid) return a[i]; } return null; }
  function addText(L, txt){ txt=(txt||'').trim(); if(!txt) return; L.items=L.items||[]; L.items.push({id:uid(), type:'text', text:txt, done:false}); saveLists(); }

  /* ---------- הקלטת שמע אמיתית (מיקרופון → קובץ שמור בפריט, עם נגן ▶️) ---------- */
  var mediaRec=null, recChunks=[], recBtnA=null, recListA=null;
  function resetMicBtn(){ if(recBtnA){ recBtnA.classList.remove('rec'); recBtnA.textContent='🎤'; recBtnA.title='הקלטת שמע'; } }
  function cleanupRec(){ resetMicBtn(); mediaRec=null; recChunks=[]; recBtnA=null; recListA=null; }
  function startAudio(L, btn){
    if(mediaRec){ try{ if(mediaRec.state!=='inactive') mediaRec.stop(); }catch(e){} return; } // כבר מקליט → עצור
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder==='undefined'){
      alert('הקלטת שמע אינה נתמכת בדפדפן זה. נסה/י בכרום/ספארי מעודכן.'); return;
    }
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      try{ mediaRec=new MediaRecorder(stream); }catch(e){ try{ mediaRec=new MediaRecorder(stream,{mimeType:'audio/webm'}); }catch(e2){ alert('ההקלטה נכשלה.'); try{ stream.getTracks().forEach(function(t){t.stop();}); }catch(x){} return; } }
      recChunks=[]; recBtnA=btn; recListA=L;
      mediaRec.ondataavailable=function(ev){ if(ev.data && ev.data.size>0) recChunks.push(ev.data); };
      mediaRec.onstop=function(){
        try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
        var blob=new Blob(recChunks, { type:(mediaRec && mediaRec.mimeType) ? mediaRec.mimeType : 'audio/webm' });
        var L2=recListA;
        var fr=new FileReader();
        fr.onload=function(){
          var data=fr.result;
          if(data && data.length>2600000){ alert('ההקלטה ארוכה/כבדה מדי לשמירה במכשיר. נסה/י הקלטה קצרה יותר.'); cleanupRec(); return; }
          if(L2){ L2.items=L2.items||[]; L2.items.push({ id:uid(), type:'audio', audio:data, done:false });
            try{ localStorage.setItem(LK, JSON.stringify(LISTS)); }
            catch(err){ L2.items.pop(); alert('אין מקום לשמור את ההקלטה במכשיר (האחסון מלא). מחק/י הקלטות ישנות ונסה/י שוב.'); cleanupRec(); renderLists(); return; }
          }
          cleanupRec(); renderLists();
        };
        fr.readAsDataURL(blob);
      };
      try{ mediaRec.start(); }catch(e){ alert('ההקלטה נכשלה.'); cleanupRec(); return; }
      if(btn){ btn.classList.add('rec'); btn.textContent='⏹'; btn.title='עצור הקלטה'; }
    }).catch(function(){ alert('לא ניתן לגשת למיקרופון. אשר/י הרשאת מיקרופון ונסה/י שוב.'); });
  }

  /* ---------- כתב יד / ציור ---------- */
  var drawWrap=$('tkDraw'), cv=$('tkCanvas'), cx=cv.getContext('2d'), drawing=false, drawList=null;
  cx.lineWidth=3; cx.lineCap='round'; cx.lineJoin='round'; cx.strokeStyle='#111';
  function fitCanvas(){
    var bar=drawWrap.querySelector('.tk-draw-bar');
    var barH=bar?bar.offsetHeight:56;
    var w=Math.max(200, window.innerWidth);
    var h=Math.max(200, window.innerHeight-barH);
    cv.width=w; cv.height=h; cv.style.width=w+'px'; cv.style.height=h+'px';
    cx.lineWidth=3; cx.lineCap='round'; cx.lineJoin='round'; cx.strokeStyle='#111';
    cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height);
  }
  function pos(e){ var r=cv.getBoundingClientRect(); var sx=cv.width/r.width, sy=cv.height/r.height; var p=(e.touches&&e.touches[0])||e; return {x:(p.clientX-r.left)*sx, y:(p.clientY-r.top)*sy}; }
  function dstart(e){ e.preventDefault(); drawing=true; var p=pos(e); cx.beginPath(); cx.moveTo(p.x,p.y); }
  function dmove(e){ if(!drawing) return; e.preventDefault(); var p=pos(e); cx.lineTo(p.x,p.y); cx.stroke(); }
  function dend(){ drawing=false; }
  cv.addEventListener('mousedown',dstart); cv.addEventListener('mousemove',dmove); window.addEventListener('mouseup',dend);
  cv.addEventListener('touchstart',dstart,{passive:false}); cv.addEventListener('touchmove',dmove,{passive:false}); cv.addEventListener('touchend',dend);
  function openDraw(L){ drawList=L; drawWrap.classList.add('open'); fitCanvas(); }
  $('tkDClear').addEventListener('click', function(){ cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); });
  $('tkDCancel').addEventListener('click', function(){ drawWrap.classList.remove('open'); drawList=null; });
  $('tkDSave').addEventListener('click', function(){ if(drawList){ var img=cv.toDataURL('image/png'); drawList.items=drawList.items||[]; drawList.items.push({id:uid(), type:'draw', img:img, done:false}); saveLists(); renderLists(); } drawWrap.classList.remove('open'); drawList=null; });
  var tkWaBtn=$('tkDWa');
  if(tkWaBtn) tkWaBtn.addEventListener('click', function(){
    try{
      cv.toBlob(function(blob){
        if(!blob) return;
        var file=null; try{ file=new File([blob],'list-note.png',{type:'image/png'}); }catch(e){}
        if(file && navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({files:[file], title:'רשימה — שרשרת האספקה'}).catch(function(){});
        } else {
          var u=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=u; a.download='list-note.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },1500);
          alert('שיתוף ישיר לא נתמך במכשיר זה — התמונה הורדה, אפשר לצרף אותה ידנית בוואטסאפ.');
        }
      },'image/png');
    }catch(e){}
  });

  /* ---------- ספר טלפונים (אישי + משותף) ---------- */
  var PK='afcon_tools_phones';
  function loadPhones(){ try{ return JSON.parse(localStorage.getItem(PK)||'[]')||[]; }catch(e){ return []; } }
  function savePhones(){ try{ localStorage.setItem(PK, JSON.stringify(PHONES)); }catch(e){} }
  var PHONES=loadPhones(); var SHAREDC=[]; var phEditId=null; var phEditShared=null; var sharedLoaded=false; var sharedState='idle';
  var phKind='supplier'; // ספק / לקוח
  var phLetter=''; // חוצץ אות נבחר (ריק = הכל)
  var PH_OWNER='אבידן קוטאי', PH_PIN='30172', phAdmin=false; // מחיקה מהמשותף — רק לבעלים, אחרי קוד
  function isPhOwner(){ return String(myName()||'').trim()===PH_OWNER; }
  function kindWord(){ return phKind==='customer'?'לקוח':'ספק'; }
  function kindWordThe(){ return phKind==='customer'?'הלקוח':'הספק'; }
  function ckind(c){ return (c && String(c.kind||''))==='customer' ? 'customer' : 'supplier'; }
  function setPhKindUI(){
    var s=$('tkPhSearch'); if(s) s.placeholder='חיפוש '+kindWord()+' / איש קשר…';
    var n=$('tkPhNew'); if(n) n.textContent='➕ '+kindWord()+' חדש';
    var sup=$('tkPhSupplier'); if(sup) sup.placeholder='שם ה'+kindWord();
    document.querySelectorAll('#tkPhKind .tk-kind').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-k')===phKind); });
  }
  function telLink(num){ var clean=String(num||'').replace(/[^0-9+]/g,''); return '<a class="tk-tel" href="tel:'+esc(clean)+'">📞 '+esc(num)+'</a>'; }
  function addrLink(a){ return '<a class="tk-addr" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(a)+'" target="_blank" rel="noopener">📍 '+esc(a)+'</a>'; }
  function cardLines(c){
    var lines='';
    if(c.c1) lines+='<div class="tk-line"><span class="ic">👤</span>'+esc(c.c1)+'</div>';
    if(c.c2) lines+='<div class="tk-line"><span class="ic">👤</span>'+esc(c.c2)+'</div>';
    if(c.p1) lines+='<div class="tk-line"><span class="ic"></span>'+telLink(c.p1)+'</div>';
    if(c.p2) lines+='<div class="tk-line"><span class="ic"></span>'+telLink(c.p2)+'</div>';
    if(c.addr) lines+='<div class="tk-line"><span class="ic"></span>'+addrLink(c.addr)+'</div>';
    return lines;
  }
  function matchQ(c,q){ return (String(c.supplier||'')+' '+(c.c1||'')+' '+(c.c2||'')+' '+(c.p1||'')+' '+(c.p2||'')).toLowerCase().indexOf(q)>=0; }
  function loadShared(){
    if(!apiCfg().url){ sharedState='nocfg'; sharedLoaded=true; renderPhones(); return; }
    sharedState='loading'; renderPhones();
    srvGet('contacts').then(function(r){
      if(r && r.ok && Object.prototype.toString.call(r.contacts)==='[object Array]'){ SHAREDC=r.contacts; sharedState='ok'; }
      else if(r && r.ok===false){ sharedState='noaction'; }   // השרת ענה אבל לא מכיר את הפעולה — לא נפרס מחדש
      else { sharedState='noconn'; }                            // null / timeout / אין תשובה
      sharedLoaded=true; renderPhones();
    });
  }
  function renderPhones(){
    setPhKindUI();
    var q=($('tkPhSearch').value||'').trim().toLowerCase();
    var localAll=PHONES.filter(function(c){ return ckind(c)===phKind; });
    var sharedAll=SHAREDC.filter(function(c){ return ckind(c)===phKind; });
    // אילו אותיות קיימות (לרצועת החוצצים)
    var present={}; localAll.concat(sharedAll).forEach(function(c){ present[firstLetter(c.supplier)]=true; });
    renderAzStrip(present);
    var byName=function(a,b){ return String(a.supplier||'').localeCompare(String(b.supplier||''),'he'); };
    var local=localAll.slice().sort(byName);
    var shared=sharedAll.slice().sort(byName);
    if(q){ local=local.filter(function(c){return matchQ(c,q);}); shared=shared.filter(function(c){return matchQ(c,q);}); }
    if(phLetter){ local=local.filter(function(c){return firstLetter(c.supplier)===phLetter;}); shared=shared.filter(function(c){return firstLetter(c.supplier)===phLetter;}); }
    var box=$('tkPhList'); var html='';
    var Wp=(phKind==='customer'?'לקוחות':'ספקים');
    var sharedCount=sharedAll.length;
    var st='';
    if(sharedState==='loading') st=' · טוען…';
    else if(sharedState==='ok') st=' · '+sharedCount+' '+Wp;
    else if(sharedState==='nocfg') st=' · ⚠️ אין חיבור למערכת מוגדר';
    else if(sharedState==='noconn') st=' · ⚠️ אין תשובה מהשרת — בדוק/י חיבור לאינטרנט';
    else if(sharedState==='noaction') st=' · ⚠️ השרת לא עודכן — צריך לפרוס מחדש את Code.gs';
    html+='<div class="tk-sec">🔗 '+Wp+' משותפים'+st+' <button id="tkPhReload" style="background:none;border:none;color:#60a5fa;font-weight:800;cursor:pointer;font-size:12.5px">↻ רענן</button></div>';
    if(shared.length){ html+=groupedHtml(shared, sharedCardHtml); }
    else { html+='<div class="tk-empty">'+(q||phLetter?'אין תוצאות משותפות':('אין '+Wp+' משותפים עדיין'))+'</div>'; }
    html+='<div class="tk-sec" style="margin-top:14px">📱 ה'+Wp+' שלי (במכשיר זה)</div>';
    if(local.length){ html+=groupedHtml(local, localCardHtml); }
    else { html+='<div class="tk-empty">'+(q||phLetter?'אין תוצאות אישיות':('הוסף/י '+kindWord()+' חדש בכפתור למעלה'))+'</div>'; }
    box.innerHTML=html;
  }
  // ===== חוצצים אלפביתיים (א׳–ת׳, בלי אותיות סופיות) =====
  var HEB_LETTERS=['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];
  var LAT_LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var FINAL_MAP={'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
  var HEB_ORDER=HEB_LETTERS.concat(LAT_LETTERS).concat(['#']);
  function firstLetter(name){ var s=String(name||'').trim(); if(!s) return '#'; var ch=s.charAt(0); if(FINAL_MAP[ch]) ch=FINAL_MAP[ch]; if(HEB_LETTERS.indexOf(ch)>=0) return ch; if(/[A-Za-z]/.test(ch)) return ch.toUpperCase(); return '#'; }
  function renderAzStrip(present){
    var el=$('tkAz'); if(!el) return;
    function chip(L,label){ return '<button type="button" class="tk-azl'+(phLetter===L?' on':'')+(present[L]?' has':'')+'" data-l="'+L+'">'+(label||L)+'</button>'; }
    var heb='<button type="button" class="tk-azl'+(phLetter===''?' on':'')+'" data-l="">הכל</button>';
    HEB_LETTERS.forEach(function(L){ heb+=chip(L); });
    var lat=''; LAT_LETTERS.forEach(function(L){ lat+=chip(L); });
    if(present['#']) lat+=chip('#');
    el.innerHTML='<div class="tk-az-row">'+heb+'</div><div class="tk-az-row tk-az-lat">'+lat+'</div>';
  }
  function groupedHtml(arr, builder){
    var groups={}, order=[];
    arr.forEach(function(c){ var L=firstLetter(c.supplier); if(!groups[L]){ groups[L]=[]; order.push(L); } groups[L].push(c); });
    order.sort(function(a,b){ var ia=HEB_ORDER.indexOf(a), ib=HEB_ORDER.indexOf(b); if(ia<0)ia=99; if(ib<0)ib=99; return ia-ib; });
    return order.map(function(L){ return '<div class="tk-azdiv">'+L+'</div>'+groups[L].map(builder).join(''); }).join('');
  }
  function sharedCardHtml(c){
    var W=kindWord();
    var by=c.sharedBy?('<span class="tk-tag">משותף ע״י '+esc(c.sharedBy)+'</span>'):'<span class="tk-tag">משותף</span>';
    var delBtn=isPhOwner()?'<button class="tk-card-del" title="מחק (לכולם)">🗑️</button>':'';
    return '<div class="tk-card shared" data-id="'+esc(c.id)+'"><div class="tk-card-h"><span class="tk-card-name">'+esc(c.supplier||W)+'</span>'+by+'<button class="tk-card-edit" title="ערוך (לכולם)">✏️</button>'+delBtn+'</div>'+cardLines(c)+'</div>';
  }
  function localCardHtml(c){
    var W=kindWord();
    return '<div class="tk-card" data-id="'+c.id+'"><div class="tk-card-h"><span class="tk-card-name">'+esc(c.supplier||W)+'</span>'
      +'<button class="tk-card-share" title="שתף לכולם">📤</button>'
      +'<button class="tk-card-edit" title="ערוך">✏️</button><button class="tk-card-del" title="מחק">🗑️</button></div>'+cardLines(c)+'</div>';
  }
  function openPhForm(c, isShared){
    phEditId = (c && !isShared) ? c.id : null;
    phEditShared = (c && isShared) ? c.id : null;
    var W=kindWord();
    var t=$('tkPhTitle'); if(t) t.textContent = c ? ('עריכת '+(c.supplier||W)) : (W+' חדש');
    $('tkPhSupplier').placeholder='שם ה'+W;
    $('tkPhSupplier').value=c?(c.supplier||''):''; $('tkPhC1').value=c?(c.c1||''):''; $('tkPhC2').value=c?(c.c2||''):'';
    $('tkPhP1').value=c?(c.p1||''):''; $('tkPhP2').value=c?(c.p2||''):''; $('tkPhAddr').value=c?(c.addr||''):'';
    $('tkPhForm').classList.add('open'); $('tkPhSupplier').focus();
  }
  function closePhForm(){ $('tkPhForm').classList.remove('open'); phEditId=null; phEditShared=null; }
  $('tkPhX').addEventListener('click', closePhForm);
  $('tkPhNew').addEventListener('click', function(){ openPhForm(null); });
  $('tkPhKind').addEventListener('click', function(e){ var b=e.target.closest('.tk-kind'); if(!b) return; var k=b.getAttribute('data-k'); if(k===phKind) return; phKind=k; phLetter=''; closePhForm(); renderPhones(); });
  $('tkAz').addEventListener('click', function(e){ var b=e.target.closest('.tk-azl'); if(!b) return; var L=b.getAttribute('data-l'); phLetter=(L===phLetter?'':L); renderPhones(); });
  $('tkPhCancel').addEventListener('click', closePhForm);
  $('tkPhSearch').addEventListener('input', renderPhones);
  $('tkPhSave').addEventListener('click', function(){
    var rec={ supplier:$('tkPhSupplier').value.trim(), c1:$('tkPhC1').value.trim(), c2:$('tkPhC2').value.trim(), p1:$('tkPhP1').value.trim(), p2:$('tkPhP2').value.trim(), addr:$('tkPhAddr').value.trim() };
    if(!rec.supplier && !rec.p1 && !rec.c1){ alert('יש למלא לפחות שם '+kindWord()+' או טלפון.'); return; }
    if(phEditShared){ // עריכת איש קשר משותף → עדכון בשרת לכולם
      if(!apiCfg().url){ alert('אין חיבור למערכת — לא ניתן לעדכן.'); return; }
      var sid=phEditShared;
      var btn=$('tkPhSave'); btn.disabled=true; btn.textContent='שומר…';
      srvGet('contactUpdate', { id:sid, supplier:rec.supplier, c1:rec.c1, c2:rec.c2, p1:rec.p1, p2:rec.p2, addr:rec.addr, kind:phKind }).then(function(r){
        btn.disabled=false; btn.textContent='שמור';
        if(r && r.ok){ closePhForm(); loadShared(); alert('עודכן ✓ כל החברים יראו את השינוי.'); }
        else if(r && r.ok===false){ alert('⚠️ השרת לא מכיר את פעולת העדכון — צריך לפרוס מחדש את Code.gs (גרסה חדשה).'); }
        else { alert('⚠️ אין תשובה מהשרת. בדוק/י חיבור ונסה/י שוב.'); }
      });
      return;
    }
    if(phEditId){ for(var i=0;i<PHONES.length;i++){ if(PHONES[i].id===phEditId){ rec.id=phEditId; rec.kind=ckind(PHONES[i]); PHONES[i]=rec; break; } } }
    else { rec.id=uid(); rec.kind=phKind; PHONES.push(rec); }
    savePhones(); closePhForm(); renderPhones();
  });
  function shareContact(c){
    if(!apiCfg().url){ alert('אין חיבור למערכת — לא ניתן לשתף.'); return; }
    var W=kindWord();
    if(!confirm('לשתף את "'+(c.supplier||W)+'" עם כל החברים? כולם יקבלו את הטלפון.')) return;
    var kid='K'+Date.now()+Math.floor(Math.random()*100000);
    srvGet('contactAdd', { id:kid, supplier:c.supplier||'', c1:c.c1||'', c2:c.c2||'', p1:c.p1||'', p2:c.p2||'', addr:c.addr||'', sharedBy:myName(), kind:ckind(c) }).then(function(r){
      if(r && r.ok){
        PHONES=PHONES.filter(function(x){return x.id!==c.id;}); savePhones(); // מעבירים מהאישי למשותף רק אחרי הצלחה
        loadShared(); // מביאים מהשרת את המצב האמיתי
        alert('שותף בהצלחה ✓ כל החברים יקבלו את "'+(c.supplier||W)+'" כשייכנסו לספר הטלפונים.');
      } else if(r && r.ok===false){
        alert('⚠️ השרת לא מכיר את פעולת השיתוף — צריך לפרוס מחדש את קובץ Code.gs (גרסה חדשה).\nנשאר אצלך כ"אישי".');
      } else {
        alert('⚠️ אין תשובה מהשרת. ודא/י חיבור לאינטרנט ונסה/י שוב.\nנשאר אצלך כ"אישי".');
      }
    });
  }
  $('tkPhList').addEventListener('click', function(e){
    if(e.target.id==='tkPhReload'){ loadShared(); return; }
    var card=e.target.closest('.tk-card'); if(!card) return; var id=card.getAttribute('data-id');
    if(card.classList.contains('shared')){
      var sc=null; for(var j=0;j<SHAREDC.length;j++){ if(String(SHAREDC[j].id)===String(id)){ sc=SHAREDC[j]; break; } }
      if(!sc) return;
      if(e.target.classList.contains('tk-card-edit')){ openPhForm(sc, true); return; }
      if(e.target.classList.contains('tk-card-del')){
        if(!isPhOwner()){ return; }
        if(!phAdmin){ var pin=prompt('הקש/י קוד מנהל כדי למחוק מהספר המשותף:'); if(String(pin||'').trim()!==PH_PIN){ if(pin!==null) alert('קוד שגוי.'); return; } phAdmin=true; }
        if(!confirm('למחוק את "'+(sc.supplier||kindWord())+'" מהספר המשותף? המחיקה תחול על כל החברים.')) return;
        srvGet('contactDelete', { id:id }).then(function(r){
          if(r && r.ok){ loadShared(); }
          else if(r && r.ok===false){ alert('⚠️ השרת לא מכיר את פעולת המחיקה — צריך לפרוס מחדש את Code.gs (גרסה חדשה).'); }
          else { alert('⚠️ אין תשובה מהשרת. בדוק/י חיבור ונסה/י שוב.'); }
        });
      }
      return;
    }
    var c=null; for(var i=0;i<PHONES.length;i++){ if(PHONES[i].id===id){ c=PHONES[i]; break; } }
    if(!c) return; // ספק אישי
    if(e.target.classList.contains('tk-card-share')){ shareContact(c); }
    else if(e.target.classList.contains('tk-card-edit')){ openPhForm(c, false); }
    else if(e.target.classList.contains('tk-card-del')){ if(confirm('למחוק את "'+(c.supplier||kindWord())+'" מהמכשיר?')){ PHONES=PHONES.filter(function(x){return x.id!==id;}); savePhones(); renderPhones(); } }
  });

  /* ---------- ממיר מטבעות ---------- */
  var CUR=[['ILS','₪ שקל'],['USD','$ דולר אמריקאי'],['EUR','€ אירו'],['GBP','£ ליש״ט'],['JPY','¥ ין יפני'],['CNY','יואן סיני'],['CHF','פרנק שוויצרי'],['CAD','דולר קנדי'],['AUD','דולר אוסטרלי'],['AED','דירהם (איחוד האמירויות)'],['INR','רופי הודי'],['RUB','רובל רוסי'],['TRY','לירה טורקית'],['BRL','ריאל ברזילאי'],['ZAR','ראנד דרום-אפריקני']];
  var FALLBACK={USD:1,ILS:3.7,EUR:0.92,GBP:0.79,JPY:157,CNY:7.25,CHF:0.88,CAD:1.44,AUD:1.52,AED:3.67,INR:85,RUB:100,TRY:35,BRL:6.1,ZAR:18.8};
  var RATES=null, RATES_TS=0, curInit=false;
  function loadCachedRates(){ try{ var c=JSON.parse(localStorage.getItem('afcon_tools_rates')||'null'); if(c&&c.r){ RATES=c.r; RATES_TS=c.t||0; } }catch(e){} }
  function fetchRates(){ return fetch('https://open.er-api.com/v6/latest/USD').then(function(r){return r.json();}).then(function(j){ if(j&&j.rates){ RATES=j.rates; RATES_TS=Date.now(); try{ localStorage.setItem('afcon_tools_rates', JSON.stringify({r:RATES,t:RATES_TS})); }catch(e){} return true; } return false; }).catch(function(){ return false; }); }
  function fillSel(sel, def){ sel.innerHTML=CUR.map(function(c){ return '<option value="'+c[0]+'"'+(c[0]===def?' selected':'')+'>'+esc(c[1])+'</option>'; }).join(''); }
  function openCur(){
    if(!curInit){ curInit=true; fillSel($('tkCurFrom'),'USD'); fillSel($('tkCurTo'),'ILS'); loadCachedRates();
      ['tkCurAmt','tkCurFrom','tkCurTo'].forEach(function(id){ $(id).addEventListener('input', calcCur); $(id).addEventListener('change', calcCur); });
      $('tkCurSwap').addEventListener('click', function(){ var a=$('tkCurFrom').value; $('tkCurFrom').value=$('tkCurTo').value; $('tkCurTo').value=a; calcCur(); });
    }
    var stale=(!RATES)||((Date.now()-RATES_TS)>12*3600000);
    if(stale){ $('tkCurNote').textContent='מעדכן שערים…'; fetchRates().then(function(){ calcCur(); }); }
    calcCur();
  }
  function calcCur(){
    var rates=RATES||FALLBACK; var live=!!RATES;
    var f=$('tkCurFrom').value, t=$('tkCurTo').value; var amt=parseFloat($('tkCurAmt').value); if(isNaN(amt)) amt=0;
    var rf=rates[f]||FALLBACK[f]||1, rt=rates[t]||FALLBACK[t]||1;
    var val=amt/rf*rt;
    $('tkCurRes').textContent=val.toLocaleString('he-IL',{maximumFractionDigits:2})+' '+t;
    var one=(1/rf*rt);
    $('tkCurRate').textContent='1 '+f+' = '+one.toLocaleString('he-IL',{maximumFractionDigits:4})+' '+t;
    var when=RATES_TS?new Date(RATES_TS).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    $('tkCurNote').textContent = live ? ('שערים חיים · עודכן '+when) : 'שערים משוערים (ללא חיבור לאינטרנט)';
  }

  /* ---------- ממיר שטחים ---------- */
  var AREA=[['m2','מ״ר (מטר רבוע)',1],['dunam','דונם',1000],['km2','קמ״ר',1000000],['hectare','הקטר',10000],['acre','אקר',4046.8564224],['ft2','רגל רבועה',0.09290304],['yd2','יארד רבוע',0.83612736],['mi2','מייל רבוע',2589988.110336]];
  var areaInit=false;
  function fillArea(sel, def){ sel.innerHTML=AREA.map(function(a){ return '<option value="'+a[0]+'"'+(a[0]===def?' selected':'')+'>'+esc(a[1])+'</option>'; }).join(''); }
  function areaFactor(code){ for(var i=0;i<AREA.length;i++){ if(AREA[i][0]===code) return AREA[i][2]; } return 1; }
  function areaName(code){ for(var i=0;i<AREA.length;i++){ if(AREA[i][0]===code) return AREA[i][1]; } return code; }
  function openArea(){
    if(!areaInit){ areaInit=true; fillArea($('tkAreaFrom'),'dunam'); fillArea($('tkAreaTo'),'m2');
      ['tkAreaAmt','tkAreaFrom','tkAreaTo'].forEach(function(id){ $(id).addEventListener('input', calcArea); $(id).addEventListener('change', calcArea); });
      $('tkAreaSwap').addEventListener('click', function(){ var a=$('tkAreaFrom').value; $('tkAreaFrom').value=$('tkAreaTo').value; $('tkAreaTo').value=a; calcArea(); });
    }
    calcArea();
  }
  function calcArea(){
    var f=$('tkAreaFrom').value, t=$('tkAreaTo').value; var amt=parseFloat($('tkAreaAmt').value); if(isNaN(amt)) amt=0;
    var val=amt*areaFactor(f)/areaFactor(t);
    $('tkAreaRes').textContent=val.toLocaleString('he-IL',{maximumFractionDigits:4});
    $('tkAreaRate').textContent=amt.toLocaleString('he-IL')+' '+areaName(f)+' = '+val.toLocaleString('he-IL',{maximumFractionDigits:4})+' '+areaName(t);
  }
  /* ---------- 🎙️ רשמקול + תמלול ---------- */
  var recInited=false, recLang='he-IL', recOn=false, srecog=null, mrec=null, recChunks=[], recBlob=null, recBase='';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function recExt(t){ t=t||''; if(t.indexOf('mp4')>=0||t.indexOf('m4a')>=0) return 'm4a'; if(t.indexOf('ogg')>=0) return 'ogg'; if(t.indexOf('wav')>=0) return 'wav'; return 'webm'; }
  function recDl(name, blob){ try{ var u=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },1500); }catch(e){} }
  function recStatus(s){ var el=$('tkRecStatus'); if(el) el.textContent=s||''; }
  function recNote(s){ var el=$('tkRecNote'); if(el) el.textContent=s||''; }
  function initRec(){
    if(recInited) return; recInited=true;
    $('tkRec').querySelectorAll('.tk-rl-btn').forEach(function(b){ b.addEventListener('click', function(){
      $('tkRec').querySelectorAll('.tk-rl-btn').forEach(function(x){ x.classList.toggle('on', x===b); });
      recLang=b.getAttribute('data-lang'); if(recOn && srecog){ try{ srecog.stop(); }catch(e){} } // יופעל מחדש בשפה החדשה
    }); });
    $('tkRecBtn').addEventListener('click', function(){ if(recOn) recStop(); else recStart(); });
    $('tkRecCopy').addEventListener('click', function(){ var t=$('tkRecText').value||''; if(!t){ recNote('אין טקסט להעתקה'); return; } if(navigator.clipboard){ navigator.clipboard.writeText(t).then(function(){ recNote('הועתק ✓'); },function(){ recNote('ההעתקה נכשלה'); }); } else { $('tkRecText').select(); try{ document.execCommand('copy'); recNote('הועתק ✓'); }catch(e){} } });
    $('tkRecWa').addEventListener('click', function(){ var t=($('tkRecText').value||'').trim(); if(!t){ recNote('אין טקסט לשליחה'); return; } window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank'); });
    $('tkRecSaveTxt').addEventListener('click', function(){ var t=$('tkRecText').value||''; if(!t){ recNote('אין טקסט לשמירה'); return; } recDl('תמלול-'+Date.now()+'.txt', new Blob([t],{type:'text/plain;charset=utf-8'})); recNote('הקובץ נשמר ✓'); });
    $('tkRecClear').addEventListener('click', function(){ try{ recStop(); }catch(e){} recBase=''; recBlob=null; recChunks=[]; $('tkRecText').value=''; var au=$('tkRecAudio'); au.removeAttribute('src'); au.hidden=true; $('tkRecDlAudio').hidden=true; $('tkRecShareAudio').hidden=true; var up=$('tkRecUpload'); if(up) up.value=''; recStatus(''); recNote('המסך נוקה ✓'); });
    $('tkRecDlAudio').addEventListener('click', function(){ if(!recBlob){ recNote('אין הקלטה'); return; } recDl('הקלטה-'+Date.now()+'.'+recExt(recBlob.type), recBlob); });
    $('tkRecShareAudio').addEventListener('click', function(){ if(!recBlob){ recNote('אין הקלטה'); return; } var f=new File([recBlob],'הקלטה.'+recExt(recBlob.type),{type:recBlob.type||'audio/webm'}); if(navigator.canShare && navigator.canShare({files:[f]})){ navigator.share({files:[f],title:'הקלטה'}).catch(function(){}); } else { recDl(f.name, recBlob); recNote('שיתוף ישיר לא נתמך — ההקלטה הורדה'); } });
    $('tkRecUpload').addEventListener('change', function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return; recBlob=f; var au=$('tkRecAudio'); au.src=URL.createObjectURL(f); au.hidden=false; $('tkRecDlAudio').hidden=false; $('tkRecShareAudio').hidden=false; recNote('קובץ נטען — אפשר להאזין ולשתף. (תמלול אוטומטי לקובץ מוקלט אינו זמין — רק להקלטה חיה)'); });
    if(!SR) recNote('💡 תמלול חי נתמך ב‑Chrome/אנדרואיד. באייפון לרוב אפשר להקליט ולשתף אודיו, אך לא לתמלל חי.');
  }
  function recStart(){
    recBase=$('tkRecText').value ? ($('tkRecText').value.replace(/\s+$/,'')+' ') : '';
    recChunks=[]; recBlob=null; recOn=true;
    $('tkRecBtn').textContent='⏹️ עצור הקלטה'; $('tkRecBtn').classList.add('rec'); recNote(''); recStatus('מבקש גישה למיקרופון…');
    // הקלטת אודיו (לקובץ)
    if(navigator.mediaDevices && window.MediaRecorder){
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        recStream=stream;
        try{ mrec=new MediaRecorder(stream); }catch(e){ mrec=null; }
        if(mrec){ mrec.ondataavailable=function(ev){ if(ev.data&&ev.data.size) recChunks.push(ev.data); };
          mrec.onstop=function(){ if(recChunks.length){ recBlob=new Blob(recChunks,{type:(mrec.mimeType||'audio/webm')}); var au=$('tkRecAudio'); au.src=URL.createObjectURL(recBlob); au.hidden=false; $('tkRecDlAudio').hidden=false; $('tkRecShareAudio').hidden=false; } };
          try{ mrec.start(); }catch(e){} }
        recStatus(SR?'🎙️ מקליט ומתמלל…':'🎙️ מקליט… (תמלול חי לא נתמך בדפדפן זה)');
      }).catch(function(){ recStatus(SR?'🎙️ מתמלל… (ללא שמירת אודיו — אין גישה למיקרופון)':'אין גישה למיקרופון'); });
    } else { recStatus(SR?'🎙️ מתמלל…':'הקלטה אינה נתמכת בדפדפן זה'); }
    // תמלול חי
    if(SR){ startRecog(); }
  }
  var recStream=null;
  function startRecog(){
    try{ srecog=new SR(); }catch(e){ srecog=null; return; }
    srecog.lang=recLang; srecog.continuous=true; srecog.interimResults=true;
    srecog.onresult=function(ev){ var interim=''; for(var i=ev.resultIndex;i<ev.results.length;i++){ var r=ev.results[i]; if(r.isFinal){ recBase+=r[0].transcript.replace(/\s+$/,'')+' '; } else { interim+=r[0].transcript; } } $('tkRecText').value=recBase+interim; $('tkRecText').scrollTop=$('tkRecText').scrollHeight; };
    srecog.onerror=function(ev){ if(ev && ev.error==='not-allowed'){ recStatus('אין הרשאת מיקרופון לתמלול'); } };
    srecog.onend=function(){ if(recOn){ try{ srecog.lang=recLang; srecog.start(); }catch(e){} } };
    try{ srecog.start(); }catch(e){}
  }
  function recStop(){
    if(!recOn && !srecog && !mrec) return;
    recOn=false;
    if(srecog){ try{ srecog.onend=null; srecog.stop(); }catch(e){} srecog=null; }
    if(mrec && mrec.state!=='inactive'){ try{ mrec.stop(); }catch(e){} }
    if(recStream){ try{ recStream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} recStream=null; }
    var btn=$('tkRecBtn'); if(btn){ btn.textContent='🎙️ התחל הקלטה'; btn.classList.remove('rec'); }
    recStatus('');
  }

  /* ---------- ⏰ תזכורות ומשימות ---------- */
  var TODO_K='afcon_tools_todo';
  function todoLoad(){ try{ return JSON.parse(localStorage.getItem(TODO_K)||'[]')||[]; }catch(e){ return []; } }
  function todoSave(){ try{ localStorage.setItem(TODO_K, JSON.stringify(TODOS)); }catch(e){} }
  var TODOS=todoLoad();
  function todoRender(){
    var box=$('tkTodoList'); if(!box) return;
    if(!TODOS.length){ box.innerHTML='<div class="tk-note">אין משימות עדיין.</div>'; return; }
    TODOS.sort(function(a,b){ return (a.time||'~').localeCompare(b.time||'~'); });
    box.innerHTML=TODOS.map(function(t){
      return '<div style="display:flex;align-items:center;gap:9px;background:#15171c;border:1px solid '+(t.done?'#242830':'#343a45')+';border-radius:10px;padding:10px 12px">'
        +'<input type="checkbox" data-tdid="'+t.id+'" '+(t.done?'checked':'')+' style="width:18px;height:18px;flex:0 0 auto">'
        +'<span style="flex:1;color:'+(t.done?'#697079':'#f2f4f8')+';'+(t.done?'text-decoration:line-through;':'')+'font-size:14.5px">'+esc(t.text)+'</span>'
        +(t.time?'<span style="color:#fbbf24;font-weight:700;font-size:13.5px;flex:0 0 auto">⏰ '+esc(t.time)+'</span>':'')
        +'<button data-tddel="'+t.id+'" type="button" style="background:none;border:none;color:#f87171;font-size:15px;cursor:pointer;flex:0 0 auto">🗑️</button></div>';
    }).join('');
  }
  function openTodo(){ todoRender(); }
  var todoPane=$('tkTodo');
  if(todoPane){
    function todoAdd(){ var txt=($('tkTodoText').value||'').trim(); if(!txt) return; TODOS.push({id:uid(), text:txt, time:($('tkTodoTime').value||''), done:false, fired:false}); todoSave(); $('tkTodoText').value=''; $('tkTodoTime').value=''; todoRender(); }
    var tAdd=$('tkTodoAdd'); if(tAdd) tAdd.addEventListener('click', todoAdd);
    var tTxt=$('tkTodoText'); if(tTxt) tTxt.addEventListener('keydown', function(e){ if(e.key==='Enter') todoAdd(); });
    todoPane.addEventListener('change', function(e){ var id=e.target.dataset&&e.target.dataset.tdid; if(id){ var t=TODOS.filter(function(x){return x.id===id;})[0]; if(t){ t.done=e.target.checked; todoSave(); todoRender(); } } });
    todoPane.addEventListener('click', function(e){ var id=e.target.dataset&&e.target.dataset.tddel; if(id){ TODOS=TODOS.filter(function(x){return x.id!==id;}); todoSave(); todoRender(); } });
    var tClr=$('tkTodoClear'); if(tClr) tClr.addEventListener('click', function(){ if(!TODOS.length){ return; } if(confirm('למחוק את כל המשימות והתזכורות?')){ TODOS=[]; todoSave(); todoRender(); } });
  }

  /* ---------- 🔢 פענוח מס׳ סידוריים (קריאת אזור מסומן) ---------- */
  var dcImgURL=null, dcChosen=[], dcSel=null, dcDrag=null, dcWorker=null;
  function dcLoadScript(src){ return new Promise(function(res,rej){ if(document.querySelector('script[data-dc="'+src+'"]')){ res(); return; } var sc=document.createElement('script'); sc.src=src; sc.setAttribute('data-dc',src); sc.onload=function(){ res(); }; sc.onerror=function(){ rej(); }; document.head.appendChild(sc); }); }
  function dcGetWorker(){
    if(dcWorker) return Promise.resolve(dcWorker);
    return dcLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js').then(function(){
      if(typeof Tesseract==='undefined') throw new Error('no-tess');
      return Tesseract.createWorker('eng');
    }).then(function(w){ return w.setParameters({ tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/', tessedit_pageseg_mode:'6' }).then(function(){ dcWorker=w; return w; }); });
  }
  function dcEnhance(cnv){
    try{
      var ctx=cnv.getContext('2d'); var id=ctx.getImageData(0,0,cnv.width,cnv.height); var d=id.data, n=d.length;
      var min=255,max=0;
      for(var i=0;i<n;i+=4){ var g=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)|0; d[i]=d[i+1]=d[i+2]=g; if(g<min)min=g; if(g>max)max=g; }
      var range=Math.max(1,max-min);
      for(var j=0;j<n;j+=4){ var v=(d[j]-min)*255/range; v=v<0?0:(v>255?255:v); d[j]=d[j+1]=d[j+2]=v; }
      ctx.putImageData(id,0,0);
    }catch(e){}
  }
  function dcBestNumber(text){
    var lines=(text||'').toUpperCase().split(/[\r\n]+/), best='';
    lines.forEach(function(ln){
      var s=ln.replace(/[^0-9A-Z\-\/ ]/g,'').replace(/\s+/g,''); // איחוד רווחים בתוך השורה (אזור = מספר אחד)
      var d=(s.match(/[0-9]/g)||[]).length, bd=(best.match(/[0-9]/g)||[]).length;
      if(/[0-9]/.test(s) && s.replace(/[^0-9A-Z]/g,'').length>=4 && d>bd) best=s;
    });
    return best;
  }
  function dcRenderChosen(){
    var box=$('tkDcChosen'); if(!box) return;
    if(!dcChosen.length){ box.innerHTML='<div class="tk-note" style="text-align:start">טרם נבחרו מספרים.</div>'; return; }
    box.innerHTML='<div class="tk-note" style="text-align:start;font-weight:700;color:#cdd2da">נבחרו ('+dcChosen.length+'):</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px;margin-top:5px">'+dcChosen.map(function(c,i){
        return '<div style="display:flex;justify-content:space-between;align-items:center;background:#0f1f14;border:1px solid #22c55e;border-radius:9px;padding:8px 11px"><span style="color:#eafff1;font-weight:700;font-size:14.5px">'+(i+1)+'. '+esc(c)+'</span><button data-dcx="'+esc(c)+'" type="button" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:15px">✕</button></div>';
      }).join('')+'</div>';
  }
  function openDecode(){ dcRenderChosen(); }

  var dcFile=$('tkDcFile');
  if(dcFile) dcFile.addEventListener('change', function(e){
    var f=e.target.files&&e.target.files[0]; if(!f) return;
    if(dcImgURL){ try{ URL.revokeObjectURL(dcImgURL); }catch(_){} }
    dcImgURL=URL.createObjectURL(f);
    var im=$('tkDcImg'); if(im) im.src=dcImgURL;
    var w=$('tkDcImgWrap'); if(w) w.style.display='block';
    var b=$('tkDcBtns'); if(b) b.style.display='flex';
    dcSel=null; var sb=$('tkDcSel'); if(sb) sb.style.display='none';
    var pr=$('tkDcProg'); if(pr){ pr.style.display='block'; pr.textContent='גרור ריבוע סביב המספר המוקף, ואז "קרא אזור".'; pr.style.color='#98a0ac'; }
  });

  function dcPt(e){ var r=$('tkDcImg').getBoundingClientRect(); var p=(e.touches&&e.touches[0])||e; return {x:p.clientX-r.left, y:p.clientY-r.top}; }
  function dcStart(e){ if(!dcImgURL) return; e.preventDefault(); var p=dcPt(e); dcDrag={x:p.x,y:p.y}; dcSel=null; }
  function dcMove(e){ if(!dcDrag) return; e.preventDefault(); var p=dcPt(e); var x=Math.min(dcDrag.x,p.x),y=Math.min(dcDrag.y,p.y),w=Math.abs(p.x-dcDrag.x),h=Math.abs(p.y-dcDrag.y); dcSel={x:x,y:y,w:w,h:h}; var b=$('tkDcSel'); if(b){ b.style.display='block'; b.style.left=x+'px'; b.style.top=y+'px'; b.style.width=w+'px'; b.style.height=h+'px'; } }
  function dcEnd(){ dcDrag=null; }
  var dcWrap=$('tkDcImgWrap');
  if(dcWrap){
    dcWrap.addEventListener('mousedown',dcStart); dcWrap.addEventListener('mousemove',dcMove); window.addEventListener('mouseup',dcEnd);
    dcWrap.addEventListener('touchstart',dcStart,{passive:false}); dcWrap.addEventListener('touchmove',dcMove,{passive:false}); dcWrap.addEventListener('touchend',dcEnd);
  }

  var dcReadBtn=$('tkDcRead');
  if(dcReadBtn) dcReadBtn.addEventListener('click', function(){
    var img=$('tkDcImg'); var prog=$('tkDcProg');
    if(!dcImgURL||!img){ return; }
    if(!dcSel||dcSel.w<8||dcSel.h<8){ if(prog){ prog.style.display='block'; prog.style.color='#fbbf24'; prog.textContent='גרור קודם ריבוע סביב המספר המוקף.'; } return; }
    var rect=img.getBoundingClientRect();
    var scaleX=img.naturalWidth/rect.width, scaleY=img.naturalHeight/rect.height;
    var sx=Math.max(0,dcSel.x*scaleX), sy=Math.max(0,dcSel.y*scaleY), sw=dcSel.w*scaleX, sh=dcSel.h*scaleY;
    var up=Math.min(5, Math.max(2, 1000/Math.max(sw,1)));
    var cnv=document.createElement('canvas'); cnv.width=Math.round(sw*up); cnv.height=Math.round(sh*up);
    var ctx=cnv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,cnv.width,cnv.height);
    try{ ctx.drawImage(img, sx,sy,sw,sh, 0,0,cnv.width,cnv.height); }catch(err){ if(prog){ prog.style.color='#f87171'; prog.textContent='שגיאת חיתוך — נסה שוב.'; } return; }
    dcEnhance(cnv);
    if(prog){ prog.style.display='block'; prog.style.color='#fbbf24'; prog.textContent='טוען מנוע קריאה…'; }
    dcReadBtn.disabled=true;
    dcGetWorker().then(function(w){ if(prog) prog.textContent='קורא…'; return w.recognize(cnv); }).then(function(r){
      dcReadBtn.disabled=false;
      var num=dcBestNumber((r&&r.data&&r.data.text)||'');
      if(num){ var inp=$('tkDcManual'); if(inp) inp.value=num; if(prog){ prog.style.color='#34d399'; prog.textContent='נקרא: '+num+' — בדוק ולחץ ➕'; } }
      else { if(prog){ prog.style.color='#fbbf24'; prog.textContent='⚠️ לא זוהה מספר באזור — סמן מדויק יותר או הקלד ידנית.'; } }
    }).catch(function(){ dcReadBtn.disabled=false; if(prog){ prog.style.color='#f87171'; prog.textContent='⚠️ הקריאה נכשלה — אפשר להקליד ידנית.'; } });
  });

  var dcZoomBtn=$('tkDcZoomBtn');
  if(dcZoomBtn) dcZoomBtn.addEventListener('click', function(){ if(!dcImgURL) return; var z=$('tkDcZoomImg'); if(z) z.src=dcImgURL; var ov=$('tkDcZoom'); if(ov) ov.style.display='flex'; });
  var dcZx=$('tkDcZoomX'); if(dcZx) dcZx.addEventListener('click', function(){ var ov=$('tkDcZoom'); if(ov) ov.style.display='none'; });

  function dcAddManual(){ var inp=$('tkDcManual'); if(!inp) return; var v=(inp.value||'').trim().toUpperCase(); if(!v) return; if(dcChosen.indexOf(v)<0){ dcChosen.push(v); dcRenderChosen(); } inp.value=''; var pr=$('tkDcProg'); if(pr) pr.textContent=''; }
  var dcAddBtn=$('tkDcAdd'); if(dcAddBtn) dcAddBtn.addEventListener('click', dcAddManual);
  var dcMan=$('tkDcManual'); if(dcMan) dcMan.addEventListener('keydown', function(e){ if(e.key==='Enter') dcAddManual(); });
  var dcChosenBox=$('tkDcChosen');
  if(dcChosenBox) dcChosenBox.addEventListener('click', function(e){ var x=e.target.getAttribute&&e.target.getAttribute('data-dcx'); if(x){ var i=dcChosen.indexOf(x); if(i>=0){ dcChosen.splice(i,1); dcRenderChosen(); } } });

  var dcExpBtn=$('tkDcExport');
  if(dcExpBtn) dcExpBtn.addEventListener('click', function(){
    if(!dcChosen.length){ alert('לא נבחרו מספרים לייצוא.'); return; }
    try{
      if(typeof XLSX!=='undefined'){
        var aoa=[['#','מספר סידורי']]; dcChosen.forEach(function(c,i){ aoa.push([i+1, c]); });
        var ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[{wch:6},{wch:24}];
        for(var i=2;i<=dcChosen.length+1;i++){ var cell=ws['B'+i]; if(cell){ cell.t='s'; cell.z='@'; } }
        var wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'מספרים סידוריים');
        XLSX.writeFile(wb, 'serials.xlsx'); return;
      }
    }catch(e){}
    var csv='\uFEFF#,מספר סידורי\n'+dcChosen.map(function(c,i){ return (i+1)+',"'+c+'"'; }).join('\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); var u=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=u; a.download='serials.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },1500);
  });
  var dcClrBtn=$('tkDcClear');
  if(dcClrBtn) dcClrBtn.addEventListener('click', function(){ if(dcChosen.length && !confirm('לנקות את המספרים שנבחרו?')) return; dcChosen=[]; dcRenderChosen(); var pr=$('tkDcProg'); if(pr) pr.textContent=''; });
  function dcReset(){
    if(dcImgURL){ try{ URL.revokeObjectURL(dcImgURL); }catch(_){} dcImgURL=null; }
    dcChosen=[]; dcSel=null; dcDrag=null;
    var im=$('tkDcImg'); if(im){ im.removeAttribute('src'); }
    var w=$('tkDcImgWrap'); if(w) w.style.display='none';
    var b=$('tkDcBtns'); if(b) b.style.display='none';
    var sb=$('tkDcSel'); if(sb) sb.style.display='none';
    var man=$('tkDcManual'); if(man) man.value='';
    var pr=$('tkDcProg'); if(pr){ pr.textContent=''; pr.style.display='none'; }
    var fi=$('tkDcFile'); if(fi) fi.value='';
    var ov=$('tkDcZoom'); if(ov) ov.style.display='none';
    dcRenderChosen();
  }
  var dcResetBtn=$('tkDcReset');
  if(dcResetBtn) dcResetBtn.addEventListener('click', function(){ if((dcImgURL||dcChosen.length) && !confirm('לאפס ולהתחיל מסמך חדש? כל מה שלא יוצא לאקסל יימחק.')) return; dcReset(); });

})();
