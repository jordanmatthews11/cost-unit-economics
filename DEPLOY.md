# Get a public URL for this app

Your app is static (HTML/CSS/JS only). Easiest way to get a live URL:

## Option A: Netlify Drop (no account required to try)

1. Go to **https://app.netlify.com/drop**
2. Drag and drop your **entire project folder** (the one that contains `index.html`, `app.js`, `styles.css`) onto the page.
3. Netlify will give you a URL like `https://random-name-12345.netlify.app`. That’s your public link.

To keep the site and customize the URL, create a free Netlify account when prompted.

## Option B: Netlify with Git (good if you use GitHub)

1. Push this project to a GitHub repository.
2. Sign in at **https://app.netlify.com** and click **Add new site** → **Import an existing project**.
3. Connect GitHub, choose the repo, then deploy. Netlify will detect the static site and give you a URL.

## Option C: GitHub Pages

1. Push this project to a GitHub repository.
2. In the repo go to **Settings** → **Pages**.
3. Under **Source** choose **Deploy from a branch**.
4. Select branch `main` (or `master`) and folder **/ (root)**. Save.
5. Your site will be at `https://<your-username>.github.io/<repo-name>/`.

---

After deploying, share the URL you get — that’s your public link.
