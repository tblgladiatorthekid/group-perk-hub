# PerkHub Backend Re-architecture — Design

**Date:** 2026-07-03
**Status:** Approved (pending spec review)

## Summary

Replace the Supabase/Lovable backend with a standalone TypeScript API service. The
product is unchanged: members verify an affiliation once and unlock brand perks;
brands pay commission per verified redemption; admins review verifications and brands.
This document specifies the new stack, the monorepo restructure, how Supabase-provided
capabilities (auth, RLS, storage, DB-trigger business logic) are replaced, and the
docs/branding cleanup that accompanies the migration.

## Goals

- Remove all runtime dependence on Supabase and Lovable Cloud.
- Stand up a separate, independently deployable TypeScript API.
- Preserve the existing data model and product behavior 1:1.
- Move business logic out of Postgres triggers into tested TS service code.
- Replace RLS with explicit app-layer authorization.
- Update project docs and favicon to reflect the new architecture and PerkHub brand.

## Non-goals

- No new product features. This is a like-for-like backend replacement.
- No redesign of the frontend UI (only its data/auth wiring changes).
- No change to the deal/commission product rules themselves.

## Decisions (locked)

| Area | Choice |
| --- | --- |
| Backend shape | Standalone TypeScript API service |
| API framework | Hono |
| ORM / DB | Drizzle ORM + Postgres |
| Validation | Zod (shared package) |
| Auth provider | Clerk (managed identity) |
| Repo layout | Monorepo, Bun workspaces, frontend moved into a folder |
| Deployment | Railway (API + managed Postgres + object-storage bucket) |
| Object storage | Railway bucket, S3-compatible, presigned URLs |

## Monorepo structure

Bun workspaces. The existing frontend moves from the repo root into `apps/web`.

```
group-perk-hub/
  apps/
    web/          TanStack Start frontend (moved from root src/)
    api/          Hono TypeScript API service
  packages/
    shared/       Zod schemas, DTOs, shared enums/types (imported by web + api)
  package.json    workspaces: ["apps/*", "packages/*"]
  bunfig.toml     retained (supply-chain guard)
```

**Risk — Lovable sync:** Lovable's editor/HMR plugins expect the frontend at repo
root. Moving it to `apps/web` may break Lovable in-editor sync. Accepted tradeoff:
the project is migrating off Lovable Cloud regardless. Mitigation during
implementation: verify the app still builds/runs from `apps/web` and update
`vite.config.ts`, `tsconfig`, and any Lovable config paths accordingly. If Lovable
sync must be retained, this is the one decision to revisit.

`packages/shared` is the contract between the two apps: Zod schemas define request and
response shapes once, the API validates against them, and the web client infers types
from them — no duplicated DTO definitions.

## API service (`apps/api`)

Hono app, layered for isolation and testability:

```
routes/         HTTP routing + request validation (Zod), thin
middleware/     Clerk auth, role guards, error handling, logging
services/       business logic (verification, deals, redemptions, commissions)
repositories/   Drizzle queries — the only layer that touches the DB
db/             Drizzle schema + migrations
lib/            storage (presigned URLs), clerk client, config
```

Rules:
- Routes never touch the DB directly; they call services.
- Services hold all business rules and are unit-testable without HTTP.
- Repositories are the sole Drizzle boundary, so query changes don't ripple.

## Authentication & authorization

Clerk owns identity; the API owns roles and per-resource authorization.

**Identity (Clerk):** email/password, Google OAuth, email verification, password
reset, and MFA are handled by Clerk. The web app uses Clerk's React SDK and attaches a
short-lived JWT to every API request.

**API auth middleware:** verifies the Clerk JWT, resolves the Clerk user id to the app
`users` row, and attaches `{ userId, roles }` to the request context. Requests without
a valid token are rejected 401.

**User provisioning (replaces `handle_new_user` trigger):** a Clerk `user.created`
webhook hits the API, which creates the app `users` row and a default `consumer` role.
If signup carried `intended_role: brand`, the API also grants `brand_partner`. The
webhook is verified via Clerk's signing secret.

**Authorization (replaces RLS):** RLS is removed. Authorization becomes explicit:
- Role guards (`requireRole('admin')`, etc.) as middleware on protected routes.
- Ownership checks in services (e.g., a brand_partner may only mutate their own
  brand/deals; a user may only read their own memberships/transactions).
- These checks previously lived in Postgres RLS policies and are ported into the
  service layer with dedicated tests — this is the highest-risk area of the migration.

## Data model

Port the existing Postgres schema 1:1 into Drizzle migrations. Postgres remains; it is
simply self-hosted on Railway instead of Supabase-managed.

**Enums:** `app_role`, `affiliation_type`, `verification_method`, `membership_status`,
`brand_status`, `deal_status`, `discount_type`, `deal_channel`, `commission_type`,
`transaction_status`, `commission_status`, `invoice_status`.

**Tables:** `users` (app profile, keyed by internal id, carries `clerk_user_id`),
`user_roles`, `affiliation_groups`, `group_whitelist`, `user_memberships`, `brands`,
`deals`, `saved_deals`, `transactions`, `commission_invoices`.

