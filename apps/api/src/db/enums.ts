import { pgEnum } from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", [
  "consumer",
  "brand_partner",
  "brand_manager",
  "super_admin",
  "affiliation_admin",
  "commerce_admin",
]);
export const affiliationTypeEnum = pgEnum("affiliation_type", [
  "cooperative",
  "alumni",
  "professional",
  "nysc",
  "corporate",
  "religious",
  "union",
  "other",
]);
export const verificationMethodEnum = pgEnum("verification_method", [
  "id_upload",
  "email_domain",
  "membership_number",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "verified",
  "rejected",
  "expired",
]);
export const brandStatusEnum = pgEnum("brand_status", [
  "pending",
  "approved",
  "suspended",
  "rejected",
]);
export const dealStatusEnum = pgEnum("deal_status", [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "expired",
]);
export const dealDurationTypeEnum = pgEnum("deal_duration_type", ["one_time", "monthly", "half_yearly", "yearly"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed", "bogo", "free_item"]);
export const dealChannelEnum = pgEnum("deal_channel", ["online", "instore", "both"]);
export const commissionTypeEnum = pgEnum("commission_type", ["percent", "flat"]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "redeemed",
  "expired",
  "cancelled",
  "disputed",
]);
export const commissionStatusEnum = pgEnum("commission_status", ["pending", "invoiced", "paid"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "void"]);
export const redemptionCodeStatusEnum = pgEnum("redemption_code_status", [
  "active",
  "used",
  "expired",
  "cancelled",
]);
