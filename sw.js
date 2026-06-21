/* פורטל שרשרת האספקה — Service Worker מינימלי
   תפקיד: הצגת התראות במכשיר מותקן + פתיחת האפליקציה בלחיצה על ההתראה.
   אין כאן מטמון (cache) — כדי שלא יציג גרסה ישנה של האפליקציה. */

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

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
