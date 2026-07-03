# PerkHub — Build Plan

A membership-verified discount marketplace for Nigeria: consumers from cooperatives / alumni bodies / professional associations / NYSC / corporate groups get verified once, then unlock deals from partner brands. The platform tracks every redemption and earns commission per transaction.

**Name suggestion:** PerkHub works. Alternatives worth considering: **Verified.ng**, **Perkly**, **TribePerks**, **Naija Perks**, **Kinfolk**. I'll use **PerkHub** unless you prefer another.

## Scope of this plan

This is a large multi-role platform. I'll build it in phases and confirm before moving to the next. **Phase 1 ships in this first turn**; later phases follow as separate turns so you can review and steer.

## Tech foundation

- TanStack Start (already scaffolded) + Tailwind + shadcn/ui
- **Lovable Cloud** (Supabase under the hood) for auth, Postgres, storage, RLS, scheduled jobs
- Google OAuth via managed provider + email/password
- Paystack for commission invoicing (Phase 6) — Nigeria-first
- Naira formatting, +234 phone masks, Nigerian states/LGA data throughout

## Data model (all built in Phase 1 migration)

```text
profiles            (id→auth.users, full_name, phone, state, lga, avatar_url)
user_roles          (user_id, role: consumer|brand_partner|admin)  -- separate table, has_role() SECURITY DEFINER
affiliation_groups  (id, name, type, verification_methods[], email_domains[], whitelist_ref, badge_validity_months, active)
group_whitelist     (id, group_id, membership_number, full_name?) -- admin CSV upload
user_memberships    (id, user_id, group_id, method, membership_number, id_document_url,
                     status: pending|verified|rejected|expired, rejection_reason, verified_at, expires_at)
brands              (id, owner_user_id, name, cac_number, category, logo_url, contact_email,
                     status: pending|approved|suspended, commission_type: pct|flat, commission_rate)
deals               (id, brand_id, title, slug, description, discount_type, discount_value,
                     terms, target_group_ids[], channel: online|instore|both, redemption_url,
                     start_date, end_date, per_user_limit, total_cap,
                     status: draft|pending_review|published|rejected|expired)
transactions        (id, user_id, deal_id, brand_id, group_id, redemption_code, method,
                     original_price?, final_price?, discount_applied,
                     commission_rate, commission_amount, commission_status,
                     status: redeemed|expired|cancelled|disputed, created_at)
saved_deals         (user_id, deal_id)
commission_invoices (id, brand_id, period_start, period_end, total_amount, status, paid_at, paystack_ref)
```

**PII separation:** `transactions` references `user_id` but stores no PII columns directly — reports join only when admin explicitly needs identity. RLS enforces this per role.

## RLS policy shape

- `profiles`, `user_memberships`, `saved_deals`, own `transactions`: owner-only (`auth.uid() = user_id`).
- `brands`, own `deals`, brand's `transactions`/`commission_invoices`: `owner_user_id = auth.uid()` OR `has_role(uid,'admin')`.
- `deals` (published): public SELECT for verified consumers only via a view.
- `affiliation_groups`: public SELECT (active), admin write.
- Everything: `has_role(uid,'admin')` bypass for admin.

## Phased delivery

### Phase 1 (this turn) — Foundation & shells
- Enable Lovable Cloud, run full schema migration + RLS + `has_role()` + triggers (auto-create profile, default consumer role, auto-expire memberships/deals via pg_cron).
- Design system: fintech-clean, Naija-confident. Deep green primary + warm gold accent, Inter for UI, generous cards, verified-badge component. Mobile-first.
- Auth pages: sign in / sign up (email+password + Google), password reset page at `/reset-password`.
- Role-based routing: after login redirect to `/app` (consumer), `/brand` (partner), `/admin` (admin). Managed `_authenticated` gate.
- Shell layouts for all three dashboards with nav, empty states, and role guards (`has_role` in `beforeLoad`).
- Public landing page explaining the platform.

### Phase 2 — Membership verification
- Consumer flow: pick affiliation type → search/select group → choose verification method (ID upload / email domain / membership number).
- Storage bucket `membership-docs` (private, owner-read + admin-read).
- Auto-verify when email domain matches or whitelist match; else pending.
- Digital membership card page with QR code, expiry, status badge.
- Admin queue: approve/reject with reason.

### Phase 3 — Brand onboarding & deals
- Brand application form → admin approval queue.
- Brand deal composer (all fields from spec) → admin review queue → publish.
- Logo upload to `brand-logos` bucket (public).

### Phase 4 — Deal discovery & redemption
- Browse grid with search, filters (category, group, channel, expiring soon), saved deals.
- Deal detail + Redeem action: generates unique code (server fn) or issues tracked redirect. Writes `transactions` row with commission snapshot.
- "Only visible to verified members of target groups" enforcement.

### Phase 5 — Analytics & commission tracking
- Admin analytics: charts by group / brand / category / time, CSV export.
- Brand dashboard: own stats + commission owed.
- Monthly invoice generation (scheduled job).

### Phase 6 — Paystack invoice payments
- Brands pay invoices in-app; webhook marks paid.

## Design direction (Phase 1)

- Palette (oklch tokens in `styles.css`): deep forest green primary, warm gold accent, off-white bg, near-black text; success/warning/destructive tuned for status badges.
- Typography: Inter (UI) + Space Grotesk (display headers).
- Components: rounded-xl cards, subtle borders, status pills, verified checkmark motif, ₦ currency helper, +234 phone input.
- Motion: light — hover lift on deal cards, page fade.

## What I need from you before starting Phase 1

1. **Name:** PerkHub, or pick one of the alternatives above / propose your own?
2. **Admin bootstrap:** After sign-up, first admin needs to be promoted. OK if I make it so **the first user to register with a specific email you give me** is auto-granted admin (verified-domain trigger pattern), or you'd rather promote manually later via SQL?
3. **Google OAuth:** confirm you want it enabled Phase 1 (I'll set it up through the managed broker).
4. Anything to cut or reprioritize? Otherwise I'll proceed exactly as phased.

Reply with answers (or "go" to accept defaults: name = PerkHub, admin bootstrap = tell me the email, Google on) and I'll build Phase 1.
