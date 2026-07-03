# PerkHub Backend Re-architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Supabase/Lovable backend with a standalone Hono + Drizzle TypeScript API, move the frontend into a Bun-workspace monorepo, and re-wire auth to Clerk — preserving all existing product behavior.

**Architecture:** Bun-workspace monorepo (`apps/web`, `apps/api`, `packages/shared`). The Hono API is layered `routes → services → repositories(Drizzle)`. Clerk owns identity; roles and per-resource authorization live in the API (replacing Postgres RLS). Business logic that lived in Postgres triggers moves into tested services. Deploys to Railway (API + Postgres + object storage).

**Tech Stack:** Bun workspaces, Hono + @hono/node-server, Drizzle ORM + node-postgres, drizzle-kit, Zod, Clerk (@clerk/backend, @clerk/tanstack-react-start), svix (webhook verification), @aws-sdk/client-s3 + s3-request-presigner, Vitest, TanStack Start/Router/Query (existing).

## Global Constraints

- Package manager is **Bun**. Never introduce `npm install`; use `bun add` / `bun install`.
- `bunfig.toml` supply-chain guard (`minimumReleaseAge = 86400`) stays. New packages published <24h ago are blocked; do not edit `minimumReleaseAgeExcludes` without explicit user approval.
- **No Supabase.** Remove every `@supabase/*` dependency and `src/integrations/supabase/*` file by the end of Phase 6. No `SUPABASE_*` env vars remain.
- Prettier config is authoritative: 100 col, semicolons, double quotes, trailing commas.
- Path alias in the frontend stays `@/*` → `apps/web/src/*`.
- Roles are `consumer | brand_partner | admin`, stored in the app DB, never on the identity provider.
- Every former RLS policy and every former Postgres trigger must be reproduced in TS with at least one test.
- Commit after every green step. Commit messages use Conventional Commits (`feat:`, `chore:`, `test:`, `refactor:`).
- Do not commit secrets. All keys come from env vars.

---

## Phase 0 — Monorepo restructure

Leaves the repo building and running exactly as before, just under `apps/web`.

### Task 0.1: Move frontend into `apps/web`

**Files:**
- Move: repo-root frontend files → `apps/web/`
- Create: root `package.json` (workspace root), `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`, `apps/web/vite.config.ts`

**Interfaces:**
- Produces: workspace root with `apps/*` + `packages/*` globs; the web app runnable via `bun --filter web dev`.

- [ ] **Step 1: Create the folder and move frontend files**

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv public apps/web/public
git mv index.html apps/web/index.html 2>/dev/null || true
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv components.json apps/web/components.json
git mv eslint.config.js apps/web/eslint.config.js
git mv .prettierrc apps/web/.prettierrc
git mv .prettierignore apps/web/.prettierignore
```

- [ ] **Step 2: Create the workspace root `package.json`**

Replace the root `package.json` with a workspace root (move the app's deps into `apps/web` in the next step):

```json
{
  "name": "perkhub",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "bun --filter web dev",
    "dev:api": "bun --filter api dev",
    "lint": "bun --filter '*' lint",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 3: Create `apps/web/package.json`**

Move the current dependency block here (name it `web`). Keep every dependency currently in the root `package.json` dependencies/devDependencies. Scripts:

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": { "__": "copy from old root package.json dependencies" },
  "devDependencies": { "__": "copy from old root package.json devDependencies" }
}
```

- [ ] **Step 4: Install and verify the web app still builds**

Run: `bun install && bun --filter web build`
Expected: build succeeds, `.output`/`dist` produced under `apps/web`.

- [ ] **Step 5: Verify dev server boots**

Run: `bun --filter web dev` (start, confirm it serves, stop)
Expected: dev server starts without missing-path errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: move frontend into apps/web workspace"
```

### Task 0.2: Create `packages/shared`

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/enums.ts`

**Interfaces:**
- Produces: `@perkhub/shared` exporting shared enums used by both apps. Exact enum values below.

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@perkhub/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^3.24.2" }
}
```

- [ ] **Step 2: Create `packages/shared/src/enums.ts`** (verbatim values from the existing DB enums)

```ts
export const APP_ROLES = ["consumer", "brand_partner", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const AFFILIATION_TYPES = ["cooperative", "alumni", "professional", "nysc", "corporate", "religious", "union", "other"] as const;
export const VERIFICATION_METHODS = ["id_upload", "email_domain", "membership_number"] as const;
export const MEMBERSHIP_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export const BRAND_STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
export const DEAL_STATUSES = ["draft", "pending_review", "published", "rejected", "expired"] as const;
export const DISCOUNT_TYPES = ["percent", "fixed", "bogo", "free_item"] as const;
export const DEAL_CHANNELS = ["online", "instore", "both"] as const;
export const COMMISSION_TYPES = ["percent", "flat"] as const;
export const TRANSACTION_STATUSES = ["redeemed", "expired", "cancelled", "disputed"] as const;
export const COMMISSION_STATUSES = ["pending", "invoiced", "paid"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
```

- [ ] **Step 3: Create `packages/shared/src/index.ts`**

```ts
export * from "./enums";
```

- [ ] **Step 4: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "types": [],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Install and typecheck**

Run: `bun install && bun --filter @perkhub/shared exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add @perkhub/shared package with domain enums"
```

---

## Phase 1 — API skeleton

### Task 1.1: Scaffold the Hono API with a health check and test harness

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/lib/config.ts`, `apps/api/test/health.test.ts`

**Interfaces:**
- Produces: `createApp(): Hono` (test-importable, no listener side effects) and `config` (validated env). Health route `GET /health` → `200 {"status":"ok"}`.

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "lint": "eslint ."
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "@perkhub/shared": "*",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `apps/api/src/lib/config.ts`** (fail-fast env validation)

```ts
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const config = schema.parse(process.env);
```

- [ ] **Step 3: Write the failing test `apps/api/test/health.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `bun --filter api test`
Expected: FAIL — cannot import `../src/app`.

- [ ] **Step 5: Create `apps/api/src/app.ts`**

```ts
import { Hono } from "hono";

export function createApp(): Hono {
  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}
```

- [ ] **Step 6: Create `apps/api/src/index.ts`** (listener entrypoint, not imported by tests)

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { config } from "./lib/config";

