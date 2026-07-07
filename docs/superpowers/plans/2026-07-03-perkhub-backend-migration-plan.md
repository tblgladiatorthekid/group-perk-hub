# PerkHub Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase/Lovable backend with Hono + Drizzle API in a Bun-workspace monorepo, re-wire auth to Clerk, preserving all product behavior.

**Architecture:** Bun-workspace monorepo (`apps/web`, `apps/api`, `packages/shared`). Hono API layered as `routes → services → repositories(Drizzle)`. Clerk owns identity; API handles roles/authorization (replacing RLS). Business logic from Postgres triggers moves to tested services.

**Tech Stack:** Bun workspaces, Hono + @hono/node-server, Drizzle ORM + node-postgres, drizzle-kit, Zod, Clerk (@clerk/backend, @clerk/tanstack-react-start), svix, @aws-sdk/client-s3 + s3-request-presigner, Vitest, TanStack Start/Router/Query (existing).

## Global Constraints

- All new code uses TypeScript with strict mode
- Database schema is 1:1 with existing Supabase schema
- Auth: Clerk for identity, API for roles/permissions (no RLS in DB)
- Postgres trigger logic ports to API service layer
- Feature-based RESTful routes
- Cloudflare R2 for object storage (S3-compatible SDK)
- UUID primary keys for all tables
- All DB timestamps use ISO 8601 strings
- Repository `update()` methods always set `updatedAt` to `new Date()`

---

## File Structure

```
group-perk-hub/
├── package.json                    # Root workspaces config
├── tsconfig.json                   # Root tsconfig (references)
├── bunfig.toml                     # Bun config
├── .gitignore                      # Updated with new dirs
├── apps/
│   ├── web/                        # Existing TanStack Start frontend (move later)
│   │   ├── src/                    # (existing, will be rewired)
│   │   └── package.json
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts
│       └── src/
│           ├── index.ts                                # Hono app entry + serve
│           ├── db/
│           │   ├── client.ts                            # Drizzle + node-postgres pool
│           │   ├── enums.ts                             # pgEnum definitions
│           │   └── schema.ts                            # pgTable definitions
│           ├── middleware/
│           │   ├── auth.ts                              # Clerk verifySession + requireRole
│           │   └── error.ts                             # Global error handler
│           ├── routes/
│           │   ├── auth.ts                              # POST /auth/clerk-webhook
│           │   ├── profiles.ts                          # GET/PATCH /profiles/me
│           │   ├── roles.ts                             # GET /roles/me, POST/DELETE roles (admin)
│           │   ├── groups.ts                            # CRUD /groups (admin write)
│           │   ├── memberships.ts                       # CRUD /memberships
│           │   ├── brands.ts                            # CRUD /brands
│           │   ├── deals.ts                             # CRUD /deals
│           │   ├── saved-deals.ts                       # GET/POST/DELETE /saved-deals
│           │   ├── transactions.ts                      # GET/POST /transactions
│           │   ├── invoices.ts                          # CRUD /invoices (admin write)
│           │   ├── admin.ts                             # GET /admin/stats, PATCH user roles
│           │   └── storage.ts                           # POST presign-upload, GET presign-download
│           ├── services/
│           │   ├── auth.service.ts                      # Clerk webhook user sync
│           │   ├── membership.service.ts                # Auto-verify + expiry stamping
│           │   ├── transaction.service.ts               # Commission calculation
│           │   └── storage.service.ts                   # R2 presigned URL generation
│           └── repositories/
│               ├── profiles.repo.ts
│               ├── userRoles.repo.ts
│               ├── groups.repo.ts
│               ├── whitelist.repo.ts
│               ├── memberships.repo.ts
│               ├── brands.repo.ts
│               ├── deals.repo.ts
│               ├── savedDeals.repo.ts
│               ├── transactions.repo.ts
│               └── invoices.repo.ts
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts              # Re-exports
            ├── enums.ts              # TypeScript enum unions (mirrors Postgres enums)
            ├── types.ts              # Table Row type interfaces
            └── schemas/              # Zod schemas
                ├── index.ts
                ├── auth.schemas.ts
                ├── profile.schemas.ts
                ├── group.schemas.ts
                ├── membership.schemas.ts
                ├── brand.schemas.ts
                ├── deal.schemas.ts
                ├── transaction.schemas.ts
                └── invoice.schemas.ts
```

---

### Task 1: Monorepo Scaffolding & Shared Package

