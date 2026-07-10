# PerkHub Backend Migration Design Document

**Date:** 2026-07-03  
**Status:** Draft for Review

---

## 1. Executive Summary

Replace the Supabase/Lovable backend with a standalone **Hono + Drizzle TypeScript API** running on **Bun**, migrate the existing TanStack Start frontend into a **Bun-workspace monorepo** (`apps/web`, `apps/api`, `packages/shared`), and re-wire authentication to **Clerk** — while preserving 100% of existing product behavior.

---

## 2. Current State Analysis

### 2.1 Existing Tech Stack
- **Frontend:** TanStack Start + React Router + React Query + Vite
- **Auth:** Supabase Auth + Lovable cloud auth
- **Database:** Supabase Postgres (with RLS policies)
- **Storage:** Supabase Storage
- **Business Logic:** Postgres triggers/functions (RLS, auto-verify membership, stamp expiry, handle_new_user)

### 2.2 Database Schema (from Supabase migrations)
**Enums (12):** `app_role`, `affiliation_type`, `verification_method`, `membership_status`, `brand_status`, `deal_status`, `discount_type`, `deal_channel`, `commission_type`, `transaction_status`, `commission_status`, `invoice_status`

**Tables (10):**
1. `profiles` - User profile data (linked to auth.users)
2. `user_roles` - User roles (consumer, brand_partner, admin)
3. `affiliation_groups` - Groups (NYSC, alumni, professional, etc.)
4. `group_whitelist` - Admin-uploaded membership numbers
5. `user_memberships` - User membership applications
6. `brands` - Brand partners
7. `deals` - Deals/offers from brands
8. `saved_deals` - User-saved deals
9. `transactions` - Redemptions/commercial transactions
10. `commission_invoices` - Brand commission invoices

**Triggers/Functions (5):**
- `tg_set_updated_at` - Auto-updates updated_at timestamp
- `handle_new_user` - Auto-creates profile + consumer role on signup
- `tg_auto_verify_membership` - Auto-verifies membership (email domain/whitelist)
- `tg_stamp_membership_expiry` - Stamps expiry on admin verification
- `has_role` - Role checking function (moved to `private` schema)

---

## 3. Target Architecture

### 3.1 Monorepo Structure
```
group-perk-hub/
├── apps/
│   ├── web/                 # Existing TanStack Start frontend
│   │   ├── src/
│   │   ├── package.json
│   │   └── ...
│   └── api/                 # New Hono + Drizzle API
│       ├── src/
│       │   ├── routes/      # Feature-based REST routes
│       │   ├── services/    # Business logic (ported from triggers)
│ │   │   ├── repositories/  # Drizzle data access
│       │   ├── middleware/  # Auth, validation, error handling
│       │   ├── schemas/     # Zod validation schemas
│       │   ├── db/          # Drizzle config, schema, migrations
│       │   └── index.ts     # Hono app entry
│       ├── package.json
│       ├── drizzle.config.ts
│       └── ...
├── packages/
│   └── shared/              # Shared types, Zod schemas, constants
│       ├── src/
│       │   ├── types/       # Shared TypeScript types
│       │   ├── schemas/     # Shared Zod schemas
│       │   ├── enums/       # Shared enums (from Supabase)
│       │   └── constants/   # Shared constants
│       └── package.json
├── package.json             # Root workspace config
├── turbo.json               # Turborepo config (optional)
└── README.md
```

### 3.2 API Layer Architecture
```
routes/                    # HTTP layer (Hono)
  ├─ auth/                 # Clerk webhook, session verification
  ├─ profiles/             # Profile CRUD
  ├─ roles/                # User roles management
  ├─ groups/               # Affiliation groups
  ├─ memberships/          # User memberships
  ├─ brands/               # Brand CRUD + commission
  ├─ deals/                # Deal CRUD + filtering
  ├─ saved-deals/          # Saved deals
  ├─ transactions/         # Redemptions + commission calc
  ├─ invoices/             # Commission invoices
  ├─ admin/                # Admin-only endpoints
  └─ storage/              # Presigned URLs for R2
      ↓
services/                  # Business logic (ports triggers)
  ├─ auth.service.ts       # Clerk webhook handling, user sync
  ├─ membership.service.ts # Auto-verify, expiry stamping
  ├─ transaction.service.ts# Commission calc, redemption
  ├─ brand.service.ts      # Brand approval, commission
  ├─ invoice.service.ts    # Invoice generation
  └─ storage.service.ts    # R2 presigned URLs
      ↓
repositories/              # Data access (Drizzle)
  ├─ profiles.repo.ts
  ├─ userRoles.repo.ts
  ├─ groups.repo.ts
  ├─ whitelist.repo.ts
  ├─ memberships.repo.ts
  ├─ brands.repo.ts
  ├─ deals.repo.ts
  ├─ savedDeals.repo.ts
  ├─ transactions.repo.ts
  └─ invoices.repo.ts
```

---

## 4. Authentication & Authorization

