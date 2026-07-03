# PerkHub

Verified membership, real perks. PerkHub lets Nigerians verify their affiliation once — NYSC corps members, university alumni, ICAN/NBA and other professional bodies, cooperatives, corporate staff associations, unions — and unlock exclusive discounts from partner brands. Brands reach a verified audience and pay commission only per verified redemption.

## How it works

1. **Prove your tribe** — verify via ID upload, official email domain, or membership number. Auto-verified where possible, manual review otherwise.
2. **Unlock deals** — browse offers filtered to the groups you belong to.
3. **Redeem** — show your digital badge or claim a unique code; every redemption is tracked.

There are three roles: **consumer** (member), **brand_partner** (business listing deals), and **admin** (reviews verifications and brands).

## Tech stack

- [TanStack Start](https://tanstack.com/start) (SSR) + [TanStack Router](https://tanstack.com/router) (file-based routing) + [TanStack Query](https://tanstack.com/query)
- React 19, Vite 8, TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (new-york style)
- [Supabase](https://supabase.com) (Postgres, Auth, Storage, RLS) via Lovable Cloud
- Deployed on Cloudflare (Nitro build target)

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun install
bun dev
```

The app runs on the Vite dev server. Environment variables (Supabase URL and keys) are provided via Lovable Cloud — see `.env`. Required variables:

| Variable | Used by |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase project URL (client / server) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Anon key (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (bypasses RLS) |

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Start the dev server |
| `bun run build` | Production build |
| `bun run build:dev` | Development-mode build |
| `bun run preview` | Preview a build |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

## Project structure

```
src/
  routes/                  File-based routes (see routes/README.md)
  components/ui/           shadcn/ui primitives
  components/perk/         App-specific components
  hooks/                   use-auth, use-mobile
  integrations/supabase/   Browser, admin, and middleware clients (auto-generated)
  lib/                     Utils and SSR error handling
supabase/
  migrations/              Database schema + RLS policies
```

## Database

Postgres via Supabase with row-level security on every table. Roles live in a dedicated `user_roles` table and are enforced through the `has_role()` function. Membership verification is trigger-driven: submissions auto-verify on email-domain or whitelist match, otherwise fall to admin review. Core tables include `affiliation_groups`, `user_memberships`, `brands`, `deals`, `transactions`, and `commission_invoices`. See `supabase/migrations/`.

## Note

This project is connected to [Lovable](https://lovable.dev). Commits pushed to the connected branch sync into the Lovable editor, so keep the branch in a working state and avoid rewriting published git history.