**Files:**
- Create: `package.json` (root)
- Modify: `tsconfig.json` (root)
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `@perkhub/shared` package with enums + type interfaces (imported by apps/web and apps/api)

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "perkhub",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "bun run --cwd apps/api dev",
    "dev:web": "bun run --cwd apps/web dev",
    "build:api": "bun run --cwd apps/api build",
    "build:web": "bun run --cwd apps/web build",
    "db:generate": "bun run --cwd apps/api db:generate",
    "db:migrate": "bun run --cwd apps/api db:migrate",
    "test": "bun run --cwd apps/api test",
    "lint": "eslint ."
  }
}
```

- [ ] **Step 2: Write root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Write packages/shared/package.json**

```json
{
  "name": "@perkhub/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.24.2"
  }
}
```

- [ ] **Step 4: Write packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Write packages/shared/src/enums.ts**

```typescript
export const APP_ROLES = ["consumer", "brand_partner", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const AFFILIATION_TYPES = [
  "cooperative", "alumni", "professional", "nysc",
  "corporate", "religious", "union", "other",
] as const;
export type AffiliationType = (typeof AFFILIATION_TYPES)[number];

export const VERIFICATION_METHODS = ["id_upload", "email_domain", "membership_number"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const MEMBERSHIP_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const BRAND_STATUSES = ["pending", "approved", "suspended", "rejected"] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];

export const DEAL_STATUSES = ["draft", "pending_review", "published", "rejected", "expired"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DISCOUNT_TYPES = ["percent", "fixed", "bogo", "free_item"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DEAL_CHANNELS = ["online", "instore", "both"] as const;
export type DealChannel = (typeof DEAL_CHANNELS)[number];

export const COMMISSION_TYPES = ["percent", "flat"] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const TRANSACTION_STATUSES = ["redeemed", "expired", "cancelled", "disputed"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const COMMISSION_STATUSES = ["pending", "invoiced", "paid"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
```

- [ ] **Step 6: Write packages/shared/src/types.ts**

```typescript
import type {
  AppRole, AffiliationType, VerificationMethod, MembershipStatus,
  BrandStatus, DealStatus, DiscountType, DealChannel, CommissionType,
  TransactionStatus, CommissionStatus, InvoiceStatus,
} from "./enums";

export interface Profile {
  id: string;
  fullName: string | null;
  phone: string | null;
  state: string | null;
  lga: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  userId: string;
  role: AppRole;
  createdAt: string;
}

export interface AffiliationGroup {
  id: string;
  name: string;
  type: AffiliationType;
  description: string | null;
  verificationMethods: VerificationMethod[];
  emailDomains: string[];
  badgeValidityMonths: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupWhitelistEntry {
  id: string;
  groupId: string;
  membershipNumber: string;
  fullName: string | null;
  createdAt: string;
}

export interface UserMembership {
  id: string;
  userId: string;
  groupId: string;
  method: VerificationMethod;
  membershipNumber: string | null;
  idDocumentUrl: string | null;
  submittedEmail: string | null;
  status: MembershipStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string | null;
  cacNumber: string | null;
  category: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  contactEmail: string;
  contactPhone: string | null;
  status: BrandStatus;
  commissionType: CommissionType;
  commissionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  brandId: string;
  title: string;
  slug: string | null;
  description: string;
  terms: string | null;
  discountType: DiscountType;
  discountValue: number;
  targetGroupIds: string[];
  channel: DealChannel;
  redemptionUrl: string | null;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  perUserLimit: number;
  totalCap: number | null;
  status: DealStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedDeal {
  userId: string;
  dealId: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  dealId: string;
  brandId: string;
  groupId: string | null;
  redemptionCode: string;
  method: DealChannel;
  originalPrice: number | null;
  finalPrice: number | null;
  discountApplied: number;
  commissionType: CommissionType;
  commissionRate: number;
  commissionAmount: number;
  commissionStatus: CommissionStatus;
  status: TransactionStatus;
  invoiceId: string | null;
  createdAt: string;
  redeemedAt: string | null;
}

export interface CommissionInvoice {
  id: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: InvoiceStatus;
  paystackRef: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Clerk webhook payload types
export interface ClerkWebhookEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
    public_metadata: Record<string, unknown>;
    private_metadata: Record<string, unknown>;
    created_at: number;
    updated_at: number;
  };
}
```

- [ ] **Step 7: Write packages/shared/src/index.ts**

```typescript
export * from "./enums";
export * from "./types";
```

- [ ] **Step 8: Install workspace dependencies and verify**

Run: `bun install`
Expected: Workspace packages link successfully

- [ ] **Step 9: Commit**

```
git add package.json tsconfig.json packages/shared/
git commit -m "feat: init Bun-workspace monorepo with shared package"
```

---

### Task 2: Drizzle Schema & DB Client

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/enums.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`

**Interfaces:**
- Produces: Drizzle `db` client, `enums` (pgEnum), `schema` (pgTable) — consumed by all repository and migration code

- [ ] **Step 1: Write apps/api/package.json**

```json
{
  "name": "@perkhub/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir=./dist --target=bun",
    "start": "bun run dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@clerk/backend": "^1.25.0",
    "@hono/node-server": "^1.13.0",
    "@perkhub/shared": "workspace:*",
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "postgres": "^3.4.0",
    "svix": "^1.50.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 3: Write apps/api/drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Write apps/api/src/db/enums.ts**

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["consumer", "brand_partner", "admin"]);
export const affiliationTypeEnum = pgEnum("affiliation_type", [
  "cooperative", "alumni", "professional", "nysc",
  "corporate", "religious", "union", "other",
]);
export const verificationMethodEnum = pgEnum("verification_method", [
  "id_upload", "email_domain", "membership_number",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending", "verified", "rejected", "expired",
]);
export const brandStatusEnum = pgEnum("brand_status", [
  "pending", "approved", "suspended", "rejected",
]);
export const dealStatusEnum = pgEnum("deal_status", [
  "draft", "pending_review", "published", "rejected", "expired",
]);
export const discountTypeEnum = pgEnum("discount_type", [
  "percent", "fixed", "bogo", "free_item",
]);
export const dealChannelEnum = pgEnum("deal_channel", ["online", "instore", "both"]);
export const commissionTypeEnum = pgEnum("commission_type", ["percent", "flat"]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "redeemed", "expired", "cancelled", "disputed",
]);
export const commissionStatusEnum = pgEnum("commission_status", [
  "pending", "invoiced", "paid",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "sent", "paid", "overdue", "void",
]);
```

- [ ] **Step 5: Write apps/api/src/db/schema.ts**

```typescript
import {
  pgTable, uuid, text, timestamp, boolean, integer, numeric,
  primaryKey, uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  appRoleEnum, affiliationTypeEnum, verificationMethodEnum,
  membershipStatusEnum, brandStatusEnum, dealStatusEnum,
  discountTypeEnum, dealChannelEnum, commissionTypeEnum,
  transactionStatusEnum, commissionStatusEnum, invoiceStatusEnum,
} from "./enums";

// Profiles
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  state: text("state"),
  lga: text("lga"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// User Roles
export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  role: appRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userRoleUnique: uniqueIndex().on(table.userId, table.role),
}));

// Affiliation Groups
export const affiliationGroups = pgTable("affiliation_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: affiliationTypeEnum("type").notNull(),
  description: text("description"),
  verificationMethods: verificationMethodEnum("verification_methods").array().notNull().default(["id_upload"]),
  emailDomains: text("email_domains").array().notNull().default([]),
  badgeValidityMonths: integer("badge_validity_months").notNull().default(12),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Group Whitelist
export const groupWhitelist = pgTable("group_whitelist", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => affiliationGroups.id, { onDelete: "cascade" }),
  membershipNumber: text("membership_number").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupMembershipUnique: uniqueIndex().on(table.groupId, table.membershipNumber),
}));

// User Memberships
export const userMemberships = pgTable("user_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  groupId: uuid("group_id").notNull().references(() => affiliationGroups.id, { onDelete: "restrict" }),
  method: verificationMethodEnum("method").notNull(),
  membershipNumber: text("membership_number"),
  idDocumentUrl: text("id_document_url"),
  submittedEmail: text("submitted_email"),
  status: membershipStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Brands
export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Deals
export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
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
  startDate: timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  totalCap: integer("total_cap"),
  status: dealStatusEnum("status").notNull().default("draft"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Saved Deals
export const savedDeals = pgTable("saved_deals", {
  userId: uuid("user_id").notNull(),
  dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.dealId] }),
}));

// Transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
});

// Commission Invoices
export const commissionInvoices = pgTable("commission_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  paystackRef: text("paystack_ref"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 6: Write apps/api/src/db/client.ts**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const queryClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(queryClient, { schema });

export type Db = typeof db;
```

- [ ] **Step 7: Verify compilation**

Run: `bun run --cwd apps/api db:generate`
Expected: drizzle generates initial migration in `apps/api/drizzle/`

If no DATABASE_URL is set, the push/migrate commands will fail, but `db:generate`
needs at minimum a valid connection string. Set a dummy DATABASE_URL if needed:
`$env:DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"`

- [ ] **Step 8: Commit**

```
git add apps/api/package.json apps/api/tsconfig.json apps/api/drizzle.config.ts apps/api/src/db/
git commit -m "feat: add Drizzle schema and DB client for API"
```

---

### Task 3: API Infrastructure — Hono App, Middleware, Error Handling

**Files:**
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/error.ts`

**Interfaces:**
- Produces: Hono app in `src/index.ts` that mounts routes under `/api`, exports `createApp()` for testing
- Produces: `requireAuth` middleware (extracts Clerk user), `requireRole(role)` middleware
- Produces: `errorHandler` middleware

- [ ] **Step 1: Write apps/api/src/middleware/auth.ts**

```typescript
import { createClerkClient, type AuthObject } from "@clerk/backend";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppRole } from "@perkhub/shared";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthObject;
    userId: string;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) {
    return c.json({ error: "Unauthorized: No token provided" }, 401);
  }
  try {
    const auth = await clerkClient.authenticateRequest({
      request: c.req.raw,
    });
    if (!auth.isSignedIn) {
      return c.json({ error: "Unauthorized: Invalid session" }, 401);
    }
    c.set("auth", auth);
    c.set("userId", auth.userId!);
    await next();
  } catch {
    return c.json({ error: "Unauthorized: Invalid session" }, 401);
  }
});

export function requireRole(...roles: AppRole[]) {
  return createMiddleware(async (c, next) => {
    const { userId } = c.var;
    const userRoles = await getRolesFromDb(userId);
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }
    await next();
  });
}

// Imported dynamically to avoid circular deps
async function getRolesFromDb(userId: string): Promise<AppRole[]> {
  const { db } = await import("../db/client");
  const { userRoles } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role as AppRole);
}

