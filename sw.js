/* פורטל שרשרת האספקה — Service Worker
   ───────────────────────────────────────────────────────────
   מה השתנה לעומת הגרסה הקודמת:
   • נוסף מטמון (cache) חכם — כדי לתת תמיכה ב-Offline ולמנוע הורדה
     חוזרת של catalog.js (~360KB) וספריות ה-CDN בכל פתיחה.
   • ה-HTML נשאר תמיד "רשת קודם" (network-first) — כך מנגנון בדיקת
     הגרסה הקיים ממשיך לעבוד וגרסה חדשה נטענת מיד כשיש קליטה.
   • נכסים סטטיים (קטלוג, אייקונים, פונטים, ספריות) מוגשים מהמטמון
     ומתעדכנים ברקע (stale-while-revalidate).
   • קריאות ל-Google Apps Script אף פעם לא נכנסות למטמון.

   ⚠️ בעת עדכון גרסה — שנו את המספר ב-CACHE_VERSION כדי לרענן את המטמון.
*/

const CACHE_VERSION = 'afcon-v10';
const CACHE_NAME = CACHE_VERSION;

/* נכסי הליבה של האפליקציה — נטענים מראש כדי שתעבוד גם בלי קליטה */
const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './catalog.js',
  './config.js',
  './tools.js',
  './icon.png',
  './icon-dash.png',
];

/* כתובות חיצוניות (CDN) שכדאי לשמור כדי שהאפליקציה תעבוד גם Offline */
const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];

/* כתובות שאסור לשמור במטמון — ה-Backend (Apps Script) ושאר דינמי */
function isApi(url) {
  return url.hostname.indexOf('script.google.com') !== -1 ||
         url.hostname.indexOf('script.googleusercontent.com') !== -1 ||
         url.hostname.indexOf('open.er-api.com') !== -1;
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        /* addAll נכשל אם נכס אחד נופל — לכן מוסיפים בנפרד וסלחניים */
        return Promise.all(CORE_ASSETS.map(function (u) {
          return cache.add(new Request(u, {cache:'reload'})).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;             // כתיבות — לא נוגעים
  let url;
  try { url = new URL(req.url); } catch (x) { return; }

  if (isApi(url)) return;                        // Backend — תמיד מהרשת, בלי מטמון

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  /* HTML — רשת קודם, נפילה למטמון (שומר על עדכון הגרסה + תמיכת Offline) */
  if (isNavigation) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy).catch(function () {}); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html') || caches.match('./');
          });
        })
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.indexOf(url.hostname) !== -1;

  /* נכסים סטטיים (קטלוג, אייקונים, פונטים, ספריות) — מטמון קודם + רענון ברקע */
  if (sameOrigin || isCdn) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        const fetchAndUpdate = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copy).catch(function () {}); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || fetchAndUpdate;
      })
    );
    return;
  }
  /* כל השאר — רשת רגילה */
});

/* ───────────── התראות (ללא שינוי בהתנהגות) ───────────── */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
      for (var i = 0; i < cl.length; i++) {
        if ('focus' in cl[i]) { try { return cl[i].focus(); } catch (x) {} }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

/* תשתית לעתיד (התראות גם כשהאפליקציה סגורה) — לא פעיל כרגע */
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  var title = d.title || 'פורטל שרשרת האספקה';
  var body = d.body || 'דיווח חדש';
  e.waitUntil(self.registration.showNotification(title, {
    body: body, tag: d.tag || 'afcon', renotify: true, icon: 'icon-dash.png', badge: 'icon-dash.png',
    data: { url: d.url || './' }
  }));
});

/* מאפשר לעמוד לבקש החלפת SW מיידית אחרי עדכון */
self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
