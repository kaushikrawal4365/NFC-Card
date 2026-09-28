const SPREADSHEET_ID = '1RMKMj8GZW3SuLFFxm2o2jFWJoQT-MXyJIMKP8nyZskA';
const SHEET_NAME = 'Sheet1';
const CLIENTS_SHEET_NAME = 'Clients';
const EVENTS_SHEET_NAME = 'ReviewEvents';

/** JSONP API used by the static AlwaysTap studio and public review pages. */
function doGet(event) {
  const callback = String(event.parameter.callback || '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    const params = event.parameter;
    let result;
    if (params.action === 'clients') result = { ok: true, clients: listClients_() };
    else if (params.action === 'client') result = { ok: true, client: getClientBySlug_(params.slug) };
    else throw new Error('Unknown action.');
    return jsonp_(callback, result);
  } catch (error) {
    return jsonp_(callback, { ok: false, error: error.message || 'Request failed.' });
  }
}

function jsonp_(callback, result) {
  const json = JSON.stringify(result).replace(/</g, '\\u003c');
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function clientSheet_() {
  return ensureSheet_(CLIENTS_SHEET_NAME,
    ['id', 'slug', 'name', 'googleUrl', 'logo', 'accent', 'tagline', 'suggestions', 'createdAt', 'updatedAt']);
}

function eventSheet_() {
  return ensureSheet_(EVENTS_SHEET_NAME,
    ['id', 'slug', 'type', 'rating', 'suggestions', 'createdAt']);
}

function ensureSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function clientFromRow_(row) {
  return {
    id: String(row[0] || ''), slug: String(row[1] || ''), name: String(row[2] || ''),
    googleUrl: String(row[3] || ''), logo: String(row[4] || ''), accent: String(row[5] || '#1f5b45'),
    tagline: String(row[6] || ''), suggestions: parseJson_(row[7], {}),
    createdAt: row[8] instanceof Date ? row[8].getTime() : Number(row[8] || Date.now()), events: []
  };
}

function parseJson_(value, fallback) {
  try { return JSON.parse(String(value || '')); } catch (error) { return fallback; }
}

function listClients_() {
  const clientsSheet = clientSheet_();
  const clientRows = clientsSheet.getLastRow() > 1
    ? clientsSheet.getRange(2, 1, clientsSheet.getLastRow() - 1, 10).getValues() : [];
  const clients = clientRows.map(clientFromRow_);
  if (!clients.length) return clients;

  const eventsSheet = eventSheet_();
  const eventRows = eventsSheet.getLastRow() > 1
    ? eventsSheet.getRange(2, 1, eventsSheet.getLastRow() - 1, 6).getValues() : [];
  const bySlug = {};
  eventRows.forEach(row => {
    const slug = String(row[1] || '');
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push({
      type: String(row[2] || ''), rating: Number(row[3] || 0),
      suggestions: parseJson_(row[4], []), at: row[5] instanceof Date ? row[5].getTime() : Number(row[5] || 0)
    });
  });
  clients.forEach(client => client.events = bySlug[client.slug] || []);
  return clients;
}

function getClientBySlug_(slug) {
  const cleanSlug = String(slug || '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) return null;
  const sheet = clientSheet_();
  if (sheet.getLastRow() < 2) return null;
  const match = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(cleanSlug).matchEntireCell(true).findNext();
  if (!match) return null;
  const row = sheet.getRange(match.getRow(), 1, 1, 10).getValues()[0];
  return clientFromRow_(row);
}

function cleanCell_(value, maxLength) {
  let text = String(value || '').trim().slice(0, maxLength);
  if (/^[=+@\-]/.test(text)) text = "'" + text;
  return text;
}

function slugBase_(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46).replace(/-$/g, '') || 'business';
}

function saveClient_(input) {
  const name = cleanCell_(input.name, 70);
  const googleUrl = String(input.googleUrl || '').trim();
  if (!name || !/^https?:\/\//i.test(googleUrl)) throw new Error('Business name and a valid Google review URL are required.');
  const logo = String(input.logo || '').trim();
  if (logo && !/^https?:\/\//i.test(logo) && !/^data:image\/jpeg;base64,/i.test(logo)) {
    throw new Error('Logo must be an HTTPS image URL or a compressed JPEG image.');
  }
  if (logo.length > 9000) throw new Error('Logo is too large. Please use a smaller image.');
  const suggestions = {};
  for (let rating = 1; rating <= 5; rating++) {
    const list = Array.isArray(input.suggestions && input.suggestions[rating]) ? input.suggestions[rating] : [];
    suggestions[rating] = list.slice(0, 12).map(value => cleanCell_(value, 70)).filter(Boolean);
  }
  const accent = /^#[0-9a-f]{6}$/i.test(String(input.accent || '')) ? String(input.accent) : '#1f5b45';
  const tagline = cleanCell_(input.tagline, 100);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = clientSheet_();
    const id = String(input.id || '');
    let rowNumber = 0;
    let slug = '';
    let createdAt = new Date();
    if (id && sheet.getLastRow() > 1) {
      const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .createTextFinder(id).matchEntireCell(true).findNext();
      if (found) {
        rowNumber = found.getRow();
        const old = sheet.getRange(rowNumber, 1, 1, 10).getValues()[0];
        slug = String(old[1] || '');
        createdAt = old[8] instanceof Date ? old[8] : new Date(old[8] || Date.now());
      }
    }
    if (!rowNumber) {
      const base = slugBase_(name);
      const existing = sheet.getLastRow() > 1
        ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat().map(String) : [];
      let suffix = 1;
      do { slug = base + '-' + String(suffix++).padStart(2, '0'); } while (existing.includes(slug));
    }
    const clientId = rowNumber ? id : (id || Utilities.getUuid());
    const now = new Date();
    const row = [clientId, slug, name, googleUrl, logo, accent, tagline, JSON.stringify(suggestions), createdAt, now];
    if (rowNumber) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return { id: clientId, slug, name, googleUrl, logo, accent, tagline, suggestions, createdAt: createdAt.getTime(), updatedAt: now.getTime(), events: [] };
  } finally {
    lock.releaseLock();
  }
}

function saveReviewEvent_(input) {
  const slug = String(input.slug || '').trim();
  const type = String(input.type || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid client link.');
  if (!['nfc', 'qr', 'rating', 'google'].includes(type)) throw new Error('Invalid analytics event.');
  if (!getClientBySlug_(slug)) throw new Error('Client link not found.');
  const rating = type === 'rating' ? Number(input.rating) : 0;
  if (type === 'rating' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error('Rating must be between 1 and 5.');
  const suggestions = type === 'rating' && Array.isArray(input.suggestions)
    ? input.suggestions.slice(0, 12).map(value => cleanCell_(value, 70)) : [];
  const sheet = eventSheet_();
  const row = [Utilities.getUuid(), slug, type, rating, JSON.stringify(suggestions), new Date()];
  sheet.appendRow(row);
  return { slug, type, rating, suggestions, at: Date.now() };
}

function doPost(event) {
  try {
    if (event.parameter.action === 'saveClient') {
      const client = saveClient_(JSON.parse(event.parameter.client || '{}'));
      return response({ ok: true, client: client });
    }
    if (event.parameter.action === 'track') {
      const savedEvent = saveReviewEvent_(JSON.parse(event.parameter.event || '{}'));
      return response({ ok: true, event: savedEvent });
    }
    const payload = JSON.parse(event.postData.contents || '{}');
    const name = String(payload.name || '').trim();
    const phone = String(payload.phone || '').trim();
    const packageName = String(payload.packageName || '').trim();
    const amount = String(payload.amount || '').trim();

    if (!name || !phone) {
      return response({ ok: false, error: 'Name and phone are required.' });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Package', 'Amount']);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const normalizedHeaders = headers.map((header) => String(header).trim().toLowerCase());
    const row = headers.map(() => '');
    const values = {
      timestamp: new Date(),
      name,
      phone,
      package: packageName,
      amount
    };

    normalizedHeaders.forEach((header, index) => {
      if (header === 'timestamp' || header === 'date') row[index] = values.timestamp;
      if (header === 'name' || header === 'customer name') row[index] = values.name;
      if (header === 'phone' || header === 'phone number') row[index] = values.phone;
      if (header === 'package' || header === 'package name') row[index] = values.package;
      if (header === 'amount' || header === 'price') row[index] = values.amount;
    });

    sheet.appendRow(row);
    return response({ ok: true });
  } catch (error) {
    return response({ ok: false, error: error.message });
  }
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