### 4.1 Clerk Integration
- **Clerk owns identity** — signup, login, MFA, password reset, sessions
- **Webhook sync:** Clerk → API via `/api/auth/clerk-webhook` (svix verified)
  - `user.created` → Create profile + default `consumer` role
  - `user.updated` → Sync profile fields
  - `user.deleted` → Soft delete / cascade
- **Session verification:** `@clerk/backend` `auth()` middleware on protected routes
- **Frontend:** `@clerk/tanstack-react-start` for TanStack Start integration

### 4.2 Authorization Model (replaces RLS)
| Resource | Owner | Admin | Public (anon) |
|----------|-------|-------|---------------|
| profiles | CRUD own | CRUD all | — |
| user_roles | Read own | CRUD all | — |
| affiliation_groups | — | CRUD all | Read active |
| group_whitelist | — | CRUD all | — |
| user_memberships | CRUD own | Update status | — |
| brands | CRUD own | CRUD all | Read approved |
| deals | CRUD own | CRUD all | Read published |
| saved_deals | CRUD own | — | — |
| transactions | Read own/brand | CRUD all | — |
| commission_invoices | Read own brand | CRUD all | — |

**Implementation:** Middleware `requireAuth()`, `requireRole()`, `requireOwnership()` in `middleware/auth.ts`

---

## 5. Database Migration (1:1 Schema Mapping)

### 5.1 Drizzle Schema (`packages/shared/src/db/schema/`)
- Map all 12 enums → `pgEnum`
- Map all 10 tables → `pgTable` with proper FKs
- Remove RLS policies (handled in API layer)
- Keep `updated_at` trigger logic in repository `update()` methods
- UUIDs via `genRandomUuid()` (pgcrypto) or `crypto.randomUUID()` (app-side)

### 5.2 Migrations
- Use `drizzle-kit` for migration generation
- Initial migration: recreate Supabase schema 1:1
- Future migrations: generated from Drizzle schema changes

---

## 6. Business Logic Port (Triggers → Services)

| Supabase Trigger | New Service Method | Trigger Point |
|------------------|-------------------|---------------|
| `handle_new_user` | `authService.syncUserFromClerk(clerkUser)` | Clerk webhook `user.created` |
| `tg_auto_verify_membership` | `membershipService.autoVerify(membership)` | `POST /memberships` (create) |
| `tg_stamp_membership_expiry` | `membershipService.stampExpiry(membership)` | `PATCH /memberships/:id` (status→verified) |
| `tg_set_updated_at` | `repo.update({... updatedAt: new Date()})` | All repository `update()` |
| Commission calc | `transactionService.calculateCommission()` | `POST /transactions` |

### 6.1 Membership Auto-Verification Logic
```typescript
// Ported from tg_auto_verify_membership
async function autoVerify(membership: NewMembership, group: Group) {
  let matched = false;
  
  if (membership.method === 'email_domain' && group.emailDomains.length > 0) {
    const user = await clerkClient.users.getUser(membership.userId);
    const domain = user.emailAddresses[0]?.emailAddress.split('@')[1]?.toLowerCase();
    matched = group.emailDomains.map(d => d.toLowerCase()).includes(domain);
  }
  
  if (!matched && membership.method === 'membership_number' && membership.membershipNumber) {
    matched = await whitelistRepo.exists(group.id, membership.membershipNumber);
  }
  
  if (matched) {
    membership.status = 'verified';
    membership.verifiedAt = new Date();
    membership.expiresAt = addMonths(new Date(), group.badgeValidityMonths);
  }
  return membership;
}
```

### 6.2 Commission Calculation
```typescript
// Ported from transaction insert logic
function calculateCommission(deal: Deal, brand: Brand, finalPrice: number) {
  if (brand.commissionType === 'percent') {
    return (finalPrice * brand.commissionRate) / 100;
  }
  return brand.commissionRate; // flat
}
```

---

## 7. Object Storage (Cloudflare R2)

### 7.1 Buckets
| Bucket | Purpose | Access |
|--------|---------|--------|
| `membership-docs` | User ID uploads | Private (presigned GET/PUT) |
| `brand-assets` | Brand logos, deal images | Public read, private write |
| `deal-images` | Deal images | Public read, private write |

### 7.2 Presigned URL Endpoints
- `POST /api/storage/presign-upload` → `{ uploadUrl, key, expiresAt }`
- `GET /api/storage/presign-download?key=` → `{ downloadUrl, expiresAt }`
- Key format: `{bucket}/{userId}/{uuid}.{ext}`

---

## 8. API Route Design (RESTful, Feature-Based)

