# Echelon Fitness Collective — Security Review

Reviewed: July 26, 2026

## What was fixed and verified

- **Approval-only Member Hub:** `account_access` now separates role from membership status. New accounts are `applicant / pending`; only active members, active coaches, and administrators may use the Member Hub.
- **Database enforcement:** RLS policies for profiles, onboarding, waivers, weekly check-ins, nutrition data, coaching records, private library files, and progress photos now require active Member Hub access in addition to ownership.
- **Admin authorization:** Browser code no longer treats an email address as permission. Admin status is checked with the existing database-backed `is_echelon_admin()` function.
- **API control:** Food search now validates both the Supabase session and active Member Hub access before contacting food providers.
- **Headers:** Vercel now sends anti-framing, no-sniff, referrer, permissions, and content-security headers.

## Verification performed

- The Supabase migration completed successfully.
- A read-only database check confirmed `public.account_access` exists and `has_member_hub_access()` returns false with no authenticated member context.
- JavaScript syntax checks passed for member auth, admin auth, and the nutrition API.

## Remaining production work

1. Turn off public Supabase sign-up if the service will be strictly invite-only. Password reset can remain enabled.
2. Move public applications, check-ins, contact requests, and waitlist submissions behind a server route with bot protection and durable rate limiting. They currently write directly from the public browser and can be spammed.
3. Build **Approve and Invite Member** as a server-only action after adding `SUPABASE_SERVICE_ROLE_KEY` securely in Vercel. Never put that key in front-end code.
4. Test an active approved account and a pending account after deployment. The pending account must be denied access and receive no private data.

## Operating rule

Do not change a person to `role = member` and `membership_status = active` until Echelon has approved them. Do not store passwords, activation links, recovery codes, or service keys in the Admin Console or the website source.
