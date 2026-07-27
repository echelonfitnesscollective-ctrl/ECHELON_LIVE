# Scheduled backup: Supabase → Google Sheets + Drive

Runs daily via GitHub Actions (`.github/workflows/scheduled-backup.yml`).
Exports the tables listed in `run-backup.js` (`TABLES`) to one tab per
table in a Google Sheet, and copies each progress photo file to a Google
Drive folder, recording the Drive link back in the `member_progress_photos`
tab.

## One-time setup (you'll need to do this yourself — it requires your own
Google account and GitHub repo settings)

### 1. Create a Google Cloud service account
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or use an existing one).
2. Enable the **Google Sheets API** and **Google Drive API** for that project (APIs & Services → Library).
3. Go to APIs & Services → Credentials → Create Credentials → Service Account.
4. Give it any name (e.g. `echelon-backup`). No special roles needed.
5. Open the new service account → Keys → Add Key → Create new key → JSON. This downloads a `.json` file — **keep it private, never commit it to the repo.**
6. Note the service account's email address (looks like `echelon-backup@your-project.iam.gserviceaccount.com`).

### 2. Create the destination Sheet and Drive folder
1. Create a new Google Sheet (this becomes the backup destination). Copy its ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`.
2. Create a new Google Drive folder (destination for photo backups). Copy its ID from the URL: `https://drive.google.com/drive/folders/THIS_PART_IS_THE_ID`.
3. **Share both** the Sheet and the Drive folder with the service account's email (from step 1.6) as an **Editor**.

### 3. Add secrets to GitHub
In the `ECHELON_LIVE` repo on GitHub: Settings → Secrets and variables → Actions → New repository secret. Add each of these (run `gh secret set NAME` yourself in a terminal, or use the GitHub web UI — the value is never shared with anyone else this way):

| Secret name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://plkdyvtriajpzcfgtwzp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase dashboard → Settings → API → service_role key (never expose this anywhere else) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The full contents of the JSON key file from step 1.5 |
| `GOOGLE_SHEET_ID` | From step 2.1 |
| `GOOGLE_DRIVE_FOLDER_ID` | From step 2.2 |

### 4. Test it
Once secrets are set, go to the repo's Actions tab → "Scheduled Supabase backup to Google Sheets" → Run workflow (this triggers it manually instead of waiting for the daily 9am UTC schedule). Check the Sheet for a new tab per table and a `_backup_log` tab recording the run.

## What this does and does not cover
- Covers: the tables listed in `TABLES` in `run-backup.js` (member profiles, waivers, progress photos, coaching applications, coach messages, workout plans, weekly check-ins, session check-ins, website leads, enrollment offers, Stripe payment events, account access, admin roster).
- Does not cover: actual payment processing data beyond what's mirrored into `stripe_payment_events` — Stripe itself remains the source of truth for full payment/transaction records (see your Stripe Dashboard's own data export tools for that).
- Each run fully replaces the previous snapshot in each tab (not versioned history) — the `_backup_log` tab is the only append-only record of run times.
- Add more tables to `TABLES` in `run-backup.js` any time; no other changes needed.
