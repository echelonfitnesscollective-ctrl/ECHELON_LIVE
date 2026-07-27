// Scheduled backup: exports critical Supabase tables to a Google Sheet
// (one tab per table) and copies progress photo files to a Google Drive
// folder, recording each photo's Drive link back in its sheet row.
//
// Required environment variables (set as GitHub Actions secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   -- server-only key, never expose client-side
//   GOOGLE_SERVICE_ACCOUNT_KEY  -- full JSON key for a Google service account
//   GOOGLE_SHEET_ID             -- destination spreadsheet ID
//   GOOGLE_DRIVE_FOLDER_ID      -- destination Drive folder ID for photos
//
// See scripts/backup/README.md for one-time setup instructions.

const { google } = require('googleapis');
const { Readable } = require('stream');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const GOOGLE_KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

const TABLES = [
  'account_access',
  'admin_users',
  'member_profiles',
  'member_waivers',
  'member_progress_photos',
  'coaching_applications',
  'coach_messages',
  'member_workout_plans',
  'member_weekly_checkins',
  'session_checkins',
  'website_leads',
  'enrollment_offers',
  'stripe_payment_events',
];

function requireEnv() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_SHEET_ID', 'GOOGLE_DRIVE_FOLDER_ID']
    .filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function fetchTable(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

function googleAuth() {
  const credentials = JSON.parse(GOOGLE_KEY_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

async function ensureSheetTab(sheets, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (meta.data.sheets || []).some((sheet) => sheet.properties.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

function rowsToGrid(rows) {
  if (!rows.length) return [['(no rows at time of backup)']];
  const headers = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((key) => set.add(key)); return set; }, new Set()));
  const grid = [headers];
  for (const row of rows) {
    grid.push(headers.map((key) => {
      const value = row[key];
      if (value === null || value === undefined) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }));
  }
  return grid;
}

async function writeSheetTab(sheets, title, rows) {
  await ensureSheetTab(sheets, title);
  const grid = rowsToGrid(rows);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${title}!A:ZZ` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: grid },
  });
}

async function backupPhotoFiles(drive, photos) {
  const results = [];
  for (const photo of photos) {
    if (!photo.storage_path) { results.push({ ...photo, backup_status: 'no storage_path on record' }); continue; }
    try {
      const download = await fetch(`${SUPABASE_URL}/storage/v1/object/progress-photos/${photo.storage_path}`, {
        headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!download.ok) { results.push({ ...photo, backup_status: `download failed (${download.status})` }); continue; }
      const buffer = Buffer.from(await download.arrayBuffer());
      const fileName = String(photo.storage_path).replace(/\//g, '_');
      const upload = await drive.files.create({
        requestBody: { name: fileName, parents: [DRIVE_FOLDER_ID] },
        media: { mimeType: 'application/octet-stream', body: Readable.from(buffer) },
        fields: 'id, webViewLink',
      });
      results.push({ ...photo, backup_status: 'ok', drive_file_id: upload.data.id, drive_link: upload.data.webViewLink });
    } catch (error) {
      results.push({ ...photo, backup_status: `error: ${error.message}` });
    }
  }
  return results;
}

async function main() {
  requireEnv();
  const auth = googleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const summary = [];
  for (const table of TABLES) {
    try {
      let rows = await fetchTable(table);
      if (table === 'member_progress_photos' && rows.length) {
        rows = await backupPhotoFiles(drive, rows);
      }
      await writeSheetTab(sheets, table, rows);
      summary.push(`${table}: ${rows.length} row(s)`);
    } catch (error) {
      summary.push(`${table}: FAILED (${error.message})`);
    }
  }

  await ensureSheetTab(sheets, '_backup_log');
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: '_backup_log!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[new Date().toISOString(), summary.join(' | ')]] },
  });

  console.log(summary.join('\n'));
  if (summary.some((line) => line.includes('FAILED'))) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Backup run failed:', error.message);
  process.exit(1);
});
