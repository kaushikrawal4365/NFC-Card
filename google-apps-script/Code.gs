const SPREADSHEET_ID = '1RMKMj8GZW3SuLFFxm2o2jFWJoQT-MXyJIMKP8nyZskA';
const SHEET_NAME = 'Sheet1';

function doPost(event) {
  try {
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
