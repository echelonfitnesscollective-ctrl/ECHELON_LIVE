# Echelon Fitness Collective Website

## Project structure

```text
index.html                 Homepage and main site entry point
pages/                     Public, member, admin, and legal HTML pages
assets/css/                Site styling
assets/js/                 Site behavior, forms, member access, and admin access
assets/images/             Product images, brand images, and photography
assets/documents/          Downloadable member and trainer PDFs
database/                  Supabase setup and migration SQL files
```

## Publishing

Upload this entire folder while preserving the structure above. The website entry point is `index.html`; all internal pages and assets are linked from there.

## Supabase

The password-reset redirect URL is:

```text
https://www.echelonfitness.co/pages/member-reset.html
```
# Echelon Fitness Collective

## Stripe Checkout configuration

The public site never stores Stripe secrets. Add the following environment variables in Vercel before publishing checkout:

- `STRIPE_SECRET_KEY`, Stripe secret key for the active environment (test first).
- `STRIPE_WEBHOOK_SECRET`, signing secret for the Stripe webhook endpoint: `/api/stripe/webhook`.
- `STRIPE_PRICE_GROUP_DROP_IN`, the `$20` Echelon Group Fitness drop-in price ID.
- `STRIPE_PRICE_GROUP_UNLIMITED`, the `$59/month` Echelon Group Fitness price ID.
- `STRIPE_PRICE_12_WEEK_MONTHLY`, the approved Echelon 12 monthly coaching price ID.
- `STRIPE_PRICE_12_WEEK_FULL`, the approved Echelon 12 paid-in-full coaching price ID.
- `STRIPE_PRICE_ONE_ON_ONE_MONTHLY`, the approved 1-on-1 monthly coaching price ID.
- `SITE_URL`, `https://www.echelonfitness.co`.
- `STRIPE_ALLOW_PROMOTION_CODES`, `true` to allow the Echelon ambassador codes during Checkout.
- `SUPABASE_SERVICE_ROLE_KEY`, server-only key used to record a verified Stripe payment and issue a secure Member Portal invitation. Never add this key to browser code or a public file.

Keep the Stripe webhook as the only trusted payment signal. A success page confirms a checkout experience but never grants Member Portal access on its own.

## Approved applicant flow

1. A submitted application creates a private `NEW MEMBER LAUNCH` project and checklist in Supabase.
2. In the Admin Console → Leads, choose the approved program and create a private payment link.
3. Send that Stripe-backed link from the generated email action. A signed Stripe webhook changes the record to `Paid, Ready to Invite`.
4. Only then does the console unlock the Member Portal invitation action. Supabase sends the password-setup email and activates the member record.
