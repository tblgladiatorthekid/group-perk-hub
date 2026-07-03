# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PerkHub — a Nigerian membership-perks platform. Members verify their affiliation (NYSC, alumni bodies, professional associations, cooperatives, corporate staff, etc.) once, then unlock discounts from partner brands who pay commission per verified redemption. Three roles drive everything: `consumer`, `brand_partner`, `admin`.

## Commands

Package manager is **Bun** (`bun.lock`, `bunfig.toml`). A `package-lock.json` also exists but prefer Bun.

- `bun dev` — start the dev server (`vite dev`)
- `bun run build` — production build (Vite → Nitro, Cloudflare target)
- `bun run build:dev` — development-mode build
- `bun run preview` — preview a build
- `bun run lint` — ESLint over the repo
- `bun run format` — Prettier write (100 col, semicolons, double quotes, trailing commas)

There is no test runner configured.

`bunfig.toml` enforces a 24h supply-chain guard (`minimumReleaseAge`) — new packages published <24h ago are skipped. Confirm with the user before adding any package to `minimumReleaseAgeExcludes`.

## Architecture

**Stack:** TanStack Start (SSR) + React 19 + TanStack Router (file-based) + TanStack Query, Vite 8, Tailwind v4, shadcn/ui (new-york style), Supabase (via Lovable Cloud). Path alias `@/*` → `src/*`.

**Vite config is minimal by design.** `@lovable.dev/vite-tanstack-config` already bundles tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro, the `@` alias, env injection, and dev plugins. Do **not** re-add these plugins in `vite.config.ts` or the app breaks with duplicates.

### Routing (`src/routes/`)

File-based — every `.tsx` is a route; read `src/routes/README.md` for the naming table (dynamic `$id`, splat `$`, optional `{-$x}`, layout `_layout`). `routeTree.gen.ts` is **auto-generated — never edit by hand**. `__root.tsx` is the only app shell.

- `_authenticated.tsx` — auth gate layout (`ssr: false`); `beforeLoad` checks `supabase.auth.getUser()` and redirects to `/auth` with a `redirect` search param.
- Route segments are dot-delimited: `_authenticated.app.*` (consumer), `_authenticated.brand.*` (brand partner), `_authenticated.admin.*` (admin).
- After sign-in, `homePathFor(role)` (`src/hooks/use-auth.tsx`) routes users to `/app`, `/brand`, or `/admin`.

### Supabase clients (`src/integrations/supabase/`) — three distinct clients, don't mix them

- `client.ts` — **browser client**, anon/publishable key, subject to RLS. Import as `import { supabase } from "@/integrations/supabase/client"`. Use for all user-facing queries.
- `client.server.ts` — **admin client**, service-role key, **bypasses RLS**. Only for trusted server code. Lazy-import inside a server handler: `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`. A top-level import is only safe from other `*.server.ts` modules — route files and `*.functions.ts` ship to the client bundle.
- `auth-middleware.ts` — `requireSupabaseAuth`, a TanStack server-function middleware that validates the Bearer token and yields an RLS-scoped `supabase` client plus `userId`/`claims` in context. Use this for authenticated server functions rather than the admin client.

`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, and `types.ts` are **auto-generated** (headers say so) — avoid hand-edits; regeneration will clobber them.

### Roles & data model

Roles live in a **separate `user_roles` table** (never a column on `profiles`). The `handle_new_user` trigger auto-creates a `profiles` row + a default `consumer` role on signup, reading `raw_user_meta_data.intended_role` to grant `brand_partner`. Role checks in SQL use the `has_role(uid, role)` SECURITY DEFINER function; every table is RLS-enabled and policies lean on it. On the client, `useRoles`/`primaryRole` (`src/hooks/use-auth.tsx`) resolve the effective role.

**Verification is trigger-driven, not app-driven.** Membership submissions (`user_memberships`) insert with `status='pending'`; a `BEFORE INSERT` trigger (`tg_auto_verify_membership`) auto-verifies when the user's email domain matches the group's `email_domains` or the membership number is in `group_whitelist`. Otherwise admins review manually in `_authenticated.admin.verifications.tsx`. A second trigger stamps `verified_at`/`expires_at` from the group's `badge_validity_months` on transition to `verified`.

Core tables: `affiliation_groups`, `group_whitelist`, `user_memberships`, `brands`, `deals`, `saved_deals`, `transactions` (redemptions + commission), `commission_invoices`. Schema and RLS policies live in `supabase/migrations/`.

### SSR error handling

`src/start.ts` and `src/server.ts` wrap the SSR pipeline to catch/normalize errors (including h3-swallowed 500s) and render a fallback page via `src/lib/error-page.ts` + `error-capture.ts`. Leave this plumbing intact.

## Lovable sync

This repo is connected to Lovable. **Never rewrite published git history** (no force-push, rebase, amend, or squash of pushed commits) — it corrupts Lovable's history and the user loses project history. Commits pushed to the connected branch sync into the Lovable editor, so keep the branch in a working state.
