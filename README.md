# Round — group gathering planner

React + Cloudflare Workers app for planning lunches, dinners, and other friend gatherings. Data is stored in **Cloudflare D1**, so RSVP links work on any phone or browser.

## What it does

- **Create events** with date, time, location, and currency
- **Build a menu** with priced options
- **Self-service RSVP** — guests register themselves or others, pick dishes, note allergies
- **Cost & payments** — totals from menu picks, mark paid / partial / outstanding
- **Shared cloud storage** — share one link; everyone updates the same event

## Local development

Needs two processes (API Worker + Vite). One command starts both:

```bash
npm install
npm run db:migrate:local
npm run dev
```

- Web UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787` (Vite proxies `/api`)

## Deploy to Cloudflare

```bash
npm run deploy
```

That builds the SPA, applies D1 migrations remotely, and deploys the Worker + static assets. Wrangler will print the public `*.workers.dev` URL — share RSVP links from that host.

Live deployment: https://round-gatherings.rtdw.workers.dev

## Notes

Your browser only remembers which gathering IDs you’ve opened or created (so the home list stays personal). Anyone with an RSVP link can open that event and register.