// For Clerk webhook — no auth header, svix verification
export const requireWebhookSignature = createMiddleware(async (c, next) => {
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing webhook headers" }, 401);
  }
  const { Webhook } = await import("svix");
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const body = await c.req.text();
  try {
    wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    c.set("rawBody", body);
    await next();
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }
});

declare module "hono" {
  interface ContextVariableMap {
    rawBody?: string;
  }
}
```

- [ ] **Step 2: Write apps/api/src/middleware/error.ts**

```typescript
import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  return c.json(
    { error: status === 500 ? "Internal server error" : err.message },
    status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
  );
};
```

- [ ] **Step 3: Write apps/api/src/index.ts**

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { errorHandler } from "./middleware/error";

export function createApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  // Routes — mounted as they're built in subsequent tasks
  // mountRoute(app, "/api/auth", authRoutes);
  // mountRoute(app, "/api/profiles", profileRoutes);
  // ...

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = parseInt(process.env.API_PORT || "3001", 10);
  serve({ fetch: app.fetch, port });
  console.log(`API server running at http://localhost:${port}`);
}
```

- [ ] **Step 4: Write test for health endpoint**

Create `apps/api/src/__tests__/health.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "../index";

describe("GET /api/health", () => {
  it("should return ok status", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run --cwd apps/api test`
Expected: Test passes

- [ ] **Step 6: Commit**

```
git add apps/api/src/index.ts apps/api/src/middleware/ apps/api/src/__tests__/health.test.ts
git commit -m "feat: set up Hono app with auth and error middleware"
```

---

### Task 4: Repositories — Database Access Layer

**Files:**
- Create: `apps/api/src/repositories/profiles.repo.ts`
- Create: `apps/api/src/repositories/userRoles.repo.ts`
- Create: `apps/api/src/repositories/groups.repo.ts`
- Create: `apps/api/src/repositories/whitelist.repo.ts`
- Create: `apps/api/src/repositories/memberships.repo.ts`
- Create: `apps/api/src/repositories/brands.repo.ts`
- Create: `apps/api/src/repositories/deals.repo.ts`
- Create: `apps/api/src/repositories/savedDeals.repo.ts`
- Create: `apps/api/src/repositories/transactions.repo.ts`
- Create: `apps/api/src/repositories/invoices.repo.ts`

**Interfaces:**
- Each repo exports CRUD functions taking `db` as first param
- All `update()` functions set `updatedAt: new Date()`
- Consumes: `db` from `../db/client`, schema from `../db/schema`

- [ ] **Step 1: Write profiles.repo.ts**

```typescript
import type { Db } from "../db/client";
import { profiles } from "../db/schema";
import { eq } from "drizzle-orm";

export interface CreateProfileInput {
  id: string;
  fullName?: string | null;
}

export async function getProfile(db: Db, id: string) {
  const rows = await db.select().from(profiles).where(eq(profiles.id, id));
  return rows[0] ?? null;
}

export async function createProfile(db: Db, input: CreateProfileInput) {
  const rows = await db
    .insert(profiles)
    .values({ id: input.id, fullName: input.fullName ?? null })
    .returning();
  return rows[0];
}

export async function updateProfile(
  db: Db,
  id: string,
  data: Partial<Omit<typeof profiles.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(profiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(profiles.id, id))
    .returning();
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Write userRoles.repo.ts**

```typescript
import type { Db } from "../db/client";
import { userRoles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { AppRole } from "@perkhub/shared";

export async function getRolesForUser(db: Db, userId: string) {
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function addRole(db: Db, userId: string, role: AppRole) {
  const rows = await db
    .insert(userRoles)
    .values({ userId, role })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function removeRole(db: Db, userId: string, role: AppRole) {
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
}

export async function hasRole(db: Db, userId: string, role: AppRole) {
  const rows = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  return rows.length > 0;
}
```

- [ ] **Step 3: Write groups.repo.ts**

```typescript
import type { Db } from "../db/client";
import { affiliationGroups, groupWhitelist } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import type { AffiliationType, VerificationMethod } from "@perkhub/shared";

export interface CreateGroupInput {
  name: string;
  type: AffiliationType;
  description?: string | null;
  verificationMethods?: VerificationMethod[];
  emailDomains?: string[];
  badgeValidityMonths?: number;
}

export async function listGroups(db: Db) {
  return db.select().from(affiliationGroups);
}

export async function getGroup(db: Db, id: string) {
  const rows = await db.select().from(affiliationGroups).where(eq(affiliationGroups.id, id));
  return rows[0] ?? null;
}

export async function createGroup(db: Db, input: CreateGroupInput) {
  const rows = await db.insert(affiliationGroups).values(input).returning();
  return rows[0];
}

export async function updateGroup(db: Db, id: string, data: Parameters<typeof db.update>[1]) {
  const rows = await db
    .update(affiliationGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(affiliationGroups.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteGroup(db: Db, id: string) {
  await db.delete(affiliationGroups).where(eq(affiliationGroups.id, id));
}
```

- [ ] **Step 4: Write whitelist.repo.ts**

```typescript
import type { Db } from "../db/client";
import { groupWhitelist } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function listWhitelist(db: Db, groupId: string) {
  return db.select().from(groupWhitelist).where(eq(groupWhitelist.groupId, groupId));
}

export async function addWhitelistEntry(
  db: Db,
  groupId: string,
  membershipNumber: string,
  fullName?: string | null,
) {
  const rows = await db
    .insert(groupWhitelist)
    .values({ groupId, membershipNumber, fullName: fullName ?? null })
    .returning();
  return rows[0];
}

export async function removeWhitelistEntry(db: Db, id: string) {
  await db.delete(groupWhitelist).where(eq(groupWhitelist.id, id));
}

export async function whitelistEntryExists(db: Db, groupId: string, membershipNumber: string) {
  const rows = await db
    .select()
    .from(groupWhitelist)
    .where(
      and(
        eq(groupWhitelist.groupId, groupId),
        sql`lower(${groupWhitelist.membershipNumber}) = lower(${membershipNumber})`,
      ),
    );
  return rows.length > 0;
}
```

- [ ] **Step 5: Write memberships.repo.ts**

```typescript
import type { Db } from "../db/client";
import { userMemberships } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import type { VerificationMethod } from "@perkhub/shared";

export interface CreateMembershipInput {
  userId: string;
  groupId: string;
  method: VerificationMethod;
  membershipNumber?: string | null;
  idDocumentUrl?: string | null;
  submittedEmail?: string | null;
}

export async function listMembershipsForUser(db: Db, userId: string) {
  return db
    .select()
    .from(userMemberships)
    .where(eq(userMemberships.userId, userId))
    .orderBy(desc(userMemberships.createdAt));
}

export async function getMembership(db: Db, id: string) {
  const rows = await db.select().from(userMemberships).where(eq(userMemberships.id, id));
  return rows[0] ?? null;
}

export async function createMembership(db: Db, input: CreateMembershipInput) {
  const rows = await db.insert(userMemberships).values(input).returning();
  return rows[0];
}

export async function updateMembership(
  db: Db,
  id: string,
  data: Partial<Omit<typeof userMemberships.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(userMemberships)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userMemberships.id, id))
    .returning();
  return rows[0] ?? null;
}
```

- [ ] **Step 6: Write brands.repo.ts**

```typescript
import type { Db } from "../db/client";
import { brands } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function listBrands(db: Db) {
  return db.select().from(brands).orderBy(desc(brands.createdAt));
}

export async function getBrand(db: Db, id: string) {
  const rows = await db.select().from(brands).where(eq(brands.id, id));
  return rows[0] ?? null;
}

export async function createBrand(db: Db, data: typeof brands.$inferInsert) {
  const rows = await db.insert(brands).values(data).returning();
  return rows[0];
}

export async function updateBrand(
  db: Db,
  id: string,
  data: Partial<Omit<typeof brands.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(brands)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brands.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteBrand(db: Db, id: string) {
  await db.delete(brands).where(eq(brands.id, id));
}
```

- [ ] **Step 7: Write deals.repo.ts**

```typescript
import type { Db } from "../db/client";
import { deals } from "../db/schema";
import { eq, and, desc, inArray, gte, lte, or } from "drizzle-orm";
import type { DealStatus } from "@perkhub/shared";

export interface ListDealsFilter {
  status?: DealStatus;
  brandId?: string;
  groupIds?: string[];
}

export async function listDeals(db: Db, filter?: ListDealsFilter) {
  const conditions = [];
  if (filter?.status) conditions.push(eq(deals.status, filter.status));
  if (filter?.brandId) conditions.push(eq(deals.brandId, filter.brandId));
  const query = db.select().from(deals);
  if (conditions.length > 0) query.where(and(...conditions));
  return query.orderBy(desc(deals.createdAt));
}

export async function getDeal(db: Db, id: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, id));
  return rows[0] ?? null;
}

export async function createDeal(db: Db, data: typeof deals.$inferInsert) {
  const rows = await db.insert(deals).values(data).returning();
  return rows[0];
}

export async function updateDeal(
  db: Db,
  id: string,
  data: Partial<Omit<typeof deals.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteDeal(db: Db, id: string) {
  await db.delete(deals).where(eq(deals.id, id));
}
```

- [ ] **Step 8: Write savedDeals.repo.ts**

```typescript
import type { Db } from "../db/client";
import { savedDeals } from "../db/schema";
import { eq, and } from "drizzle-orm";

export async function listSavedDeals(db: Db, userId: string) {
  return db.select().from(savedDeals).where(eq(savedDeals.userId, userId));
}

export async function saveDeal(db: Db, userId: string, dealId: string) {
  const rows = await db
    .insert(savedDeals)
    .values({ userId, dealId })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function unsaveDeal(db: Db, userId: string, dealId: string) {
  await db
    .delete(savedDeals)
    .where(and(eq(savedDeals.userId, userId), eq(savedDeals.dealId, dealId)));
}
```

- [ ] **Step 9: Write transactions.repo.ts**

```typescript
import type { Db } from "../db/client";
import { transactions } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function listTransactions(db: Db, filter?: { userId?: string; brandId?: string }) {
  const conditions = [];
  if (filter?.userId) conditions.push(eq(transactions.userId, filter.userId));
  if (filter?.brandId) conditions.push(eq(transactions.brandId, filter.brandId));
  const query = db.select().from(transactions);
  if (conditions.length > 0) query.where(and(...conditions));
  return query.orderBy(desc(transactions.createdAt));
}

export async function getTransaction(db: Db, id: string) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id));
  return rows[0] ?? null;
}

export async function createTransaction(db: Db, data: typeof transactions.$inferInsert) {
  const rows = await db.insert(transactions).values(data).returning();
  return rows[0];
}

export async function updateTransaction(
  db: Db,
  id: string,
  data: Partial<Omit<typeof transactions.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(transactions)
    .set(data)
    .where(eq(transactions.id, id))
    .returning();
  return rows[0] ?? null;
}
```

- [ ] **Step 10: Write invoices.repo.ts**

```typescript
import type { Db } from "../db/client";
import { commissionInvoices } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function listInvoices(db: Db, brandId?: string) {
  const query = db.select().from(commissionInvoices);
  if (brandId) query.where(eq(commissionInvoices.brandId, brandId));
  return query.orderBy(desc(commissionInvoices.createdAt));
}

export async function getInvoice(db: Db, id: string) {
  const rows = await db
    .select()
    .from(commissionInvoices)
    .where(eq(commissionInvoices.id, id));
  return rows[0] ?? null;
}

export async function createInvoice(db: Db, data: typeof commissionInvoices.$inferInsert) {
  const rows = await db.insert(commissionInvoices).values(data).returning();
  return rows[0];
}

export async function updateInvoice(
  db: Db,
  id: string,
  data: Partial<Omit<typeof commissionInvoices.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(commissionInvoices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(commissionInvoices.id, id))
    .returning();
  return rows[0] ?? null;
}
```

- [ ] **Step 11: Verify compilation**

Run: `bun run --cwd apps/api lint` (or `tsc --noEmit` if eslint not configured)
Expected: No type errors

- [ ] **Step 12: Commit**

```
git add apps/api/src/repositories/
git commit -m "feat: add repository layer for all tables"
```

---

### Task 5: Services — Business Logic

**Files:**
- Create: `apps/api/src/services/auth.service.ts`
- Create: `apps/api/src/services/membership.service.ts`
- Create: `apps/api/src/services/transaction.service.ts`
- Create: `apps/api/src/services/storage.service.ts`
- Create: `apps/api/src/services/__tests__/membership.service.test.ts`

**Interfaces:**
- `authService.syncUser(clerkUser)` — creates profile + default consumer role
- `membershipService.autoVerify(membership, group)` — port of tg_auto_verify_membership
- `membershipService.stampExpiry(membership)` — port of tg_stamp_membership_expiry
- `transactionService.calculateCommission(deal, brand, finalPrice)` — commission calc
- `storageService.getPresignedUploadUrl(key)`, `getPresignedDownloadUrl(key)` — R2 URLs

- [ ] **Step 1: Write auth.service.ts**

```typescript
import type { Db } from "../db/client";
import * as profilesRepo from "../repositories/profiles.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";
import type { ClerkWebhookEvent } from "@perkhub/shared";

export async function handleUserCreated(db: Db, event: ClerkWebhookEvent) {
  const { id, email_addresses, first_name, last_name, public_metadata } = event.data;
  const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

  await profilesRepo.createProfile(db, { id, fullName });
  await userRolesRepo.addRole(db, id, "consumer");

  const intendedRole = public_metadata?.intended_role as string | undefined;
  if (intendedRole === "brand" || intendedRole === "brand_partner") {
    await userRolesRepo.addRole(db, id, "brand_partner");
  }
}

export async function handleUserUpdated(db: Db, event: ClerkWebhookEvent) {
  const { id, first_name, last_name } = event.data;
  const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;
  await profilesRepo.updateProfile(db, id, { fullName });
}

export async function handleUserDeleted(db: Db, event: ClerkWebhookEvent) {
  const { id } = event.data;
  await profilesRepo.updateProfile(db, id, { fullName: null, avatarUrl: null });
}
```

- [ ] **Step 2: Write membership.service.ts**

```typescript
import type { Db } from "../db/client";
import * as membershipsRepo from "../repositories/memberships.repo";
import * as groupsRepo from "../repositories/groups.repo";
import * as whitelistRepo from "../repositories/whitelist.repo";
import type { CreateMembershipInput } from "../repositories/memberships.repo";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function createAndAutoVerify(db: Db, input: CreateMembershipInput) {
  const group = await groupsRepo.getGroup(db, input.groupId);
  if (!group) throw new Error("Group not found");

  let status: string = "pending";
  let verifiedAt: Date | null = null;
  let expiresAt: Date | null = null;

  // Auto-verify logic ported from tg_auto_verify_membership
  let matched = false;

  if (input.method === "email_domain" && group.emailDomains.length > 0) {
    const clerkUser = await clerkClient.users.getUser(input.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (email) {
      const domain = email.split("@")[1]?.toLowerCase();
      matched = group.emailDomains.map((d) => d.toLowerCase()).includes(domain ?? "");
    }
  }

  if (!matched && input.method === "membership_number" && input.membershipNumber) {
    matched = await whitelistRepo.whitelistEntryExists(db, input.groupId, input.membershipNumber);
  }

  if (matched) {
    status = "verified";
    verifiedAt = new Date();
    expiresAt = new Date(verifiedAt.getTime() + group.badgeValidityMonths * 30 * 24 * 60 * 60 * 1000);
  }

  const membership = await membershipsRepo.createMembership(db, {
    ...input,
    status: status as any,
    verifiedAt,
    expiresAt,
  });

  return membership;
}

export async function stampExpiryOnVerification(
  db: Db,
  id: string,
  data: { status: string; rejectionReason?: string | null },
) {
  const existing = await membershipsRepo.getMembership(db, id);
  if (!existing) throw new Error("Membership not found");

  const updateData: Record<string, unknown> = { status: data.status, rejectionReason: data.rejectionReason ?? null };

  if (data.status === "verified" && existing.status !== "verified") {
    const group = await groupsRepo.getGroup(db, existing.groupId);
    if (group) {
      updateData.verifiedAt = existing.verifiedAt ?? new Date();
      updateData.expiresAt = new Date(
        (updateData.verifiedAt as Date).getTime() + group.badgeValidityMonths * 30 * 24 * 60 * 60 * 1000,
      );
    }
  }

  return membershipsRepo.updateMembership(db, id, updateData as any);
}
```

- [ ] **Step 3: Write transaction.service.ts**

```typescript
import type { Db } from "../db/client";
import * as transactionsRepo from "../repositories/transactions.repo";
import * as brandsRepo from "../repositories/brands.repo";
import * as dealsRepo from "../repositories/deals.repo";
import crypto from "crypto";

export interface CreateTransactionInput {
  userId: string;
  dealId: string;
  brandId: string;
  groupId?: string | null;
  method: "online" | "instore" | "both";
  originalPrice?: number | null;
  finalPrice?: number | null;
  discountApplied?: number;
}

function calculateCommission(
  finalPrice: number | null,
  commissionType: "percent" | "flat",
  commissionRate: number,
): number {
  if (!finalPrice) return 0;
  if (commissionType === "percent") {
    return (finalPrice * commissionRate) / 100;
  }
  return commissionRate; // flat
}

function generateRedemptionCode(): string {
  return `PRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createTransaction(db: Db, input: CreateTransactionInput) {
  const brand = await brandsRepo.getBrand(db, input.brandId);
  if (!brand) throw new Error("Brand not found");

  const deal = await dealsRepo.getDeal(db, input.dealId);
  if (!deal) throw new Error("Deal not found");

  const finalPrice = input.finalPrice ?? null;
  const discountApplied = input.discountApplied ?? 0;
  const commissionAmount = calculateCommission(finalPrice, brand.commissionType, Number(brand.commissionRate));

  return transactionsRepo.createTransaction(db, {
    userId: input.userId,
    dealId: input.dealId,
    brandId: input.brandId,
    groupId: input.groupId ?? null,
    method: input.method,
    originalPrice: input.originalPrice?.toString() ?? null,
    finalPrice: finalPrice?.toString() ?? null,
    discountApplied: discountApplied.toString(),
    commissionType: brand.commissionType,
    commissionRate: brand.commissionRate.toString(),
    commissionAmount: commissionAmount.toString(),
    commissionStatus: "pending",
    status: "redeemed",
    redemptionCode: generateRedemptionCode(),
    redeemedAt: new Date(),
  });
}
```

- [ ] **Step 4: Write storage.service.ts**

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}
```

- [ ] **Step 5: Write membership.service test**

Create `apps/api/src/services/__tests__/membership.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../db/client", () => ({ db: {} }));
vi.mock("../../repositories/groups.repo", () => ({ getGroup: vi.fn() }));
vi.mock("../../repositories/whitelist.repo", () => ({ whitelistEntryExists: vi.fn() }));
vi.mock("../../repositories/memberships.repo", () => ({ createMembership: vi.fn() }));
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      getUser: vi.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: "test@unilag.edu.ng" }],
      }),
    },
  }),
}));

import * as groupsRepo from "../../repositories/groups.repo";
import * as whitelistRepo from "../../repositories/whitelist.repo";
import * as membershipsRepo from "../../repositories/memberships.repo";
import { createAndAutoVerify } from "../membership.service";

describe("createAndAutoVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should auto-verify via email domain match", async () => {
    vi.mocked(groupsRepo.getGroup).mockResolvedValue({
      id: "group-1",
      emailDomains: ["unilag.edu.ng"],
      badgeValidityMonths: 24,
      verificationMethods: ["email_domain"],
      active: true,
      name: "UNILAG Alumni",
      type: "alumni",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(membershipsRepo.createMembership).mockResolvedValue({
      id: "mem-1",
      userId: "user-1",
      groupId: "group-1",
      method: "email_domain",
      status: "verified",
      verifiedAt: new Date(),
      expiresAt: new Date(),
      membershipNumber: null,
      idDocumentUrl: null,
      submittedEmail: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createAndAutoVerify({} as any, {
      userId: "user-1",
      groupId: "group-1",
      method: "email_domain",
    });

    expect(result.status).toBe("verified");
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("should auto-verify via membership number whitelist", async () => {
    vi.mocked(groupsRepo.getGroup).mockResolvedValue({
      id: "group-2",
      emailDomains: [],
      badgeValidityMonths: 12,
      verificationMethods: ["membership_number"],
      active: true,
      name: "NYSC",
      type: "nysc",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(whitelistRepo.whitelistEntryExists).mockResolvedValue(true);
    vi.mocked(membershipsRepo.createMembership).mockResolvedValue({
      id: "mem-2",
      userId: "user-2",
      groupId: "group-2",
      method: "membership_number",
      status: "verified",
      verifiedAt: new Date(),
      expiresAt: new Date(),
      membershipNumber: "NYSC/2023/12345",
      idDocumentUrl: null,
      submittedEmail: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createAndAutoVerify({} as any, {
      userId: "user-2",
      groupId: "group-2",
      method: "membership_number",
      membershipNumber: "NYSC/2023/12345",
    });

    expect(result.status).toBe("verified");
  });

  it("should create pending membership when no match", async () => {
    vi.mocked(groupsRepo.getGroup).mockResolvedValue({
      id: "group-3",
      emailDomains: [],
      badgeValidityMonths: 12,
      verificationMethods: ["id_upload"],
      active: true,
      name: "Some Group",
      type: "professional",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(membershipsRepo.createMembership).mockResolvedValue({
      id: "mem-3",
      userId: "user-3",
      groupId: "group-3",
      method: "id_upload",
      status: "pending",
      verifiedAt: null,
      expiresAt: null,
      membershipNumber: null,
      idDocumentUrl: null,
      submittedEmail: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createAndAutoVerify({} as any, {
      userId: "user-3",
      groupId: "group-3",
      method: "id_upload",
    });

    expect(result.status).toBe("pending");
  });
});
```

- [ ] **Step 6: Run tests**

Run: `bun run --cwd apps/api test`
Expected: Tests pass

- [ ] **Step 7: Commit**

```
git add apps/api/src/services/ apps/api/src/services/__tests__/
git commit -m "feat: add service layer with business logic (auth, membership, transaction, storage)"
```

---

### Task 6: Auth Routes — Clerk Webhook Handler

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts` (mount auth routes)

**Interfaces:**
- Consumes: `auth.service` handlers, `requireWebhookSignature` middleware
- Produces: `POST /api/auth/clerk-webhook` endpoint

- [ ] **Step 1: Write apps/api/src/routes/auth.ts**

```typescript
import { Hono } from "hono";
import { requireWebhookSignature } from "../middleware/auth";
import { handleUserCreated, handleUserUpdated, handleUserDeleted } from "../services/auth.service";
import { db } from "../db/client";
import type { ClerkWebhookEvent } from "@perkhub/shared";

export const authRoutes = new Hono();

authRoutes.post("/clerk-webhook", requireWebhookSignature, async (c) => {
  const rawBody = c.var.rawBody!;
  const event: ClerkWebhookEvent = JSON.parse(rawBody);

  try {
    switch (event.type) {
      case "user.created":
        await handleUserCreated(db, event);
        break;
      case "user.updated":
        await handleUserUpdated(db, event);
        break;
      case "user.deleted":
        await handleUserDeleted(db, event);
        break;
    }
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error(`[Webhook] Error handling ${event.type}:`, err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});
```

- [ ] **Step 2: Mount auth routes in index.ts**

Edit `apps/api/src/index.ts`:

```typescript
import { authRoutes } from "./routes/auth";
// ... after app creation
app.route("/api/auth", authRoutes);
```

- [ ] **Step 3: Commit**

```
git add apps/api/src/routes/auth.ts apps/api/src/index.ts
git commit -m "feat: add Clerk webhook endpoint for user sync"
```

---

### Task 7: Profiles & Roles Routes

**Files:**
- Create: `apps/api/src/routes/profiles.ts`
- Create: `apps/api/src/routes/roles.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole` middleware
- Consumes: `profiles.repo`, `userRoles.repo`

- [ ] **Step 1: Write profiles.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as profilesRepo from "../repositories/profiles.repo";

export const profileRoutes = new Hono();

profileRoutes.use("/*", requireAuth);

profileRoutes.get("/me", async (c) => {
  const userId = c.var.userId;
  const profile = await profilesRepo.getProfile(db, userId);
  if (!profile) return c.json({ error: "Profile not found" }, 404);
  return c.json(profile);
});

profileRoutes.patch("/me", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const allowed = ["fullName", "phone", "state", "lga", "avatarUrl"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const profile = await profilesRepo.updateProfile(db, userId, updates);
  return c.json(profile);
});
```

- [ ] **Step 2: Write roles.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const roleRoutes = new Hono();

roleRoutes.use("/*", requireAuth);

roleRoutes.get("/me", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  return c.json(roles);
});

roleRoutes.post("/", requireRole("admin"), async (c) => {
  const { userId, role } = await c.req.json();
  const result = await userRolesRepo.addRole(db, userId, role);
  return c.json(result, 201);
});

roleRoutes.delete("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  await userRolesRepo.removeRole(db, id, c.req.query("role") as any);
  return c.json({ success: true });
});
```

- [ ] **Step 3: Mount routes in index.ts**

```
app.route("/api/profiles", profileRoutes);
app.route("/api/roles", roleRoutes);
```

- [ ] **Step 4: Commit**

```
git add apps/api/src/routes/profiles.ts apps/api/src/routes/roles.ts apps/api/src/index.ts
git commit -m "feat: add profiles and roles routes"
```

---

### Task 8: Groups & Memberships Routes

**Files:**
- Create: `apps/api/src/routes/groups.ts`
- Create: `apps/api/src/routes/memberships.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `groups.repo`, `whitelist.repo`, `membership.service`

- [ ] **Step 1: Write groups.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as groupsRepo from "../repositories/groups.repo";
import * as whitelistRepo from "../repositories/whitelist.repo";

export const groupRoutes = new Hono();

// Public: list active groups
groupRoutes.get("/", async (c) => {
  const groups = await groupsRepo.listGroups(db);
  return c.json(groups.filter((g) => g.active));
});

// Public: get single group
groupRoutes.get("/:id", async (c) => {
  const group = await groupsRepo.getGroup(db, c.req.param("id"));
  if (!group) return c.json({ error: "Group not found" }, 404);
  return c.json(group);
});

// Admin: all CRUD
groupRoutes.post("/", requireAuth, requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const group = await groupsRepo.createGroup(db, body);
  return c.json(group, 201);
});

groupRoutes.patch("/:id", requireAuth, requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const group = await groupsRepo.updateGroup(db, c.req.param("id"), body);
  if (!group) return c.json({ error: "Group not found" }, 404);
  return c.json(group);
});

groupRoutes.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  await groupsRepo.deleteGroup(db, c.req.param("id"));
  return c.json({ success: true });
});

