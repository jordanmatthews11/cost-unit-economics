# Ops Finance Hub

Dual-purpose ops finance app: **Unit Economics** (cost per project and per response group) and **Bills & Expenses** (expense tracker with file attachments). Sign-in with Google (Gmail) is required.

## Google sign-in setup

The app uses [Google Identity Services](https://developers.google.com/identity/gsi/web) and requires a Google OAuth 2.0 Web client ID.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen) if you have not already.
3. Create credentials: **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Choose application type **Web application**.
5. Under **Authorized JavaScript origins**, add:
   - Your production URL (e.g. `https://cost-unit-economics.vercel.app`)
   - Your local dev origin (e.g. `http://localhost:5500` or `http://127.0.0.1:5500`).
6. Copy the **Client ID** (e.g. `xxxxx.apps.googleusercontent.com`).
7. In the project, open `app.js` and set the constant at the top:
   ```js
   const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
   ```
   Replace `YOUR_CLIENT_ID...` with your actual Client ID.

Until you set a valid `GOOGLE_CLIENT_ID`, the sign-in button may not work or may show a console error.

## Bills & Expenses (backend)

The Bills tab uses Vercel serverless API + **Firestore** (database) + optional file storage. To enable it:

1. **Database**: Set up Firestore (see [Firestore setup](#firestore-setup) below).
2. **API auth**: Set `GOOGLE_CLIENT_ID` in Vercel (same value as in `app.js`). See [Google sign-in setup](#google-sign-in-setup).
3. **File storage** (optional): For PDF attachments, create [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) and set `BLOB_READ_WRITE_TOKEN`.

Local dev: run `npm install` and `vercel dev`; use `vercel env pull` to get env vars.

### Firestore setup

Do this once. No SQL—Firestore creates the `expenses` collection when the app first writes data.

**Step 1: Open Firebase** — Go to [Firebase Console](https://console.firebase.google.com/). Sign in with your Google account.

**Step 2: Create a project** — Click **Add project** (or select existing). Name it (e.g. `ops-finance-hub`), follow prompts, click **Continue** until done.

**Step 3: Enable Firestore** — Left sidebar: **Build** → [Firestore Database](https://console.firebase.google.com/project/_/firestore). Click **Create database** → **Start in production mode** → pick region (e.g. `us-central1`) → **Enable**.

**Step 4: Get service account JSON** — Left sidebar: gear → **Project settings** → [Service accounts](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk). Click **Generate new private key** → **Generate key**. A JSON file downloads.

**Step 5: Add env var in Vercel** — Open the downloaded JSON in a text editor, select all, copy. Go to [Vercel](https://vercel.com) → your project → **Settings** → [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables). Click **Add New**. For **Key**, paste exactly:

```
FIREBASE_SERVICE_ACCOUNT_JSON
```

For **Value**, paste the entire JSON file contents. If the field truncates your paste, use **one line** (minify the JSON in a text editor so there are no line breaks), or paste the **base64** of the JSON (e.g. run `base64 -i your-file.json | tr -d '\n'` and paste the output). Environments: check **Production** (and **Preview** if needed). Click **Save**.

**Step 6: Redeploy** — **Deployments** → **⋯** on latest → **Redeploy** (or push a commit).

**Index error?** — When you first load Bills & Expenses, Firestore may require a composite index. The app will show a toast and open the index-creation link; click **Create index** on that page, wait ~1–2 minutes, then refresh the app.

## Troubleshooting

- **"Could not load existing expenses" or 401 Unauthorized**: Set `GOOGLE_CLIENT_ID` in Vercel (Project → Settings → Environment Variables) to the **exact same** value as in `app.js` (the Web client ID). Apply to Production and, if you use preview URLs, to Preview. Then redeploy.
- **500 when loading or saving expenses**: Ensure Firestore is set up (see [Firestore setup](#firestore-setup)) and `FIREBASE_SERVICE_ACCOUNT_JSON` is set in Vercel. Redeploy after changing env.
- If you see a 503 toast with "Sign-in not configured" or "Database not configured", set the indicated env variable in Vercel (e.g. `GOOGLE_CLIENT_ID` or `FIREBASE_SERVICE_ACCOUNT_JSON`) and redeploy.

## Teams

- Project Management
- Platform
- Solutions Architect

## How to Use

- **Unit Economics tab**: Enter Projects and Response Groups per team, then cost data (headcount, salary, tools, overhead). Results and cost-per-project / cost-per-response-group update in real time. Export as CSV or Copy Summary.
- **Bills & Expenses tab**: Add expenses with vendor, amount, date, status, category, notes, and optional PDFs (internal bill and 3rd party invoice). Filter by status/category; edit or delete entries; attach files when adding or later via Edit.

## Get a public URL

See **[DEPLOY.md](DEPLOY.md)** for steps to put this app online (e.g. Netlify or GitHub Pages) and get a shareable link.

## Cost Formula

```
Team Total = (Headcount x Avg Salary) + Tools + Overhead + Other
Grand Total = Sum of all team totals
Cost per Project = Grand Total / Total Projects
Cost per Response Group = Grand Total / Total Response Groups
```

## Dependencies

- Frontend: none (vanilla HTML/CSS/JS).
- Backend (Bills): `firebase-admin`, `@vercel/blob`, `google-auth-library`, `busboy` (see `package.json`). Run `npm install` for local API dev.
