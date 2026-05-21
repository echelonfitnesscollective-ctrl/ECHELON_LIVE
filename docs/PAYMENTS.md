# Echelon — Stripe Checkout

Pricing is **never** taken from unchecked client input: **`lib/catalog.js`** maps **SKUs** to amounts or optional **Stripe Price IDs** (`STRIPE_PRICE_TRAINING_TEE`). Session creation logic lives in **`lib/stripe-checkout.js`**.

Two ways to expose the API:

| Target | Notes |
|---------|-------|
| **Vercel** (recommended prod) | Serverless **`api/*.js`** — see **[VERCEL.md](VERCEL.md)** |
| **Express** (`server/`) | `npm run dev` from repo root or `server/` |

## Prerequisites

1. **Serve storefront over HTTP(S)** (`file://` has no workable origin — use Live Server, `npx serve`, or Vercel).
2. A **Stripe** account ([dashboard](https://dashboard.stripe.com/test/apikeys)).

## Vercel (production)

Deploy the repo → set **`STRIPE_SECRET_KEY`** and (recommended) **`PUBLIC_SITE_BASE`**. Storefront checkout uses **`ECHELON_CHECKOUT_API`** left unset / `''` so the browser POSTs **`/api/create-checkout-session`**.

Quick reference: **[VERCEL.md](VERCEL.md)**

## Local Express (`server/`)

```bash
cd server
npm install
cp .env.example .env
```

Edit **`server/.env`**:

| Variable | Meaning |
|---------|---------|
| `STRIPE_SECRET_KEY` | Test/live secret from Stripe |
| `CLIENT_ORIGIN_HOST` | What you see before the path (`http://127.0.0.1:5500`) |
| `CLIENT_PATH_PREFIX` | Folder before `index.html` if any |
| `CLIENT_ENTRY` | Usually `index.html` |
| `PAYMENT_ORIGINS` | CORS allowlist origins for `fetch` |

Start:

```bash
npm run dev
```

Smoke test: `http://127.0.0.1:4242/api/health`

## Frontend pointing at Express locally

Either set **`window.ECHELON_CHECKOUT_API = 'http://127.0.0.1:4242'`** *before* `echelon-config.js`, **or** uncomment the line at the bottom of **`js/echelon-config.js`**.

## Cart SKUs

Training tee uses SKU **`training_tee`**.

1. Extend **`lib/catalog.js`** (+ optional Stripe Price env vars).
2. Pass the SKU from **`handleAddToCart(...)`** / shop markup in **`index.html`**.

## Webhooks

For fulfillment, add Stripe webhooks targeting your deployment (signature verification requires the **raw** body route – see Stripe docs). This scaffold relies on Checkout success/cancel redirects.