// Whitelist (admin only)
groupRoutes.get("/:id/whitelist", requireAuth, requireRole("admin"), async (c) => {
  const entries = await whitelistRepo.listWhitelist(db, c.req.param("id"));
  return c.json(entries);
});

groupRoutes.post("/:id/whitelist", requireAuth, requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const entry = await whitelistRepo.addWhitelistEntry(db, c.req.param("id"), body.membershipNumber, body.fullName);
  return c.json(entry, 201);
});

groupRoutes.delete("/:id/whitelist/:entryId", requireAuth, requireRole("admin"), async (c) => {
  await whitelistRepo.removeWhitelistEntry(db, c.req.param("entryId"));
  return c.json({ success: true });
});
```

- [ ] **Step 2: Write memberships.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as membershipsRepo from "../repositories/memberships.repo";
import { createAndAutoVerify, stampExpiryOnVerification } from "../services/membership.service";

export const membershipRoutes = new Hono();

membershipRoutes.use("/*", requireAuth);

membershipRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const hasRole = await import("../repositories/userRoles.repo").then((r) =>
    r.hasRole(db, userId, "admin"),
  );
  if (hasRole && c.req.query("userId")) {
    const memberships = await membershipsRepo.listMembershipsForUser(db, c.req.query("userId")!);
    return c.json(memberships);
  }
  const memberships = await membershipsRepo.listMembershipsForUser(db, userId);
  return c.json(memberships);
});

membershipRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const membership = await createAndAutoVerify(db, { ...body, userId });
  return c.json(membership, 201);
});

membershipRoutes.get("/:id", async (c) => {
  const membership = await membershipsRepo.getMembership(db, c.req.param("id"));
  if (!membership) return c.json({ error: "Membership not found" }, 404);
  return c.json(membership);
});

// Admin: update status (verify/reject)
membershipRoutes.patch("/:id", requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const membership = await stampExpiryOnVerification(db, c.req.param("id"), body);
  return c.json(membership);
});
```

