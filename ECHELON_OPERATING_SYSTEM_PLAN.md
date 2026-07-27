# Echelon Operating System — Build Plan

## What already exists

- Static Echelon site on Vercel with Supabase authentication.
- Protected Member Hub, Admin Console, Coach Command task list, forms, private Member Vault, media/content CMS, and current nutrition/coaching records.
- Approval-only role/status gate in `account_access` and privacy-first RLS rules.

## What this phase adds

1. A connected applicant record, onboarding project, reusable launch-task template, notifications, and audit trail.
2. Separate application, payment, account, onboarding, and membership statuses.
3. Centralized programs and price configuration—no price is repeated across pages.
4. A premium member welcome experience and a visible starting-path checklist.
5. Server-only Stripe Checkout, webhook, invitation, and billing actions once secrets are configured.

## Delivery order

1. Apply the operations-system database migration.
2. Add Command Center views for applications, projects, tasks, and member progress.
3. Add the member welcome and onboarding checklist screens.
4. Configure Stripe test products/prices and add secure Vercel environment variables.
5. Implement server-only checkout, webhooks, customer portal, and approve-and-invite actions.
6. Test applicant, payment, failed payment, approval, invite, onboarding, paused, and canceled flows before launch.

## Stripe configuration required later

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe product and price IDs for each real program
- `SUPABASE_SERVICE_ROLE_KEY` for server-only invitation and verified synchronization

No secret belongs in browser code, Supabase public settings, the CMS, or the Admin Console.