serve({ fetch: createApp().fetch, port: config.PORT }, (info) => {
  console.log(`API listening on :${info.port}`);
});
```

- [ ] **Step 7: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 8: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `bun install && bun --filter api test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: scaffold Hono API with health check"
```

---

## Phase 2 — Data model (Drizzle schema + migrations)

Provision a local/dev Postgres first (via Railway plugin or a local container) and put its URL in `apps/api/.env` as `DATABASE_URL`. Do not commit `.env`.

### Task 2.1: Add Drizzle, DB client, and enum definitions

**Files:**
- Create: `apps/api/drizzle.config.ts`, `apps/api/src/db/client.ts`, `apps/api/src/db/schema/enums.ts`
- Modify: `apps/api/src/lib/config.ts` (add `DATABASE_URL`)

**Interfaces:**
- Produces: `db` (Drizzle client), and pgEnum objects (`appRoleEnum`, etc.) consumed by table definitions in later tasks.

- [ ] **Step 1: Add dependencies**

```bash
bun add --cwd apps/api drizzle-orm pg
bun add --cwd apps/api -d drizzle-kit @types/pg
```

- [ ] **Step 2: Extend config with `DATABASE_URL`**

In `apps/api/src/lib/config.ts` add to the schema object: `DATABASE_URL: z.string().url(),`

- [ ] **Step 3: Create `apps/api/src/db/schema/enums.ts`**

```ts
import { pgEnum } from "drizzle-orm/pg-core";
import {
  APP_ROLES, AFFILIATION_TYPES, VERIFICATION_METHODS, MEMBERSHIP_STATUSES,
  BRAND_STATUSES, DEAL_STATUSES, DISCOUNT_TYPES, DEAL_CHANNELS,
  COMMISSION_TYPES, TRANSACTION_STATUSES, COMMISSION_STATUSES, INVOICE_STATUSES,
} from "@perkhub/shared";

export const appRoleEnum = pgEnum("app_role", APP_ROLES);
export const affiliationTypeEnum = pgEnum("affiliation_type", AFFILIATION_TYPES);
export const verificationMethodEnum = pgEnum("verification_method", VERIFICATION_METHODS);
export const membershipStatusEnum = pgEnum("membership_status", MEMBERSHIP_STATUSES);
export const brandStatusEnum = pgEnum("brand_status", BRAND_STATUSES);
export const dealStatusEnum = pgEnum("deal_status", DEAL_STATUSES);
export const discountTypeEnum = pgEnum("discount_type", DISCOUNT_TYPES);
export const dealChannelEnum = pgEnum("deal_channel", DEAL_CHANNELS);
export const commissionTypeEnum = pgEnum("commission_type", COMMISSION_TYPES);
export const transactionStatusEnum = pgEnum("transaction_status", TRANSACTION_STATUSES);
export const commissionStatusEnum = pgEnum("commission_status", COMMISSION_STATUSES);
export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);
```

- [ ] **Step 4: Create `apps/api/src/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../lib/config";
import * as schema from "./schema";

export const pool = new Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 5: Create `apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 6: Commit** (schema index created in the next task; commit config + enums)

```bash
git add -A && git commit -m "feat: add Drizzle client and pg enums"
```

### Task 2.2: Define all tables and generate the initial migration

**Files:**
- Create: `apps/api/src/db/schema/tables.ts`, `apps/api/src/db/schema/index.ts`
- Create (generated): `apps/api/src/db/migrations/0000_*.sql`

**Interfaces:**
- Produces: table objects `users, userRoles, affiliationGroups, groupWhitelist, userMemberships, brands, deals, savedDeals, transactions, commissionInvoices`. `users` has `id` (uuid PK) + unique `clerkUserId`. All user FKs reference `users.id`.

- [ ] **Step 1: Create `apps/api/src/db/schema/tables.ts`** (ports the Supabase schema; `users` replaces `profiles`/`auth.users`)

```ts
import {
  pgTable, uuid, text, boolean, integer, timestamp, numeric, date, primaryKey, unique, index,
} from "drizzle-orm/pg-core";
import {
  appRoleEnum, affiliationTypeEnum, verificationMethodEnum, membershipStatusEnum,
  brandStatusEnum, dealStatusEnum, discountTypeEnum, dealChannelEnum,
  commissionTypeEnum, transactionStatusEnum, commissionStatusEnum, invoiceStatusEnum,
} from "./enums";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  phone: text("phone"),
  state: text("state"),
  lga: text("lga"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: appRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.userId, t.role) }));

export const affiliationGroups = pgTable("affiliation_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: affiliationTypeEnum("type").notNull(),
  description: text("description"),
  verificationMethods: verificationMethodEnum("verification_methods").array().notNull().default(["id_upload"]),
  emailDomains: text("email_domains").array().notNull().default([]),
  badgeValidityMonths: integer("badge_validity_months").notNull().default(12),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupWhitelist = pgTable("group_whitelist", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => affiliationGroups.id, { onDelete: "cascade" }),
  membershipNumber: text("membership_number").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.groupId, t.membershipNumber) }));

export const userMemberships = pgTable("user_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => affiliationGroups.id, { onDelete: "restrict" }),
  method: verificationMethodEnum("method").notNull(),
  membershipNumber: text("membership_number"),
  idDocumentUrl: text("id_document_url"),
  submittedEmail: text("submitted_email"),
  status: membershipStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byUser: index().on(t.userId), byStatus: index().on(t.status) }));

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  cacNumber: text("cac_number"),
  category: text("category").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  website: text("website"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  status: brandStatusEnum("status").notNull().default("pending"),
  commissionType: commissionTypeEnum("commission_type").notNull().default("percent"),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("10.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug"),
  description: text("description").notNull(),
  terms: text("terms"),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),
  targetGroupIds: uuid("target_group_ids").array().notNull().default([]),
  channel: dealChannelEnum("channel").notNull().default("both"),
  redemptionUrl: text("redemption_url"),
  imageUrl: text("image_url"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  totalCap: integer("total_cap"),
  status: dealStatusEnum("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byStatus: index().on(t.status), byBrand: index().on(t.brandId) }));

export const savedDeals = pgTable("saved_deals", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.dealId] }) }));

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "restrict" }),
  groupId: uuid("group_id").references(() => affiliationGroups.id, { onDelete: "set null" }),
  redemptionCode: text("redemption_code").notNull().unique(),
  method: dealChannelEnum("method").notNull().default("online"),
  originalPrice: numeric("original_price", { precision: 12, scale: 2 }),
  finalPrice: numeric("final_price", { precision: 12, scale: 2 }),
  discountApplied: numeric("discount_applied", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionType: commissionTypeEnum("commission_type").notNull(),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionStatus: commissionStatusEnum("commission_status").notNull().default("pending"),
  status: transactionStatusEnum("status").notNull().default("redeemed"),
  invoiceId: uuid("invoice_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
}, (t) => ({
  byUser: index().on(t.userId), byBrand: index().on(t.brandId), byDeal: index().on(t.dealId),
}));