- [ ] **Step 3: Mount routes in index.ts**

```
app.route("/api/groups", groupRoutes);
app.route("/api/memberships", membershipRoutes);
```

- [ ] **Step 4: Commit**

```
git add apps/api/src/routes/groups.ts apps/api/src/routes/memberships.ts apps/api/src/index.ts
git commit -m "feat: add groups and memberships routes with auto-verify logic"
```

---

### Task 9: Brands & Deals Routes

**Files:**
- Create: `apps/api/src/routes/brands.ts`
- Create: `apps/api/src/routes/deals.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `brands.repo`, `deals.repo`

- [ ] **Step 1: Write brands.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as brandsRepo from "../repositories/brands.repo";

export const brandRoutes = new Hono();

// Public: list approved brands
brandRoutes.get("/", async (c) => {
  const allBrands = await brandsRepo.listBrands(db);
  return c.json(allBrands.filter((b) => b.status === "approved"));
});

// Public: get single brand
brandRoutes.get("/:id", async (c) => {
  const brand = await brandsRepo.getBrand(db, c.req.param("id"));
  if (!brand) return c.json({ error: "Brand not found" }, 404);
  return c.json(brand);
});

// Auth: create brand
brandRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const brand = await brandsRepo.createBrand(db, { ...body, ownerUserId: userId });
  return c.json(brand, 201);
});

// Auth: update own brand (or admin)
brandRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const brand = await brandsRepo.getBrand(db, c.req.param("id"));
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const roles = await import("../repositories/userRoles.repo").then((r) => r.getRolesForUser(db, userId));
  const isAdmin = roles.some((r) => r.role === "admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updated = await brandsRepo.updateBrand(db, c.req.param("id"), body);
  return c.json(updated);
});

// Admin: delete brand
brandRoutes.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  await brandsRepo.deleteBrand(db, c.req.param("id"));
  return c.json({ success: true });
});
```

