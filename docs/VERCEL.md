# Deploy on Vercel

This repo is **static HTML at the root** plus **two Node serverless handlers** under [`api/`](../api/):

| Route | Purpose |
|--------|---------|
| `GET /api/health` | Smoke test (`stripeConfigured`, catalogue SKUs) |
| `POST /api/create-checkout-session` | Creates a Stripe Checkout session (same logic as Express in `server/`) |

Stripe logic and prices live in **[`lib/stripe-checkout.js`](../lib/stripe-checkout.js)** and **[`lib/catalog.js`](../lib/catalog.js)** so Express and Vercel stay aligned.

## 1. Repo → Vercel

1. Push the repo to GitHub/GitLab/Bitbucket (or deploy with Vercel CLI).
2. In the Vercel project: **Framework Preset:** “Other”; **Root directory:** `.` (default).
3. No build command required (`package.json` at root installs `stripe` for the Functions).

## 2. Environment variables (Project → Settings → Environment Variables)

**Required:**

| Variable | Notes |
|-----------|------|
| `STRIPE_SECRET_KEY` | `sk_live_…` / `sk_test_…` from Stripe |

**Strongly recommended (stable Stripe return URLs):**

| Variable | Example |
|-----------|---------|
| `PUBLIC_SITE_BASE` | `https://your-domain.com` — **no trailing slash**, scheme + host only |

If omitted, redirects use **`x-forwarded-proto`** + **`x-forwarded-host`** from each request (works on `*.vercel.app` previews; `PUBLIC_SITE_BASE` is safest for production + custom domains).

**Optional:**

| Variable | Meaning |
|-----------|---------|
| `CLIENT_PATH_PREFIX` | Rare: static site under a path segment |
| `CLIENT_ENTRY` | Default `index.html` |
| `STRIPE_PRICE_TRAINING_TEE` | Prefer a Stripe **Price** id instead of catalog cents |
| `PAYMENT_ORIGINS` | CORS tuning (omit for permissive storefront; set if you lock down callers) |

## 3. Frontend checkout URL

[`js/echelon-config.js`](../js/echelon-config.js) uses **`window.ECHELON_CHECKOUT_API = ''`** so production calls **`/api/create-checkout-session`** on the same hostname as the site—no duplicate API domain.

## 4. Verify after deploy

- Open `https://<your-deployment>/api/health` → `stripeConfigured` should be `true`.
- Add a tee → Checkout → Stripe hosted page loads.

## 5. Local “Vercel-like” run

With [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel` then from repo root:

```bash
vercel dev
```

Or keep using **`npm run dev`** (Express under `server/`) and uncomment the checkout host line in [`js/echelon-config.js`](../js/echelon-config.js).
