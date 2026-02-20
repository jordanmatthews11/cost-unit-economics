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

The Bills tab uses Vercel serverless API + database + file storage. To enable it:

1. **Database**: Create a Postgres database (e.g. [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or [Neon](https://neon.tech)) and set `POSTGRES_URL` in your Vercel project environment variables.
2. **Run the schema once**: In your database SQL console, run the contents of [scripts/schema.sql](scripts/schema.sql) to create the `expenses` table.
3. **File storage**: Create a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store and set `BLOB_READ_WRITE_TOKEN` in Vercel.
4. **API auth**: Set `GOOGLE_CLIENT_ID` in Vercel environment variables (same value as in `app.js`) so the API can verify Google ID tokens.

Local dev: run `npm install` and `vercel dev`; use `vercel env pull` to get env vars.

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
- Backend (Bills): `@vercel/postgres`, `@vercel/blob`, `google-auth-library`, `busboy` (see `package.json`). Run `npm install` for local API dev.