- [ ] **Step 2: Write deals.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as dealsRepo from "../repositories/deals.repo";
import * as brandsRepo from "../repositories/brands.repo";

export const dealRoutes = new Hono();

// Public: list published deals
dealRoutes.get("/", async (c) => {
  const allDeals = await dealsRepo.listDeals(db);
  return c.json(allDeals.filter((d) => d.status === "published"));
});

// Public: get single deal
dealRoutes.get("/:id", async (c) => {
  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);
  return c.json(deal);
});

// Auth: create deal (brand owner)
dealRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const brand = await brandsRepo.getBrand(db, body.brandId);
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const roles = await import("../repositories/userRoles.repo").then((r) => r.getRolesForUser(db, userId));
  const isAdmin = roles.some((r) => r.role === "admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden: Not your brand" }, 403);
  }

  const deal = await dealsRepo.createDeal(db, body);
  return c.json(deal, 201);
});

// Auth: update deal (brand owner or admin)
dealRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);

  const brand = await brandsRepo.getBrand(db, deal.brandId);
  const roles = await import("../repositories/userRoles.repo").then((r) => r.getRolesForUser(db, userId));
  const isAdmin = roles.some((r) => r.role === "admin");
  if (brand?.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updated = await dealsRepo.updateDeal(db, c.req.param("id"), body);
  return c.json(updated);
});

