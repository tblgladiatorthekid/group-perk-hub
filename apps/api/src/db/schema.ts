import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  affiliationTypeEnum,
  appRoleEnum,
  brandStatusEnum,
  commissionStatusEnum,
  commissionTypeEnum,
  dealChannelEnum,
  dealDurationTypeEnum,
  dealStatusEnum,
  discountTypeEnum,
  invoiceStatusEnum,
  membershipStatusEnum,
  redemptionCodeStatusEnum,
  transactionStatusEnum,
  verificationMethodEnum,
} from "./enums";

export * from "./enums";

export const profiles = pgTable("profiles", {
  // Clerk user id (e.g. "user_2NNs82h..."), not a UUID — must stay text.
  id: text("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  state: text("state"),
  lga: text("lga"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    role: appRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userRoleUnique: uniqueIndex().on(table.userId, table.role),
  }),
);

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

export const groupWhitelist = pgTable(
  "group_whitelist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => affiliationGroups.id, { onDelete: "cascade" }),
    membershipNumber: text("membership_number").notNull(),
    fullName: text("full_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    groupMembershipUnique: uniqueIndex().on(table.groupId, table.membershipNumber),
  }),
);

export const userMemberships = pgTable("user_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => affiliationGroups.id, { onDelete: "restrict" }),
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

export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
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

export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
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
  durationType: dealDurationTypeEnum("duration_type"),
  redemptionLimit: integer("redemption_limit"),
  performanceThreshold: integer("performance_threshold").default(0),
  performanceCheckHours: integer("performance_check_hours").default(48),
  autoExpirePoorPerformance: boolean("auto_expire_poor_performance").default(false),
});

export const savedDeals = pgTable(
  "saved_deals",
  {
    userId: text("user_id").notNull(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.dealId] }),
  }),
);

export const redemptionCodes = pgTable(
  "redemption_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    status: redemptionCodeStatusEnum("status").notNull().default("active"),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dealCodeUnique: uniqueIndex().on(table.dealId, table.code),
  }),
);

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "restrict" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "restrict" }),
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
  redemptionCodeId: uuid("redemption_code_id").references(() => redemptionCodes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
});

export const commissionInvoices = pgTable("commission_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  paystackRef: text("paystack_ref"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