export const commissionInvoices = pgTable("commission_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

> Note: confirm the `commission_invoices` columns against `supabase/migrations/*` before generating — add any columns present there that are not listed above (the source file was truncated at `period_end`). Copy them verbatim.

- [ ] **Step 2: Create `apps/api/src/db/schema/index.ts`**

```ts
export * from "./enums";
export * from "./tables";
```

- [ ] **Step 3: Generate the migration**

Run: `bun --filter api db:generate`
Expected: a `0000_*.sql` appears under `src/db/migrations`.

- [ ] **Step 4: Apply the migration to the dev DB**

Run: `bun --filter api db:migrate`
Expected: tables created, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: define Drizzle schema and initial migration"
```

### Task 2.3: Test DB harness + a smoke repository test

**Files:**
- Create: `apps/api/test/helpers/db.ts`, `apps/api/test/db.smoke.test.ts`

**Interfaces:**
- Produces: `withTestDb()` — resets tables between tests using `TEST_DATABASE_URL`. Later service tests consume this.

- [ ] **Step 1: Create `apps/api/test/helpers/db.ts`**

```ts
import { beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../src/db/client";

const TABLES = [
  "transactions", "commission_invoices", "saved_deals", "deals", "brands",
  "user_memberships", "group_whitelist", "affiliation_groups", "user_roles", "users",
];

export function withTestDb() {
  beforeEach(async () => {
    await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE;`));
  });
}
```

- [ ] **Step 2: Write the smoke test `apps/api/test/db.smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { db } from "../src/db/client";
import { users } from "../src/db/schema";
import { withTestDb } from "./helpers/db";

describe("db smoke", () => {
  withTestDb();
  it("inserts and reads a user", async () => {
    const [u] = await db.insert(users).values({ clerkUserId: "clerk_1", email: "a@b.com" }).returning();
    expect(u.id).toBeTruthy();
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test against the test DB**

Run: `TEST_DATABASE_URL=... DATABASE_URL=$TEST_DATABASE_URL bun --filter api test db.smoke`
Expected: PASS (run migrations on the test DB first with `db:migrate`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add test DB harness and schema smoke test"
```

---

## Phase 3 — Auth (Clerk) & authorization

### Task 3.1: Clerk JWT middleware

**Files:**
- Create: `apps/api/src/lib/clerk.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/repositories/users.repo.ts`, `apps/api/test/middleware/auth.test.ts`
- Modify: `apps/api/src/lib/config.ts` (add `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`)

**Interfaces:**
- Produces: `authMiddleware` — sets `c.get("auth") = { userId, roles }` (app user id + roles) or 401. `usersRepo.findByClerkId(clerkId)`, `usersRepo.getRoles(userId)`.

- [ ] **Step 1: Add deps + config**

```bash
bun add --cwd apps/api @clerk/backend
```
Add to config schema: `CLERK_SECRET_KEY: z.string()`, `CLERK_WEBHOOK_SECRET: z.string()`.

- [ ] **Step 2: Write the failing test `apps/api/test/middleware/auth.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../../src/lib/clerk", () => ({
  verifyClerkToken: vi.fn(async (t: string) =>
    t === "good" ? { sub: "clerk_1" } : null),
}));
vi.mock("../../src/repositories/users.repo", () => ({
  usersRepo: {
    findByClerkId: vi.fn(async () => ({ id: "u1" })),
    getRoles: vi.fn(async () => ["consumer"]),
  },
}));

import { authMiddleware } from "../../src/middleware/auth";

function appWith() {
  const app = new Hono();
  app.use("/p", authMiddleware);
  app.get("/p", (c) => c.json(c.get("auth")));
  return app;
}

describe("authMiddleware", () => {
  it("401 without a token", async () => {
    const res = await appWith().request("/p");
    expect(res.status).toBe(401);
  });
  it("401 with a bad token", async () => {
    const res = await appWith().request("/p", { headers: { authorization: "Bearer bad" } });
    expect(res.status).toBe(401);
  });
  it("passes and attaches auth with a good token", async () => {
    const res = await appWith().request("/p", { headers: { authorization: "Bearer good" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1", roles: ["consumer"] });
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

Run: `bun --filter api test auth`
Expected: FAIL — modules not found.

- [ ] **Step 4: Create `apps/api/src/lib/clerk.ts`**

```ts
import { verifyToken } from "@clerk/backend";
import { config } from "./config";

export async function verifyClerkToken(token: string): Promise<{ sub: string } | null> {
  try {
    const claims = await verifyToken(token, { secretKey: config.CLERK_SECRET_KEY });
    return claims.sub ? { sub: claims.sub } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Create `apps/api/src/repositories/users.repo.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, userRoles } from "../db/schema";
import type { AppRole } from "@perkhub/shared";

export const usersRepo = {
  async findByClerkId(clerkId: string) {
    const [u] = await db.select().from(users).where(eq(users.clerkUserId, clerkId)).limit(1);
    return u ?? null;
  },
  async getRoles(userId: string): Promise<AppRole[]> {
    const rows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role);
  },
};
```

- [ ] **Step 6: Create `apps/api/src/middleware/auth.ts`**

```ts
import { createMiddleware } from "hono/factory";
import type { AppRole } from "@perkhub/shared";
import { verifyClerkToken } from "../lib/clerk";
import { usersRepo } from "../repositories/users.repo";

export type AuthContext = { userId: string; roles: AppRole[] };

export const authMiddleware = createMiddleware<{ Variables: { auth: AuthContext } }>(
  async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
    const claims = await verifyClerkToken(header.slice(7));
    if (!claims) return c.json({ error: "Unauthorized" }, 401);
    const user = await usersRepo.findByClerkId(claims.sub);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    c.set("auth", { userId: user.id, roles: await usersRepo.getRoles(user.id) });
    await next();
  },
);
```

- [ ] **Step 7: Run test — verify it passes**

Run: `bun --filter api test auth`
Expected: PASS (all three cases).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add Clerk auth middleware"
```

### Task 3.2: Role guard middleware

**Files:**
- Create: `apps/api/src/middleware/require-role.ts`, `apps/api/test/middleware/require-role.test.ts`

**Interfaces:**
- Consumes: `c.get("auth").roles`.
- Produces: `requireRole(...roles: AppRole[])` → 403 if the user has none of them.

- [ ] **Step 1: Write the failing test `apps/api/test/middleware/require-role.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requireRole } from "../../src/middleware/require-role";

function appWith(roles: string[]) {
  const app = new Hono();
  app.use("*", async (c, next) => { c.set("auth", { userId: "u1", roles }); await next(); });
  app.get("/admin", requireRole("admin"), (c) => c.json({ ok: true }));
  return app;
}

describe("requireRole", () => {
  it("403 when role missing", async () => {
    expect((await appWith(["consumer"]).request("/admin")).status).toBe(403);
  });
  it("200 when role present", async () => {
    expect((await appWith(["admin"]).request("/admin")).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run — verify fails.** Run: `bun --filter api test require-role` → FAIL.

- [ ] **Step 3: Create `apps/api/src/middleware/require-role.ts`**

```ts
import { createMiddleware } from "hono/factory";
import type { AppRole } from "@perkhub/shared";
import type { AuthContext } from "./auth";

export function requireRole(...allowed: AppRole[]) {
  return createMiddleware<{ Variables: { auth: AuthContext } }>(async (c, next) => {
    const { roles } = c.get("auth");
    if (!roles.some((r) => allowed.includes(r))) return c.json({ error: "Forbidden" }, 403);
    await next();
  });
}
```

- [ ] **Step 4: Run — verify passes.** Run: `bun --filter api test require-role` → PASS.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: add requireRole guard"`

### Task 3.3: Clerk webhook — user provisioning (replaces `handle_new_user`)

**Files:**
- Create: `apps/api/src/services/user-provisioning.service.ts`, `apps/api/src/routes/webhooks.ts`, `apps/api/test/services/user-provisioning.test.ts`

**Interfaces:**
- Consumes: `db`, enums.
- Produces: `provisionUser({ clerkUserId, email, fullName, intendedRole })` → creates `users` row (idempotent on `clerkUserId`), grants `consumer`, and `brand_partner` when `intendedRole === "brand"`. Returns the user row.

- [ ] **Step 1: Add svix for webhook signature verification**

```bash
bun add --cwd apps/api svix
```

- [ ] **Step 2: Write the failing test `apps/api/test/services/user-provisioning.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { db } from "../../src/db/client";
import { users, userRoles } from "../../src/db/schema";
import { provisionUser } from "../../src/services/user-provisioning.service";
import { withTestDb } from "../helpers/db";
import { eq } from "drizzle-orm";

describe("provisionUser", () => {
  withTestDb();
  it("creates a consumer by default", async () => {
    const u = await provisionUser({ clerkUserId: "c1", email: "a@b.com", fullName: "A", intendedRole: null });
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    expect(roles.map((r) => r.role).sort()).toEqual(["consumer"]);
  });
  it("adds brand_partner when intendedRole=brand", async () => {
    const u = await provisionUser({ clerkUserId: "c2", email: "x@y.com", fullName: "X", intendedRole: "brand" });
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    expect(roles.map((r) => r.role).sort()).toEqual(["brand_partner", "consumer"]);
  });
  it("is idempotent on repeated calls", async () => {
    await provisionUser({ clerkUserId: "c3", email: "a@b.com", fullName: "A", intendedRole: null });
    await provisionUser({ clerkUserId: "c3", email: "a@b.com", fullName: "A", intendedRole: null });
    const rows = await db.select().from(users).where(eq(users.clerkUserId, "c3"));
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run — verify fails.** Run: `bun --filter api test user-provisioning` → FAIL.

- [ ] **Step 4: Create `apps/api/src/services/user-provisioning.service.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, userRoles } from "../db/schema";

type Input = { clerkUserId: string; email: string | null; fullName: string | null; intendedRole: "brand" | null };

export async function provisionUser(input: Input) {
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(users).where(eq(users.clerkUserId, input.clerkUserId)).limit(1);
    const user = existing[0] ?? (
      await tx.insert(users).values({
        clerkUserId: input.clerkUserId, email: input.email, fullName: input.fullName,
      }).returning()
    )[0];

    await tx.insert(userRoles).values({ userId: user.id, role: "consumer" }).onConflictDoNothing();
    if (input.intendedRole === "brand") {
      await tx.insert(userRoles).values({ userId: user.id, role: "brand_partner" }).onConflictDoNothing();
    }
    return user;
  });
}
```

- [ ] **Step 5: Run — verify passes.** Run: `bun --filter api test user-provisioning` → PASS.

- [ ] **Step 6: Create `apps/api/src/routes/webhooks.ts`** (svix-verified Clerk `user.created`)

```ts
import { Hono } from "hono";
import { Webhook } from "svix";
import { config } from "../lib/config";
import { provisionUser } from "../services/user-provisioning.service";

export const webhooks = new Hono();

webhooks.post("/clerk", async (c) => {
  const payload = await c.req.text();
  const headers = {
    "svix-id": c.req.header("svix-id") ?? "",
    "svix-timestamp": c.req.header("svix-timestamp") ?? "",
    "svix-signature": c.req.header("svix-signature") ?? "",
  };
  let evt: any;
  try {
    evt = new Webhook(config.CLERK_WEBHOOK_SECRET).verify(payload, headers);
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }
  if (evt.type === "user.created") {
    const d = evt.data;
    await provisionUser({
      clerkUserId: d.id,
      email: d.email_addresses?.[0]?.email_address ?? null,
      fullName: [d.first_name, d.last_name].filter(Boolean).join(" ") || null,
      intendedRole: d.unsafe_metadata?.intended_role === "brand" ? "brand" : null,
    });
  }
  return c.json({ received: true });
});
```

- [ ] **Step 7: Mount webhooks + commit.** In `app.ts` add `app.route("/webhooks", webhooks);`. Commit:

```bash
git add -A && git commit -m "feat: Clerk webhook user provisioning"
```

---

## Phase 4 — Domain services, repositories & routes

Each resource follows the same shape: `repositories/<x>.repo.ts` (Drizzle only), `services/<x>.service.ts` (rules + authorization), `routes/<x>.ts` (Zod validation + guards), `test/services/<x>.test.ts`. Request/response Zod schemas live in `packages/shared/src/schemas/`.

### Task 4.1: Membership submission service (replaces `tg_auto_verify_membership` + `tg_stamp_membership_expiry`)

**Files:**
- Create: `apps/api/src/repositories/memberships.repo.ts`, `apps/api/src/services/memberships.service.ts`, `apps/api/test/services/memberships.test.ts`
- Create: `packages/shared/src/schemas/membership.ts` (+ export from shared index)

**Interfaces:**
- Consumes: `db`, `affiliationGroups`, `groupWhitelist`, `userMemberships`, `users`.
- Produces: `membershipsService.submit({ userId, groupId, method, membershipNumber?, idDocumentUrl? })` → inserts a membership; auto-`verified` (with `verifiedAt`/`expiresAt` stamped from `badgeValidityMonths`) on email-domain or whitelist match, else `pending`. `membershipsService.review({ membershipId, status, rejectionReason?, actorRoles })` → admin-only transition; stamps expiry on `verified`.

- [ ] **Step 1: Add the shared schema `packages/shared/src/schemas/membership.ts`**

```ts
import { z } from "zod";
import { VERIFICATION_METHODS } from "../enums";

export const submitMembershipSchema = z.object({
  groupId: z.string().uuid(),
  method: z.enum(VERIFICATION_METHODS),
  membershipNumber: z.string().trim().min(1).optional(),
  idDocumentUrl: z.string().optional(),
}).refine((v) => v.method !== "membership_number" || !!v.membershipNumber, {
  message: "membershipNumber required for membership_number method", path: ["membershipNumber"],
});
export type SubmitMembershipInput = z.infer<typeof submitMembershipSchema>;
```
Add `export * from "./schemas/membership";` to `packages/shared/src/index.ts`.

- [ ] **Step 2: Write the failing test `apps/api/test/services/memberships.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../src/db/client";
import { users, affiliationGroups, groupWhitelist } from "../../src/db/schema";
import { membershipsService } from "../../src/services/memberships.service";
import { withTestDb } from "../helpers/db";

async function seedUser(email: string) {
  const [u] = await db.insert(users).values({ clerkUserId: "c-" + email, email }).returning();
  return u;
}
async function seedGroup(over: Partial<typeof affiliationGroups.$inferInsert> = {}) {
  const [g] = await db.insert(affiliationGroups).values({
    name: "G", type: "alumni", verificationMethods: ["email_domain", "membership_number", "id_upload"],
    emailDomains: ["unilag.edu.ng"], badgeValidityMonths: 12, ...over,
  }).returning();
  return g;
}

describe("membershipsService.submit", () => {
  withTestDb();

  it("auto-verifies on email domain match and stamps expiry", async () => {
    const u = await seedUser("ada@unilag.edu.ng");
    const g = await seedGroup();
    const m = await membershipsService.submit({ userId: u.id, groupId: g.id, method: "email_domain" });
    expect(m.status).toBe("verified");
    expect(m.verifiedAt).toBeTruthy();
    expect(m.expiresAt).toBeTruthy();
  });

  it("stays pending when email domain does not match", async () => {
    const u = await seedUser("ada@gmail.com");
    const g = await seedGroup();
    const m = await membershipsService.submit({ userId: u.id, groupId: g.id, method: "email_domain" });
    expect(m.status).toBe("pending");
    expect(m.expiresAt).toBeNull();
  });

  it("auto-verifies on whitelist match (case-insensitive)", async () => {
    const u = await seedUser("x@y.com");
    const g = await seedGroup();
    await db.insert(groupWhitelist).values({ groupId: g.id, membershipNumber: "NYSC/23A/1" });
    const m = await membershipsService.submit({
      userId: u.id, groupId: g.id, method: "membership_number", membershipNumber: "nysc/23a/1",
    });
    expect(m.status).toBe("verified");
  });

  it("stays pending for id_upload", async () => {
    const u = await seedUser("x@y.com");
    const g = await seedGroup();
    const m = await membershipsService.submit({
      userId: u.id, groupId: g.id, method: "id_upload", idDocumentUrl: "u/doc.pdf",
    });
    expect(m.status).toBe("pending");
  });
});

describe("membershipsService.review", () => {
  withTestDb();
  it("admin verify stamps expiry", async () => {
    const u = await seedUser("x@y.com");
    const g = await seedGroup();
    const pend = await membershipsService.submit({ userId: u.id, groupId: g.id, method: "id_upload", idDocumentUrl: "d" });
    const done = await membershipsService.review({ membershipId: pend.id, status: "verified", actorRoles: ["admin"] });
    expect(done.status).toBe("verified");
    expect(done.expiresAt).toBeTruthy();
  });
  it("rejects non-admin", async () => {
    const u = await seedUser("x@y.com");
    const g = await seedGroup();
    const pend = await membershipsService.submit({ userId: u.id, groupId: g.id, method: "id_upload", idDocumentUrl: "d" });
    await expect(membershipsService.review({ membershipId: pend.id, status: "verified", actorRoles: ["consumer"] }))
      .rejects.toThrow(/forbidden/i);
  });
});
```

- [ ] **Step 3: Run — verify fails.** Run: `bun --filter api test memberships` → FAIL.

- [ ] **Step 4: Create `apps/api/src/repositories/memberships.repo.ts`**

```ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { affiliationGroups, groupWhitelist, userMemberships, users } from "../db/schema";

export const membershipsRepo = {
  getGroup: (id: string) =>
    db.select().from(affiliationGroups).where(eq(affiliationGroups.id, id)).limit(1).then((r) => r[0] ?? null),
  getUser: (id: string) =>
    db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0] ?? null),
  whitelistMatch: (groupId: string, number: string) =>
    db.select({ id: groupWhitelist.id }).from(groupWhitelist)
      .where(and(eq(groupWhitelist.groupId, groupId), sql`lower(${groupWhitelist.membershipNumber}) = lower(${number})`))
      .limit(1).then((r) => r.length > 0),
  insert: (values: typeof userMemberships.$inferInsert) =>
    db.insert(userMemberships).values(values).returning().then((r) => r[0]),
  getById: (id: string) =>
    db.select().from(userMemberships).where(eq(userMemberships.id, id)).limit(1).then((r) => r[0] ?? null),
  update: (id: string, patch: Partial<typeof userMemberships.$inferInsert>) =>
    db.update(userMemberships).set(patch).where(eq(userMemberships.id, id)).returning().then((r) => r[0]),
};
```

- [ ] **Step 5: Create `apps/api/src/services/memberships.service.ts`**

```ts
import type { AppRole } from "@perkhub/shared";
import { membershipsRepo } from "../repositories/memberships.repo";

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function isAutoVerified(input: {
  userEmail: string | null; group: { emailDomains: string[] };
  method: string; groupId: string; membershipNumber?: string;
}): Promise<boolean> {
  if (input.method === "email_domain" && input.group.emailDomains.length > 0 && input.userEmail) {
    const domain = input.userEmail.split("@")[1]?.toLowerCase();
    if (domain && input.group.emailDomains.map((d) => d.toLowerCase()).includes(domain)) return true;
  }
  if (input.method === "membership_number" && input.membershipNumber) {
    return membershipsRepo.whitelistMatch(input.groupId, input.membershipNumber);
  }
  return false;
}

export const membershipsService = {
  async submit(input: {
    userId: string; groupId: string; method: string;
    membershipNumber?: string; idDocumentUrl?: string;
  }) {
    const [group, user] = await Promise.all([
      membershipsRepo.getGroup(input.groupId),
      membershipsRepo.getUser(input.userId),
    ]);
    if (!group) throw new Error("Group not found");
    if (!user) throw new Error("User not found");

    const verified = await isAutoVerified({
      userEmail: user.email, group, method: input.method,
      groupId: input.groupId, membershipNumber: input.membershipNumber,
    });
    const now = new Date();
    return membershipsRepo.insert({
      userId: input.userId,
      groupId: input.groupId,
      method: input.method as any,
      membershipNumber: input.membershipNumber ?? null,
      idDocumentUrl: input.idDocumentUrl ?? null,
      submittedEmail: user.email,
      status: verified ? "verified" : "pending",
      verifiedAt: verified ? now : null,
      expiresAt: verified ? addMonths(now, group.badgeValidityMonths) : null,
    });
  },

  async review(input: {
    membershipId: string; status: "verified" | "rejected";
    rejectionReason?: string; actorRoles: AppRole[];
  }) {
    if (!input.actorRoles.includes("admin")) throw new Error("Forbidden");
    const m = await membershipsRepo.getById(input.membershipId);
    if (!m) throw new Error("Membership not found");
    const group = await membershipsRepo.getGroup(m.groupId);
    const now = new Date();
    const stamping = input.status === "verified" && m.status !== "verified" && group
      ? { verifiedAt: m.verifiedAt ?? now, expiresAt: m.expiresAt ?? addMonths(now, group.badgeValidityMonths) }
      : {};
    return membershipsRepo.update(input.membershipId, {
      status: input.status,
      rejectionReason: input.status === "rejected" ? (input.rejectionReason ?? null) : null,
      ...stamping,
    });
  },
};
```

- [ ] **Step 6: Run — verify passes.** Run: `bun --filter api test memberships` → PASS (all cases).

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat: membership submit/review service (ports verification triggers)"`

### Task 4.2: Membership routes

**Files:**
- Create: `apps/api/src/routes/memberships.ts`, `apps/api/test/routes/memberships.route.test.ts`

**Interfaces:**
- Consumes: `authMiddleware`, `requireRole`, `membershipsService`, `submitMembershipSchema`.
- Produces: `POST /memberships` (auth; owner submit), `GET /memberships/mine` (auth; own list), `GET /memberships?status=` (admin), `PATCH /memberships/:id/review` (admin).

- [ ] **Step 1: Write the failing route test `apps/api/test/routes/memberships.route.test.ts`** — mock `membershipsService` and the auth middleware; assert 401 without token, 200 + service call with a valid token, and 403 on `/review` for non-admin. (Use the `vi.mock` pattern from Task 3.1.)

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("../../src/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => { c.set("auth", { userId: "u1", roles: ["consumer"] }); await next(); },
}));
const submit = vi.fn(async () => ({ id: "m1", status: "pending" }));
vi.mock("../../src/services/memberships.service", () => ({ membershipsService: { submit, review: vi.fn() } }));
import { createApp } from "../../src/app";

describe("POST /memberships", () => {
  it("submits for the authed user", async () => {
    const res = await createApp().request("/memberships", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer good" },
      body: JSON.stringify({ groupId: "11111111-1111-1111-1111-111111111111", method: "id_upload", idDocumentUrl: "d" }),
    });
    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
  });
});
```

- [ ] **Step 2: Run — verify fails.** Run: `bun --filter api test memberships.route` → FAIL.

- [ ] **Step 3: Create `apps/api/src/routes/memberships.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { submitMembershipSchema } from "@perkhub/shared";
import { z } from "zod";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import { membershipsService } from "../services/memberships.service";
import { membershipsRepo } from "../repositories/memberships.repo";

export const memberships = new Hono<{ Variables: { auth: AuthContext } }>();
memberships.use("*", authMiddleware);

memberships.post("/", zValidator("json", submitMembershipSchema), async (c) => {
  const body = c.req.valid("json");
  const m = await membershipsService.submit({ userId: c.get("auth").userId, ...body });
  return c.json(m, 201);
});

memberships.patch("/:id/review",
  requireRole("admin"),
  zValidator("json", z.object({ status: z.enum(["verified", "rejected"]), rejectionReason: z.string().optional() })),
  async (c) => {
    const m = await membershipsService.review({
      membershipId: c.req.param("id"), actorRoles: c.get("auth").roles, ...c.req.valid("json"),
    });
    return c.json(m);
  });
```
Add `bun add --cwd apps/api @hono/zod-validator`. Mount in `app.ts`: `app.route("/memberships", memberships);`.

- [ ] **Step 4: Run — verify passes.** Run: `bun --filter api test memberships.route` → PASS.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: membership routes"`

### Task 4.3: Affiliation groups (public read + admin write)

Same layered pattern. **Authorization parity with old RLS:** public `GET /groups` returns only `active = true` unless the caller is admin; writes are admin-only.

- [ ] **Step 1:** Write `test/services/groups.test.ts` — active-only listing for anon/consumer, all for admin; create/update admin-only (throws `/forbidden/i` otherwise).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Create `repositories/groups.repo.ts` (`listActive()`, `listAll()`, `create()`, `update()`), `services/groups.service.ts` (`list({ roles })`, `create({ roles, data })`, `update({ roles, id, data })` — throw `Error("Forbidden")` when not admin), and `packages/shared/src/schemas/group.ts` (create/update Zod schemas mirroring the `affiliation_groups` columns).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Create `routes/groups.ts`: `GET /groups` (optional auth — read roles if a token is present, else treat as anon), `POST /groups` + `PATCH /groups/:id` behind `requireRole("admin")`. Mount at `/groups`.
- [ ] **Step 6:** Commit `feat: affiliation groups service and routes`.

### Task 4.4: Brands (owner + admin)

**Authorization parity:** `GET /brands` returns `approved` brands to anyone, plus the caller's own and all to admin. Owner may insert/update own; admin may update any.

- [ ] **Step 1:** `test/services/brands.test.ts` — visibility matrix (anon sees approved only; owner sees own pending; admin sees all), owner-insert sets `ownerUserId` from auth, non-owner/non-admin update throws `/forbidden/i`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `repositories/brands.repo.ts`, `services/brands.service.ts` (`listVisible({ userId, roles })`, `create({ userId, data })`, `update({ userId, roles, id, data })`), `packages/shared/src/schemas/brand.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `routes/brands.ts` mounted at `/brands`.
- [ ] **Step 6:** Commit `feat: brands service and routes`.

### Task 4.5: Deals (brand owner + admin + public published)

**Authorization parity:** `GET /deals` returns `published` to anyone, own-brand deals to the owner, all to admin. Write allowed to the owning brand's owner or admin.

- [ ] **Step 1:** `test/services/deals.test.ts` — published visible to anon; draft visible only to brand owner + admin; write by non-owner throws `/forbidden/i`; ownership resolved by joining `deals.brandId → brands.ownerUserId`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `repositories/deals.repo.ts`, `services/deals.service.ts`, `packages/shared/src/schemas/deal.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `routes/deals.ts` mounted at `/deals`.
- [ ] **Step 6:** Commit `feat: deals service and routes`.

### Task 4.6: Saved deals + Transactions (redemption + commission)

**Authorization parity:** saved deals owner-only. Transactions: readable by the owning user, the deal's brand owner, or admin; inserted by the user; `redemptionCode` unique; commission computed from the brand's `commissionType`/`commissionRate` at redemption time.

- [ ] **Step 1:** `test/services/transactions.test.ts` — `redeem({ userId, dealId })` generates a unique `redemptionCode`, copies `commissionType`/`commissionRate` from the brand, computes `commissionAmount` (percent → `finalPrice * rate/100`; flat → `rate`), sets `commissionStatus="pending"`; read visibility matrix (user/brand-owner/admin).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `repositories/{savedDeals,transactions}.repo.ts`, `services/{savedDeals,transactions}.service.ts`, `packages/shared/src/schemas/transaction.ts`. Redemption code: `crypto.randomUUID()`-derived, uppercased, prefixed (e.g. `PH-XXXXXXXX`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `routes/{savedDeals,transactions}.ts` mounted at `/saved-deals`, `/transactions`.
- [ ] **Step 6:** Commit `feat: saved deals and transactions with commission`.

### Task 4.7: Central error handling

**Files:**
- Create: `apps/api/src/middleware/error.ts`, `apps/api/test/middleware/error.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:** maps thrown `Error("Forbidden")` → 403, `Error("... not found")` → 404, Zod errors → 400, everything else → 500 with a generic body (no internal leakage).

- [ ] **Step 1:** Write `test/middleware/error.test.ts` — a route that throws `Error("Forbidden")` yields 403; unknown error yields 500 `{ error: "Internal Server Error" }`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Create `middleware/error.ts` with `app.onError` logic; wire via `app.onError(handleError)` in `app.ts`. Define a small `AppError` class (`status`, `message`) and have services throw `new AppError(403, "Forbidden")` — refactor earlier services' `throw new Error("Forbidden")` to `AppError` and update tests to match `/forbidden/i`.
- [ ] **Step 4:** Run → PASS (and re-run `bun --filter api test` fully).
- [ ] **Step 5:** Commit `feat: central error handling`.

---

## Phase 5 — Object storage (ID documents)

### Task 5.1: Presigned upload/download service

**Files:**
- Create: `apps/api/src/lib/storage.ts`, `apps/api/src/routes/uploads.ts`, `apps/api/test/lib/storage.test.ts`
- Modify: `apps/api/src/lib/config.ts` (`STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`)

**Interfaces:**
- Produces: `storage.presignPut(key, contentType)` → URL; `storage.presignGet(key)` → URL; `POST /uploads/membership-doc` (auth) → `{ uploadUrl, key }` with key `${userId}/${uuid}.${ext}`.

- [ ] **Step 1:** Add deps `bun add --cwd apps/api @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`, extend config.
- [ ] **Step 2:** Write `test/lib/storage.test.ts` — mock the S3 presigner; assert `presignPut` calls `PutObjectCommand` with bucket+key and returns the mocked URL. (Pure unit test, no network.)
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Create `lib/storage.ts` (S3 client configured with `forcePathStyle: true` for the Railway/S3-compatible endpoint; `presignPut`/`presignGet` via `getSignedUrl`, 5-min expiry).
- [ ] **Step 5:** Run → PASS.
- [ ] **Step 6:** Create `routes/uploads.ts` — `POST /uploads/membership-doc` behind `authMiddleware`, body `{ contentType, ext }` (Zod, restrict `ext` to `jpg|jpeg|png|pdf`), returns `{ uploadUrl, key }`. Mount at `/uploads`. Add an admin-only `GET /uploads/membership-doc/:key/url` returning a presigned GET (guarded by `requireRole("admin")` or ownership check).
- [ ] **Step 7:** Commit `feat: presigned storage for membership documents`.

---

## Phase 6 — Frontend re-wire (`apps/web`)

The frontend keeps TanStack Start/Router/Query and all UI. Only auth + data access change.

### Task 6.1: Add Clerk provider + typed API client

**Files:**
- Create: `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/clerk.tsx`
- Modify: `apps/web/src/routes/__root.tsx`, `apps/web/.env` keys
- Add deps: `@clerk/tanstack-react-start`

**Interfaces:**
- Produces: `apiFetch(path, { method, body, token })` — attaches `Authorization: Bearer <clerk token>`, base URL from `import.meta.env.VITE_API_BASE_URL`, throws on non-2xx, parses JSON. A `useApi()` hook that injects the Clerk token via `useAuth().getToken()`.

- [ ] **Step 1:** `bun add --cwd apps/web @clerk/tanstack-react-start` and add `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` to `apps/web/.env`.
- [ ] **Step 2:** Write `apps/web/src/lib/api-client.ts`:

```ts
const BASE = import.meta.env.VITE_API_BASE_URL as string;

export async function apiFetch<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}
```

- [ ] **Step 3:** Wrap the app in `<ClerkProvider>` in `__root.tsx` (publishable key from env). Add a `useApi()` hook that wraps `apiFetch` and pulls the token from Clerk's `useAuth().getToken()`.
- [ ] **Step 4:** Verify the web app builds. Run: `bun --filter web build` → success.
- [ ] **Step 5:** Commit `feat(web): add Clerk provider and API client`.

### Task 6.2: Replace `use-auth` and the auth route on Clerk

**Files:**
- Modify: `apps/web/src/hooks/use-auth.tsx`, `apps/web/src/routes/auth.tsx`, `apps/web/src/routes/_authenticated.tsx`, `apps/web/src/routes/reset-password.tsx`

- [ ] **Step 1:** Re-implement `useSession`/`useRoles` on Clerk: `useSession` returns Clerk's `{ isSignedIn, userId }`; `useRoles` fetches roles from `GET /me` (add this endpoint in the API: returns `{ userId, roles }` from the auth context). Keep `primaryRole`/`homePathFor` exactly as-is.
- [ ] **Step 2:** Replace `auth.tsx` sign-in/sign-up with Clerk components (`<SignIn>`/`<SignUp>` or `useSignIn`/`useSignUp`), passing `unsafeMetadata: { intended_role: search.role }` on sign-up so the webhook grants `brand_partner`. Preserve the landing links and `?mode`/`?role`/`?redirect` search params.
- [ ] **Step 3:** `_authenticated.tsx` `beforeLoad` uses Clerk session state instead of `supabase.auth.getUser()`; redirect to `/auth` when signed out. `reset-password.tsx` delegates to Clerk's reset flow (or is removed if Clerk hosts it).
- [ ] **Step 4:** Verify build. Run: `bun --filter web build` → success.
- [ ] **Step 5:** Commit `feat(web): move auth to Clerk`.

### Task 6.3: Replace Supabase data calls with the API client

**Files:**
- Modify: `apps/web/src/routes/_authenticated.app.verify.tsx`, `_authenticated.app.membership.tsx`, `_authenticated.admin.verifications.tsx`, `_authenticated.admin.index.tsx`, `_authenticated.brand.tsx`, `_authenticated.app.index.tsx`

- [ ] **Step 1:** In `verify.tsx`: replace the `affiliation_groups` query with `useQuery(["groups"], () => api("/groups"))`; replace the storage upload with `POST /uploads/membership-doc` → presigned PUT → then `POST /memberships` with the returned `key`. Keep the same form UX and toasts.
- [ ] **Step 2:** In `membership.tsx`: fetch from `GET /memberships/mine`.
- [ ] **Step 3:** In `admin.verifications.tsx`: list via `GET /memberships?status=`; approve/reject via `PATCH /memberships/:id/review`; document preview via the admin presigned-GET endpoint.
- [ ] **Step 4:** In `admin.index.tsx`, `brand.tsx`, `app.index.tsx`: replace any `supabase.from(...)` reads with the matching API endpoints (`/brands`, `/deals`, `/transactions`).
- [ ] **Step 5:** Grep to confirm no Supabase usage remains: `rg "supabase" apps/web/src` → no results.
- [ ] **Step 6:** Verify build. Run: `bun --filter web build` → success.
- [ ] **Step 7:** Commit `feat(web): replace Supabase data access with API client`.

### Task 6.4: Remove Supabase from the frontend entirely

**Files:**
- Delete: `apps/web/src/integrations/supabase/` (all files), `supabase/` migrations dir is retained only as reference (or deleted — see Phase 7)
- Modify: `apps/web/package.json` (drop `@supabase/supabase-js`, `@lovable.dev/cloud-auth-js` if unused)

- [ ] **Step 1:** Delete `apps/web/src/integrations/supabase/*`. Run `rg "@supabase|integrations/supabase|lovable/cloud-auth" apps/web/src` → no results.
- [ ] **Step 2:** `bun remove --cwd apps/web @supabase/supabase-js` (and `@lovable.dev/cloud-auth-js` if the grep shows it unused).
- [ ] **Step 3:** Verify build + lint. Run: `bun --filter web build && bun --filter web lint` → success.
- [ ] **Step 4:** Commit `chore(web): remove Supabase client and deps`.

---

## Phase 7 — Deploy, docs & branding

### Task 7.1: Provision Railway (API + Postgres + bucket) and deploy the API

- [ ] **Step 1:** Using the Railway integration, create a project (or use the connected one): add a **Postgres** service, an **object-storage bucket**, and an **API** service pointed at `apps/api`.
- [ ] **Step 2:** Set API service variables: `DATABASE_URL` (reference Postgres), `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `STORAGE_*` (from the bucket), `NODE_ENV=production`, `PORT`.
- [ ] **Step 3:** Add a start command that runs migrations then boots: `bun --filter api db:migrate && bun --filter api start`. Deploy.
- [ ] **Step 4:** Hit `GET /health` on the Railway URL → `{"status":"ok"}`. Configure the Clerk dashboard webhook to `POST <api-url>/webhooks/clerk` with the signing secret matching `CLERK_WEBHOOK_SECRET`.
- [ ] **Step 5:** Set the frontend's `VITE_API_BASE_URL` to the Railway API URL and `VITE_CLERK_PUBLISHABLE_KEY`; redeploy the web app. Commit any deploy config (`railway.json`/Dockerfile) `chore: railway deploy config`.

### Task 7.2: Rewrite CLAUDE.md and README.md

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Delete: `supabase/` directory (schema now lives in Drizzle migrations); `AGENTS.md` Lovable/Supabase content updated or removed.

- [ ] **Step 1:** Rewrite `CLAUDE.md`: monorepo layout (`apps/web`, `apps/api`, `packages/shared`); Bun workspace commands (`bun --filter web dev`, `bun --filter api dev`, `bun --filter api test`, `db:generate`/`db:migrate`); API architecture (routes→services→repos, Clerk auth, role guards replacing RLS, trigger logic now in services); shared Zod contract; Railway deploy. Remove all Supabase/RLS/Lovable-backend guidance.
- [ ] **Step 2:** Rewrite `README.md`: product intro (unchanged), new stack, `bun install` + per-app dev commands, env var table (Clerk/DB/storage/API base), monorepo structure, Railway deploy notes. Remove Supabase setup and Lovable-cloud sections.
- [ ] **Step 3:** Delete the now-obsolete `supabase/` directory (migrations preserved in git history; Drizzle is the source of truth). Update or remove `AGENTS.md` Lovable references.
- [ ] **Step 4:** Grep the repo root for stale references: `rg -i "supabase|lovable cloud|RLS" CLAUDE.md README.md AGENTS.md` → no results.
- [ ] **Step 5:** Commit `docs: rewrite CLAUDE.md and README for new architecture`.

### Task 7.3: PerkHub-branded favicon

**Files:**
- Create: `apps/web/public/favicon.svg`, `apps/web/public/favicon.ico`, (optional) `apps/web/public/apple-touch-icon.png`, `apps/web/public/site.webmanifest`
- Modify: `apps/web/index.html` head links

- [ ] **Step 1:** Read `apps/web/src/components/perk/Logo.tsx` to extract the PerkHub mark (glyph + brand color) and produce a standalone square `favicon.svg` (the logo mark on brand background, no wordmark).
- [ ] **Step 2:** Generate `favicon.ico` (multi-size 16/32/48) and `apple-touch-icon.png` (180×180) from the SVG.
- [ ] **Step 3:** Update `<head>` in `index.html`: `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`, `<link rel="icon" href="/favicon.ico" sizes="any">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, and set `<title>` to `PerkHub`. Remove any default/placeholder favicon.
- [ ] **Step 4:** Verify build and that the icon loads. Run: `bun --filter web build` → success; load the app and confirm the tab icon is the PerkHub mark.
- [ ] **Step 5:** Commit `feat(web): PerkHub-branded favicon`.

---

## Final verification

- [ ] Run the full API suite: `bun --filter api test` → all green.
- [ ] Build the web app: `bun --filter web build` → success.
- [ ] `rg -i "supabase" --glob '!docs/**' --glob '!**/migrations/**'` → no runtime references remain.
- [ ] Manual smoke: sign up (consumer) → verify via email domain (auto-verified) → view membership card; sign up (brand) → create brand/deal; admin → review a pending id_upload membership.
```