dealRoutes.delete("/:id", requireAuth, requireRole("admin"), async (c) => {
  await dealsRepo.deleteDeal(db, c.req.param("id"));
  return c.json({ success: true });
});
```

- [ ] **Step 3: Mount routes in index.ts**

```
app.route("/api/brands", brandRoutes);
app.route("/api/deals", dealRoutes);
```

- [ ] **Step 4: Commit**

```
git add apps/api/src/routes/brands.ts apps/api/src/routes/deals.ts apps/api/src/index.ts
git commit -m "feat: add brands and deals routes with ownership checks"
```

---

### Task 10: Saved Deals, Transactions & Invoices Routes

**Files:**
- Create: `apps/api/src/routes/saved-deals.ts`
- Create: `apps/api/src/routes/transactions.ts`
- Create: `apps/api/src/routes/invoices.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `savedDeals.repo`, `transactions.repo`, `invoices.repo`, `transaction.service`

- [ ] **Step 1: Write saved-deals.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as savedDealsRepo from "../repositories/savedDeals.repo";

export const savedDealRoutes = new Hono();

savedDealRoutes.use("/*", requireAuth);

savedDealRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const deals = await savedDealsRepo.listSavedDeals(db, userId);
  return c.json(deals);
});

savedDealRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const { dealId } = await c.req.json();
  const saved = await savedDealsRepo.saveDeal(db, userId, dealId);
  return c.json(saved, 201);
});

savedDealRoutes.delete("/:dealId", async (c) => {
  const userId = c.var.userId;
  await savedDealsRepo.unsaveDeal(db, userId, c.req.param("dealId"));
  return c.json({ success: true });
});
```

- [ ] **Step 2: Write transactions.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as transactionsRepo from "../repositories/transactions.repo";
import { createTransaction } from "../services/transaction.service";

export const transactionRoutes = new Hono();

transactionRoutes.use("/*", requireAuth);

transactionRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const roles = await import("../repositories/userRoles.repo").then((r) => r.getRolesForUser(db, userId));
  const isAdmin = roles.some((r) => r.role === "admin");
  const isBrand = roles.some((r) => r.role === "brand_partner");

  if (isAdmin && c.req.query("userId")) {
    return c.json(await transactionsRepo.listTransactions(db, { userId: c.req.query("userId")! }));
  }
  if (isBrand && c.req.query("brandId")) {
    return c.json(await transactionsRepo.listTransactions(db, { brandId: c.req.query("brandId")! }));
  }
  return c.json(await transactionsRepo.listTransactions(db, { userId }));
});

transactionRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const transaction = await createTransaction(db, { ...body, userId });
  return c.json(transaction, 201);
});

transactionRoutes.get("/:id", async (c) => {
  const transaction = await transactionsRepo.getTransaction(db, c.req.param("id"));
  if (!transaction) return c.json({ error: "Transaction not found" }, 404);
  return c.json(transaction);
});
```

- [ ] **Step 3: Write invoices.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as invoicesRepo from "../repositories/invoices.repo";

export const invoiceRoutes = new Hono();

invoiceRoutes.use("/*", requireAuth);

invoiceRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const roles = await import("../repositories/userRoles.repo").then((r) => r.getRolesForUser(db, userId));
  const isAdmin = roles.some((r) => r.role === "admin");
  const isBrand = roles.some((r) => r.role === "brand_partner");

  if (isAdmin) {
    return c.json(await invoicesRepo.listInvoices(db));
  }
  if (isBrand && c.req.query("brandId")) {
    return c.json(await invoicesRepo.listInvoices(db, c.req.query("brandId")!));
  }
  return c.json([]);
});

invoiceRoutes.get("/:id", async (c) => {
  const invoice = await invoicesRepo.getInvoice(db, c.req.param("id"));
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  return c.json(invoice);
});

