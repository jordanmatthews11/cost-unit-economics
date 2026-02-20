# Cost Unit Economics Calculator

A browser-based dashboard for calculating cost-per-project and cost-per-response-group across your teams.

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
