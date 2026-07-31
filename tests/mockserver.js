/* שרת מדומה שמחקה את חוזה ה-Google Apps Script של המערכת.
   מאפשר להריץ את קוד הלקוח האמיתי מול "שרת" נשלט:
   נפילות רשת, מכסה שנגמרה, טוקן שגוי, תשובות שאבדו. */

const TOKEN = 'afcon2026';

function mkServer() {
  const S = {
    alerts: [],
    seq: 0,
    contacts: [], news: [], catalog: {}, buyers: ['דנה', 'יוסי'], reporters: ['אבי', 'מוטי'],
    photos: {},
    // בקרת תקלות
    mode: 'ok',          // ok | offline | quota | badtoken | lostresponse
    calls: [],           // יומן כל הקריאות
    latency: 0,
  };

  function ticket() { S.seq++; return '26-' + String(S.seq).padStart(4, '0'); }

  S.handle = function (action, p) {
    S.calls.push({ action, id: p.id, sku: p.sku });

    if (S.mode === 'offline') { const e = new Error('script error'); e.network = true; throw e; }
    if (S.mode === 'quota') { const e = new Error('script error'); e.network = true; throw e; }
    if (S.mode === 'badtoken') return { ok: false, error: 'bad token' };
    if (String(p.token || '') !== TOKEN) return { ok: false, error: 'bad token' };

    switch (action) {
      case 'ping': return { ok: true };
      case 'all': return { ok: true, alerts: JSON.parse(JSON.stringify(S.alerts)) };
      case 'create': {
        const id = String(p.id || '');
        // השרת מזהה מזהה חוזר ולא יוצר כפילות (הנחת עבודה שיש לאמת מול Code.gs)
        const existing = S.alerts.find(a => String(a.id) === id);
        if (existing) return { ok: true, ticket: existing.ticket, already: true };
        const dup = S.alerts.find(a =>
          String(a.sku).replace(/^0+/, '') === String(p.sku).replace(/^0+/, '') &&
          String(a.status) !== 'טופל');
        if (dup) return { ok: true, duplicate: true, alert: JSON.parse(JSON.stringify(dup)) };
        const a = {
          id: id, ticket: ticket(), type: p.type || 'חוסר מלאי', sku: p.sku || '', desc: p.desc || '',
          qty: p.qty || '', po: p.po || '', qtyRecv: p.qtyRecv || '', descRecv: p.descRecv || '',
          note: p.note || '', urgency: p.urgency || '', reporter: p.reporter || '',
          status: 'ממתין', assignee: '', response: '', chat: '',
          created: new Date().toISOString(), updated: new Date().toISOString()
        };
        S.alerts.push(a);
        return { ok: true, ticket: a.ticket };
      }
      case 'assign': {
        const a = S.alerts.find(x => String(x.id) === String(p.id));
        if (!a) return { ok: false, error: 'not found' };
        a.assignee = p.assignee || ''; if (p.status) a.status = p.status;
        a.updated = new Date().toISOString();
        return { ok: true };
      }
      case 'status': {
        const a = S.alerts.find(x => String(x.id) === String(p.id));
        if (!a) return { ok: false, error: 'not found' };
        a.status = p.status; a.updated = new Date().toISOString();
        return { ok: true };
      }
      case 'ack': {
        const a = S.alerts.find(x => String(x.id) === String(p.id));
        if (!a) return { ok: false, error: 'not found' };
        a.response = p.response || ''; a.ackBy = p.ackBy || '';
        if (p.status) a.status = p.status;
        a.ackAt = new Date().toISOString(); a.updated = a.ackAt;
        return { ok: true };
      }
      case 'msgAdd': {
        const a = S.alerts.find(x => String(x.id) === String(p.id));
        if (!a) return { ok: false, error: 'not found' };
        const entry = [p.author || '', new Date().toISOString(), p.text || '', p.photo || ''].join('\u0001');
        a.chat = a.chat ? (a.chat + '\u0002' + entry) : entry;
        a.updated = new Date().toISOString();
        return { ok: true };
      }
      case 'delete': {
        const n = S.alerts.length;
        S.alerts = S.alerts.filter(x => String(x.id) !== String(p.id));
        return { ok: S.alerts.length < n };
      }
      case 'clearAll': { const n = S.alerts.length; S.alerts = []; S.seq = 0; return { ok: true, cleared: n }; }
      case 'importAll': {
        const d = p.data || {};
        if (Array.isArray(d.alerts)) S.alerts = JSON.parse(JSON.stringify(d.alerts));
        if (Array.isArray(d.contacts)) S.contacts = d.contacts;
        if (Array.isArray(d.news)) S.news = d.news;
        if (d.catalog) S.catalog = d.catalog;
        if (Array.isArray(d.buyers)) S.buyers = d.buyers;
        return { ok: true, restored: ['פניות', 'אנשי קשר', 'ידיעון'] };
      }
      case 'roster': return { ok: true, buyers: S.buyers, reporters: S.reporters };
      case 'rosterSet': return { ok: true };
      case 'contacts': return { ok: true, contacts: S.contacts };
      case 'news': return { ok: true, news: S.news };
      case 'catalog': return { ok: true, items: S.catalog };
      case 'catalogSet': return { ok: true };
      case 'photos': return { ok: true, photos: S.photos[p.id] || [] };
      case 'photosAll': return { ok: true, photos: [] };
      case 'addPhotos': { S.photos[p.id] = p.photos || []; return { ok: true }; }
      case 'backupsList': return { ok: true, backups: [{ id: 'b1', name: 'גיבוי 2026-07-30' }] };
      case 'backup': return { ok: true, name: 'גיבוי חדש' };
      case 'version': return { ok: true, version: '' };
      case 'presence': case 'presenceList': return { ok: true, users: [] };
      case 'tpl': return { ok: true, tpls: [] };
      case 'check': {
        const dup = S.alerts.find(a => String(a.sku) === String(p.sku) && String(a.status) !== 'טופל');
        return { ok: true, duplicate: !!dup, alert: dup || null };
      }
      default: return { ok: true };
    }
  };
  return S;
}

module.exports = { mkServer, TOKEN };