invoiceRoutes.post("/", requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const invoice = await invoicesRepo.createInvoice(db, body);
  return c.json(invoice, 201);
});

invoiceRoutes.patch("/:id", requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const invoice = await invoicesRepo.updateInvoice(db, c.req.param("id"), body);
  return c.json(invoice);
});
```

- [ ] **Step 4: Mount routes in index.ts**

```
app.route("/api/saved-deals", savedDealRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/invoices", invoiceRoutes);
```

- [ ] **Step 5: Commit**

```
git add apps/api/src/routes/saved-deals.ts apps/api/src/routes/transactions.ts apps/api/src/routes/invoices.ts apps/api/src/index.ts
git commit -m "feat: add saved deals, transactions, and invoices routes"
```

---

### Task 11: Admin & Storage Routes

**Files:**
- Create: `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/routes/storage.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write admin.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";
import { profiles } from "../db/schema";
import { userMemberships } from "../db/schema";
import { count } from "drizzle-orm";

export const adminRoutes = new Hono();

adminRoutes.use("/*", requireAuth, requireRole("admin"));

adminRoutes.get("/stats", async (c) => {
  const profileCount = await db.select({ count: count() }).from(profiles);
  const membershipCount = await db.select({ count: count() }).from(userMemberships);
  return c.json({
    totalUsers: profileCount[0]?.count ?? 0,
    totalMemberships: membershipCount[0]?.count ?? 0,
  });
});

adminRoutes.patch("/users/:userId/role", async (c) => {
  const { userId } = c.req.param();
  const { role } = await c.req.json();
  const result = await userRolesRepo.addRole(db, userId, role);
  return c.json(result);
});
```

- [ ] **Step 2: Write storage.ts route**

```typescript
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../services/storage.service";
import crypto from "crypto";

export const storageRoutes = new Hono();

storageRoutes.use("/*", requireAuth);

storageRoutes.post("/presign-upload", async (c) => {
  const userId = c.var.userId;
  const { bucket, fileName, contentType } = await c.req.json();
  const ext = fileName?.split(".").pop() ?? "bin";
  const key = `${bucket}/${userId}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await getPresignedUploadUrl(bucket, key);
  return c.json({ uploadUrl, key, expiresIn: 3600 });
});

storageRoutes.get("/presign-download", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.json({ error: "key query param required" }, 400);
  const downloadUrl = await getPresignedDownloadUrl(key.split("/")[0], key);
  return c.json({ downloadUrl, key, expiresIn: 3600 });
});
```

- [ ] **Step 3: Mount routes in index.ts**

```
app.route("/api/admin", adminRoutes);
app.route("/api/storage", storageRoutes);
```

- [ ] **Step 4: Commit**

```
git add apps/api/src/routes/admin.ts apps/api/src/routes/storage.ts apps/api/src/index.ts
git commit -m "feat: add admin stats and storage presigned-url routes"
```

---

### Task 12: Seed Script

**Files:**
- Create: `apps/api/src/seed.ts`

- [ ] **Step 1: Write seed.ts**

```typescript
import { db } from "./db/client";
import { affiliationGroups } from "./db/schema";

const seedGroups = [
  {
    name: "NYSC Corps Members",
    type: "nysc" as const,
    description: "National Youth Service Corps serving members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 12,
  },
  {
    name: "University of Lagos Alumni",
    type: "alumni" as const,
    description: "UNILAG alumni association",
    verificationMethods: ["id_upload", "email_domain"],
    emailDomains: ["unilag.edu.ng", "alumni.unilag.edu.ng"],
    badgeValidityMonths: 24,
  },
  {
    name: "University of Ibadan Alumni",
    type: "alumni" as const,
    description: "UI alumni association",
    verificationMethods: ["id_upload", "email_domain"],
    emailDomains: ["ui.edu.ng"],
    badgeValidityMonths: 24,
  },
  {
    name: "ICAN — Chartered Accountants",
    type: "professional" as const,
    description: "Institute of Chartered Accountants of Nigeria",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
  {
    name: "Nigerian Bar Association",
    type: "professional" as const,
    description: "NBA members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
  {
    name: "Nigerian Medical Association",
    type: "professional" as const,
    description: "NMA members",
    verificationMethods: ["id_upload", "membership_number"],
    emailDomains: [],
    badgeValidityMonths: 24,
  },
];

async function seed() {
  console.log("Seeding affiliation groups...");
  for (const group of seedGroups) {
    await db.insert(affiliationGroups).values(group).onConflictDoNothing();
  }
  console.log("Seed complete");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
```

- [ ] **Step 2: Commit**

```
git add apps/api/src/seed.ts
git commit -m "feat: add seed script for affiliation groups"
```

---

### Task 13: Frontend Migration — Move to apps/web & Wire Clerk

**Files:**
- Move: All source from root into `apps/web/`
- Create: `apps/web/package.json`
- Create: `apps/web/CLAUDE.md` (update AGENTS.md, CLAUDE.md references)
- Modify: `apps/web/src/hooks/use-auth.tsx` (replace Supabase with Clerk)

- [ ] **Step 1: Create apps/web/package.json**

Based on root `package.json` contents, create `apps/web/package.json` retaining all dependencies and scripts, adding `@clerk/tanstack-react-start` and `@perkhub/shared` workspace dep.

- [ ] **Step 2: Move source files**

Move `src/`, `public/`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `components.json`, `bunfig.toml` into `apps/web/`.

- [ ] **Step 3: Update root package.json**

Remove old scripts and dependencies — root should only manage workspaces.

- [ ] **Step 4: Update auth hook**

Replace `apps/web/src/hooks/use-auth.tsx` to use `@clerk/tanstack-react-start`:

```typescript
import { useAuth, useUser } from "@clerk/tanstack-react-start";

export function useAuthStatus() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  return { isSignedIn, userId, user };
}
```

- [ ] **Step 5: Update API calls**

Create `apps/web/src/lib/api-client.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}
```

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: migrate frontend to apps/web, wire Clerk auth"
```

---

### Task 14: Deployment Configuration

**Files:**
- Create: `Dockerfile` (for API)
- Create: `railway.json`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run --cwd apps/api build

# Run
EXPOSE 3000
CMD ["bun", "run", "apps/api/dist/index.js"]
```

- [ ] **Step 2: Write railway.json**

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 5
  }
}
```

- [ ] **Step 3: Write .env.example**

```
DATABASE_URL=postgresql://user:pass@host:5432/perkhub
CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_MEMBERSHIP_DOCS=membership-docs
R2_BUCKET_BRAND_ASSETS=brand-assets
R2_BUCKET_DEAL_IMAGES=deal-images
API_PORT=3000
```

- [ ] **Step 4: Commit**

```
git add Dockerfile railway.json apps/api/.env.example
git commit -m "chore: add Docker and Railway deployment config"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Install all dependencies**

Run: `bun install` from root
Expected: All workspace packages link, dependencies install

- [ ] **Step 2: Run API tests**

Run: `bun run --cwd apps/api test`
Expected: All tests pass

- [ ] **Step 3: Verify frontend builds**

Run: `bun run --cwd apps/web build`
Expected: Frontend builds without errors

- [ ] **Step 4: Run final lint check**

Run: `bun run lint`
Expected: No linting errors

- [ ] **Step 5: Final commit**

```
git add -A
git commit -m "chore: finalize PerkHub backend migration"
```