Notable change: the old `profiles.id` referenced `auth.users(id)`. The new `users`
table has its own primary key plus a unique `clerk_user_id`, since identity is external.
All FKs that pointed at `auth.users` now point at `users`.

## Business logic migration (triggers → services)

Logic currently enforced by Postgres triggers moves into TS services with tests:

- **Auto-verify** (`tg_auto_verify_membership`) → `MembershipService.submit()`:
  on submit, auto-set `verified` when the user's email domain matches the group's
  `email_domains` or the membership number matches `group_whitelist` (case-insensitive);
  otherwise `pending` for admin review.
- **Expiry stamping** (`tg_stamp_membership_expiry`) → on transition to `verified`,
  stamp `verified_at = now()` and `expires_at = now() + badge_validity_months`.
- **Redemption + commission**: redemption-code generation, discount/commission
  computation, and invoice roll-ups become explicit service methods (previously
  implied by the transactions/commission schema).

The shared `updated_at` behavior can stay as a lightweight DB trigger or move to
Drizzle defaults — implementer's choice, kept consistent across tables.

## Object storage (ID documents)

Railway S3-compatible bucket replaces the Supabase `membership-docs` bucket.

- **Upload:** API issues a presigned PUT URL scoped to `${userId}/${uuid}.${ext}`; the
  browser uploads the file directly to the bucket; the API records the object key on
  `user_memberships.id_document_url`.
- **Admin review download:** API issues a short-lived presigned GET URL so only the
  owner and admins can view a document.
- Documents are never public; access is always mediated by a presigned URL from the API.

## Frontend changes (`apps/web`)

- Remove `@supabase/supabase-js` and `src/integrations/supabase/*`
  (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`).
- Remove Lovable Supabase-cloud coupling; keep TanStack Start itself.
- Add a typed **API client** — a `fetch` wrapper that sends the Clerk JWT and
  validates responses against `packages/shared` Zod schemas.
- Add Clerk React provider at the app shell (`__root.tsx`).
- Re-implement `src/hooks/use-auth.tsx` on Clerk (session, roles from the API, existing
  `primaryRole` / `homePathFor` helpers preserved).
- `_authenticated.tsx` gate uses the Clerk session instead of `supabase.auth.getUser()`.
- Data-fetching routes (verify, membership, admin verifications, brand, admin index)
  call the API via TanStack Query instead of `supabase.from(...)`.

## Deployment (Railway)

Three Railway resources provisioned via the Railway integration:
- **API service** — deploys `apps/api` (Nixpacks/Docker), env-configured.
- **Managed Postgres** — connection string injected into the API service.
- **Object-storage bucket** — S3-compatible credentials injected into the API service.

The frontend continues to deploy as today (Nitro/Cloudflare target) with a new
`VITE_API_BASE_URL` env var pointing at the API service, plus Clerk publishable key.

**Environment variables (new):**

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | api | Postgres connection |
| `CLERK_SECRET_KEY` | api | verify JWTs, call Clerk API |
| `CLERK_WEBHOOK_SECRET` | api | verify `user.created` webhook |
| `STORAGE_*` (endpoint/key/secret/bucket) | api | presigned URLs |
| `VITE_CLERK_PUBLISHABLE_KEY` | web | Clerk React SDK |
| `VITE_API_BASE_URL` | web | API base URL |

All `SUPABASE_*` / `VITE_SUPABASE_*` variables are removed.

## Docs & branding cleanup

- Rewrite `CLAUDE.md` and `README.md` to describe this architecture; remove all
  Supabase and Lovable-backend references, including the "Lovable sync" guidance tied to
  Supabase provisioning.
- Replace `public/` favicon with a PerkHub-branded mark derived from the existing
  `src/components/perk/Logo.tsx`, and update the document head/manifest references.

## Testing strategy

- **Service unit tests** for verification (email-domain, whitelist, manual), expiry
  stamping, redemption-code + commission computation.
- **Authorization tests** covering the RLS-replacement rules: owner-only reads,
  role-gated writes, admin overrides — one test per policy previously in SQL.
- **API integration tests** for auth middleware (valid/invalid/missing token) and the
  Clerk webhook (valid/invalid signature).
- A test database (ephemeral Postgres) runs migrations before the suite.

## Risks & open items

1. **Lovable sync breakage** from the `apps/web` move — accepted; revisit only if
   in-editor Lovable sync must be kept.
2. **Authorization parity** — RLS → app-layer is the highest-risk change; covered by
   dedicated tests enumerating every former policy.
3. **Data migration** — if any real Supabase data must be preserved, an export/import
   step is needed; assumed greenfield (no production data) unless stated otherwise.

## Migration sequencing (high level)

1. Restructure into the monorepo (`apps/web`, `apps/api`, `packages/shared`).
2. Stand up `apps/api` skeleton (Hono + Drizzle + config + health check).
3. Port schema to Drizzle migrations; provision Railway Postgres.
4. Implement auth (Clerk middleware + webhook provisioning) and role guards.
5. Implement services + repositories + routes, porting trigger logic with tests.
6. Wire object storage (presigned uploads/downloads).
7. Re-wire the frontend (API client, Clerk, remove Supabase).
8. Deploy to Railway; update docs and favicon.
