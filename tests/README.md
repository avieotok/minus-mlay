# ערכת הבדיקות

הרצה של קוד האפליקציה האמיתי מול שרת Apps Script מדומה, בסביבת DOM (jsdom).
הקבצים ב-`index.html` ו-`dashboard.html` נטענים כמו בדפדפן — כולל סדר טעינת
`config.js`, מנגנון ה-JSONP, ה-Service Worker וה-localStorage.

## הרצה

```bash
npm install jsdom
node e2e.js     # מסלולים ראשיים — 44 בדיקות
node e2e2.js    # כלים הרסניים וקצוות — 24 בדיקות
node e2e3.js    # שומר אורך הכתובת — 8 בדיקות
node clocktest.js # שעון ותאריך עברי — 13 בדיקות
node hebtest.js   # מעבר התאריך העברי בשקיעה
node livetest.js  # עדכון חי בלוח — 14 בדיקות
```

## מה מדומה

`mockserver.js` מחקה את חוזה ה-Backend: `create`, `all`, `assign`, `ack`,
`status`, `msgAdd`, `delete`, `importAll`, `roster`, `backupsList` ועוד.
אפשר להעביר אותו למצבים: `ok` · `offline` · `badtoken` · `lostresponse`.

`lostresponse` הוא החשוב — הבקשה מגיעה לשרת אבל התשובה אובדת בדרך.
זה התרחיש שיוצר דיווחים כפולים אם הניסיון החוזר לא מוגן.

## מה לא מכוסה

הבדיקות רצות מול שרת מדומה, לא מול Google Apps Script האמיתי.
ההנחות שיש לאמת מול `Code.gs`:

1. `create` עם מזהה שכבר קיים אינו יוצר רשומה כפולה.
2. `importAll` כותב את כל הטבלאות באופן אטומי.
3. מונה מספרי הקריאות נגזר מהגיליון ולא ממונה נפרד.