| Feature | Routes |
|---------|--------|
| **Auth** | `POST /auth/clerk-webhook`, `GET /auth/me` |
| **Profiles** | `GET /profiles/me`, `PATCH /profiles/me`, `GET /profiles/:id` (admin) |
| **Roles** | `GET /roles/me`, `POST /roles` (admin), `DELETE /roles/:id` (admin) |
| **Groups** | `GET /groups`, `GET /groups/:id`, `POST /groups` (admin), `PATCH /groups/:id` (admin), `DELETE /groups/:id` (admin) |
| **Whitelist** | `GET /groups/:id/whitelist`, `POST /groups/:id/whitelist` (admin), `DELETE /groups/:id/whitelist/:id` (admin) |
| **Memberships** | `GET /memberships`, `POST /memberships`, `GET /memberships/:id`, `PATCH /memberships/:id` (admin: status) |
| **Brands** | `GET /brands`, `GET /brands/:id`, `POST /brands`, `PATCH /brands/:id`, `DELETE /brands/:id` |
| **Deals** | `GET /deals`, `GET /deals/:id`, `POST /deals`, `PATCH /deals/:id`, `DELETE /deals/:id` |
| **Saved Deals** | `GET /saved-deals`, `POST /saved-deals`, `DELETE /saved-deals/:dealId` |
| **Transactions** | `GET /transactions`, `POST /transactions` (redeem), `GET /transactions/:id` |
| **Invoices** | `GET /invoices`, `GET /invoices/:id`, `POST /invoices` (admin), `PATCH /invoices/:id` (admin) |
| **Admin** | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id/role` |
| **Storage** | `POST /storage/presign-upload`, `GET /storage/presign-download` |

---

## 9. Frontend Migration (apps/web)

### 9.1 Changes Required
1. **Replace Supabase client** → TanStack Query + API client (fetch/Hono client)
2. **Replace `@lovable.dev/cloud-auth-js` + Supabase auth** → `@clerk/tanstack-react-start`
3. **Update auth hook** (`useAuth`) → Clerk's `useAuth()` + `useUser()`
4. **Update API calls** → Point to `/api/*` (same-origin) or `VITE_API_URL`
5. **Remove Supabase dependencies** from package.json
6. **Environment variables** → `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`

### 9.2 Shared Package (`packages/shared`)
- Zod schemas for all API request/response bodies
- TypeScript types mirroring Drizzle schema
- Shared enums (from Supabase enums)
- API client factory (Hono RPC client or fetch wrapper)

---

## 10. Deployment (Railway)

### 10.1 Services
| Service | Purpose |
|---------|---------|
| **Railway Postgres** | Primary database |
| **Railway Service (API)** | Hono app (Bun) |
| **Cloudflare R2** | Object storage (S3-compatible) |
| **Clerk** | Auth (external) |

### 10.2 Environment Variables (API)
```env
# Database
DATABASE_URL=postgresql://...

# Clerk
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# R2 / S3
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_MEMBERSHIP_DOCS=membership-docs
R2_BUCKET_BRAND_ASSETS=brand-assets
R2_BUCKET_DEAL_IMAGES=deal-images
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# App
NODE_ENV=production
API_PORT=3000
```

### 10.3 Environment Variables (Web)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=https://api.perkhub.example.com
```

---

## 11. Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| **Unit (services)** | Vitest | 80%+ |
| **Integration (repos)** | Vitest + Testcontainers (Postgres) | 70%+ |
| **E2E (API)** | Vitest + Hono test client | Critical paths |
| **Frontend** | Vitest + Playwright | Critical user flows |

### 11.1 Key Test Scenarios
- Clerk webhook → user sync → profile + role created
- Membership create → auto-verify (email domain / whitelist)
- Admin verifies membership → expiry stamped
- Transaction create → commission calculated + stored
- Brand deal create → commission rate applied
- Presigned URL generation → valid for R2 upload/download

---

## 12. Migration Sequence

1. **Phase 1:** Create monorepo structure, shared package, Drizzle schema
2. **Phase 2:** Implement API (repos → services → routes) with tests
3. **Phase 3:** Clerk webhook + auth middleware
4. **Phase 4:** Storage service (R2 presigned URLs)
5. **Phase 5:** Migrate frontend to apps/web, wire to API
6. **Phase 6:** Deploy to Railway, smoke test
7. **Phase 7:** Cutover DNS, deprecate Supabase

---

## 13. Open Questions for Review

1. **Railway vs. Fly.io vs. Render?** — Railway chosen per requirements; confirm.
2. **R2 vs. Supabase Storage?** — R2 chosen for cost/performance; confirm.
3. **Rate limiting?** — Add `@hono/rate-limiter` in Phase 2?
4. **API versioning?** — `/api/v1/` prefix from start?
5. **Webhook retries?** — Clerk retries; idempotency keys on webhook handler?
6. **Soft deletes?** — Keep Supabase `ON DELETE CASCADE/SET NULL` behavior in Drizzle?
7. **Seed data?** — Port affiliation group seeds to Drizzle seed script?

---

## 14. Approval

**Please review this design and confirm:**
- [ ] Architecture approach
- [ ] 1:1 schema mapping
- [ ] Auth/authorization model
- [ ] Business logic port strategy
- [ ] Storage approach (R2)
- [ ] API route structure
- [ ] Deployment target (Railway + R2)
- [ ] Testing strategy

Once approved, I'll create the implementation plan using the `writing-plans` skill.