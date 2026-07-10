# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PerkHub — a Nigerian membership-perks platform. Members verify their affiliation (NYSC, alumni bodies, professional associations, cooperatives, corporate staff, etc.) once, then unlock discounts from partner brands who pay commission per verified redemption. Three roles drive everything: `consumer`, `brand_partner`, `admin`.

## Repo layout

Bun workspaces monorepo:

- `apps/web` — TanStack Start (SSR) frontend. React 19 + TanStack Router (file-based) + TanStack Query, Vite 8, Tailwind v4, shadcn/ui (new-york style). Path alias `@/*` → `apps/web/src/*`.
- `apps/api` — Hono API. `routes → services → repositories(Drizzle)`. Owns roles/authorization and all business logic that used to live in Postgres triggers.
- `packages/shared` — `@perkhub/shared`: enum unions and TypeScript type interfaces shared by both apps (mirrors the Drizzle schema).

## Commands

Package manager is **Bun** (`bun.lock`, `bunfig.toml`).

- `bun install` — install all workspace dependencies (run from repo root)
- `bun run dev:web` / `bun run dev:api` — start the frontend / API dev server
- `bun run build:web` / `bun run build:api` — production builds
- `bun run db:generate` / `bun run db:migrate` — Drizzle migrations (`apps/api`)
- `bun run test` — API vitest suite
- `bun run lint` — ESLint over `apps/web`

`bunfig.toml` enforces a 24h supply-chain guard (`minimumReleaseAge`) — new packages published <24h ago are skipped. Confirm with the user before adding any package to `minimumReleaseAgeExcludes`.

## Architecture

### Auth: Clerk owns identity, the API owns authorization

Clerk (`@clerk/tanstack-react-start` in the frontend, `@clerk/backend` in the API) handles sign-in/sign-up/session. There is no RLS — every authorization decision (role checks, ownership checks) happens in Hono middleware/route handlers against Postgres via Drizzle.

- `apps/web/src/routes/__root.tsx` mounts `<ClerkProvider>`. Route guards (`_authenticated.tsx`, `_authenticated.admin.tsx`) check the imperative `window.Clerk` global in `beforeLoad` (these routes are `ssr: false`, so the check runs client-side).
- `apps/web/src/lib/api-client.ts` attaches the current Clerk session token as `Authorization: Bearer <token>` to every API request.
- `apps/api/src/middleware/auth.ts` — `requireAuth` verifies the Clerk session via `@clerk/backend`; `requireRole(...roles)` additionally checks `user_roles` in Postgres.
- New users are provisioned via the Clerk webhook (`POST /api/auth/clerk-webhook`, `apps/api/src/services/auth.service.ts`): creates a `profiles` row and a default `consumer` role, reading `unsafe_metadata.intended_role` (client-settable) to also grant `brand_partner` on signup.

### API (`apps/api`)

- `src/db/schema.ts` — Drizzle `pgTable` definitions, 1:1 with the tables the old Supabase schema had (`profiles`, `user_roles`, `affiliation_groups`, `group_whitelist`, `user_memberships`, `brands`, `deals`, `saved_deals`, `transactions`, `commission_invoices`). UUID primary keys throughout; `updatedAt` is always set to `new Date()` on repository `update()` calls.
- `src/repositories/*.repo.ts` — plain CRUD functions taking `db` as the first argument. No business logic here.
- `src/services/*.service.ts` — business logic that used to be Postgres triggers: `membership.service.ts` ports the auto-verify-by-email-domain/whitelist logic and expiry stamping; `transaction.service.ts` computes commission; `storage.service.ts` issues R2 presigned URLs.
- `src/routes/*.ts` — feature-based RESTful routes, mounted under `/api/*` in `src/index.ts`. CORS is enabled for `/api/*`.
- Object storage is Cloudflare R2 (S3-compatible SDK) — uploads and downloads go through presigned URLs from `POST /api/storage/presign-upload` / `GET /api/storage/presign-download`, never through the API server directly.

### Routing (`apps/web/src/routes/`)

File-based — every `.tsx` is a route; read `apps/web/src/routes/README.md` for the naming table (dynamic `$id`, splat `$`, optional `{-$x}`, layout `_layout`). `routeTree.gen.ts` is **auto-generated — never edit by hand**, it regenerates on `vite dev`/`vite build`. `__root.tsx` is the only app shell.

- `_authenticated.tsx` — auth gate layout (`ssr: false`); `beforeLoad` checks the Clerk session and redirects to `/auth` with a `redirect` search param.
- Route segments are dot-delimited: `_authenticated.app.*` (consumer), `_authenticated.brand.*` (brand partner), `_authenticated.admin.*` (admin).
- After sign-in, `homePathFor(role)` (`apps/web/src/hooks/use-auth.tsx`) routes users to `/app`, `/brand`, or `/admin`.

### Roles & data model

Roles live in a **separate `user_roles` table** (never a column on `profiles`), enforced in the API rather than in the database. `useRoles`/`primaryRole` (`apps/web/src/hooks/use-auth.tsx`) resolve the effective role client-side via `GET /api/roles/me`.

**Verification auto-approval is service-driven, not trigger-driven.** `POST /api/memberships` inserts with `status='pending'`, then `membership.service.ts`'s `createAndAutoVerify` auto-verifies when the user's email domain matches the group's `email_domains` or the membership number is in `group_whitelist`. Otherwise admins review manually in `_authenticated.admin.verifications.tsx` via `PATCH /api/memberships/:id`. `stampExpiryOnVerification` sets `verifiedAt`/`expiresAt` from the group's `badgeValidityMonths` on transition to `verified`.

Core tables: `affiliation_groups`, `group_whitelist`, `user_memberships`, `brands`, `deals`, `saved_deals`, `transactions` (redemptions + commission), `commission_invoices`. Schema and migrations live in `apps/api/drizzle/` (generated from `apps/api/src/db/schema.ts`).

### SSR error handling

`apps/web/src/start.ts` and `apps/web/src/server.ts` wrap the SSR pipeline to catch/normalize errors (including h3-swallowed 500s) and render a fallback page via `apps/web/src/lib/error-page.ts` + `error-capture.ts`. Leave this plumbing intact.

### Legacy

`supabase/migrations/` is kept as historical reference for the schema this migration replaced — it no longer runs against anything. Do not add new migrations there; use `apps/api/drizzle/` instead.

## Lovable sync

This repo is connected to Lovable. **Never rewrite published git history** (no force-push, rebase, amend, or squash of pushed commits) — it corrupts Lovable's history and the user loses project history. Commits pushed to the connected branch sync into the Lovable editor, so keep the branch in a working state.
