/* מריץ את קבצי האפליקציה האמיתיים ב-DOM, ומחבר אותם לשרת המדומה.
   מיירט את מנגנון ה-JSONP (תגית script) ואת ה-fetch, כך שקוד הלקוח
   רץ בדיוק כפי שהוא בייצור — בלי לשנות בו שורה. */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { mkServer } = require('./mockserver');

const APP = '/mnt/user-data/outputs/minus-mlay-main';

async function boot(file, opts) {
  opts = opts || {};
  const S = opts.server || mkServer();
  const errors = [];
  const logs = [];

  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  let html = fs.readFileSync(path.join(APP, file), 'utf8');
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');
  // זריעת localStorage לפני שכל סקריפט רץ — אחרת הזהות נקבעת אחרי האתחול
  if (opts.storage) {
    const seed = '<script>try{var _s=' + JSON.stringify(opts.storage) +
      ';for(var k in _s)localStorage.setItem(k,_s[k]);}catch(e){}<\/script>';
    html = html.replace('<head>', '<head>' + seed);
  }
  // מטמיעים את הקבצים החיצוניים בדיוק במקומם, כדי לשמר את סדר הטעינה
  // האמיתי של הדפדפן (config.js חייב לרוץ לפני הקוד המוטבע).
  html = html.replace(/<script src="([^"]+)"><\/script>/g, function (m, src) {
    const clean = src.split('?')[0];
    const fp = path.join(APP, clean);
    if (!fs.existsSync(fp)) return m;
    if (/config\.js$/.test(clean) && opts.noConfig) return '';   // מדמה כשל בטעינת config.js
    if (/catalog\.js$/.test(clean) && !opts.realCatalog) {
      return '<script>window.DEFAULT_CATALOG={"1000123":"beam bolt","1234567":"steel nut"};<\/script>';
    }
    return '<script>' + fs.readFileSync(fp, 'utf8') + '<\/script>';
  });

  function installHooks(w) {
    w.closed = false;
    Object.defineProperty(w.navigator, 'onLine', { get: () => (S.mode !== 'offline'), configurable: true });

    // ---- יירוט JSONP: כל תגית script שמצביעה ל-Apps Script ----
    const origAppend = w.HTMLHeadElement.prototype.appendChild;
    w.HTMLHeadElement.prototype.appendChild = function (node) {
      if (node && node.tagName === 'SCRIPT' && node.src && node.src.indexOf('script.google.com') >= 0) {
        const u = new w.URL(node.src);
        const p = {}; u.searchParams.forEach((v, k) => { p[k] = v; });
        const cb = p.callback;
        S.lastUrlLength = node.src.length;
        S.urlLengths = S.urlLengths || []; S.urlLengths.push({ action: p.action, len: node.src.length });
        setTimeout(() => {
          if (w.closed || !w.document) return;
          try {
            const res = S.handle(p.action, p);
            if (S.mode === 'lostresponse') { if (node.onerror) node.onerror(new w.Event('error')); return; }
            if (typeof w[cb] === 'function') w[cb](res);
            else if (node.onerror) node.onerror(new w.Event('error'));
          } catch (e) { if (node.onerror) node.onerror(new w.Event('error')); }
        }, S.latency || 0);
        return node;
      }
      return origAppend.call(this, node);
    };

    // ---- יירוט fetch (POST) ----
    w.fetch = async function (url, init) {
      const su = String(url);
      if (su.indexOf('script.google.com') >= 0) {
        if (S.mode === 'offline' || S.mode === 'quota') throw new Error('fetch failed');
        let body = {};
        try { body = JSON.parse((init && init.body) || '{}'); } catch (e) { }
        const res = S.handle(body.action, body);
        return { ok: true, text: async () => JSON.stringify(res) };
      }
      throw new Error('blocked: ' + su);
    };
  }

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: false,
    url: 'https://example.org/app/' + file,
    virtualConsole: vc,
    resources: undefined,
    beforeParse: installHooks,
  });

  const w = dom.window;
  w.__ERRORS = errors;
  w.addEventListener('error', e => errors.push('window.onerror: ' + (e.message || e.error)));
  w.onerror = (m) => { errors.push('onerror: ' + m); };

  // localStorage אמיתי כבר קיים ב-jsdom

  await new Promise(r => setTimeout(r, 60));
  return { dom, w, S, errors, logs, doc: w.document };
}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

module.exports = { boot, tick, mkServer };
