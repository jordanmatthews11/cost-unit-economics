# Cost Unit Economics Calculator

A browser-based dashboard for calculating cost-per-project and cost-per-response-group across your teams. **Sign-in with Google (Gmail) is required** to use the app.

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

## Teams

- Project Management
- Platform
- Solutions Architect

## How to Use

1. Open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge).
2. For each team, enter **Projects** and **Response Groups** (survey responses), then cost data — headcount, average salary, tools, overhead, and other costs.
3. Results update in real time as you type.
4. Use **Export as CSV** or **Copy Summary** to share your results.

## Get a public URL

See **[DEPLOY.md](DEPLOY.md)** for steps to put this app online (e.g. Netlify or GitHub Pages) and get a shareable link.

## Cost Formula

```
Team Total = (Headcount x Avg Salary) + Tools + Overhead + Other
Grand Total = Sum of all team totals
Cost per Project = Grand Total / Total Projects
Cost per Response Group = Grand Total / Total Response Groups
```

## No Dependencies

This is a standalone HTML/CSS/JS app — no build tools, servers, or installations required.
