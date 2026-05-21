# ECHELON_LIVE-main

Echelon Fitness Collective static storefront (`index.html`), admin tooling (`admin-portal.html`), shared config [`js/echelon-config.js`](js/echelon-config.js).

## Stripe + deploy

| What | Where |
|------|--------|
| **Vercel (static site + Checkout API)** | **[docs/VERCEL.md](docs/VERCEL.md)** — `/api/create-checkout-session` |
| **Local Express fallback** | `npm run dev` → [`server/`](server/) |
| **Payment details** | **[docs/PAYMENTS.md](docs/PAYMENTS.md)** |

Shared SKU + Stripe logic: [`lib/catalog.js`](lib/catalog.js), [`lib/stripe-checkout.js`](lib/stripe-checkout.js).

## Quick local commands

```powershell
# Static site only (another terminal): npx serve -l 5500 .
npm run dev
```

For **`vercel dev`**: `npm install -g vercel` then `vercel dev` from repo root.
