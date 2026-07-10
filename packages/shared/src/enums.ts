export const APP_ROLES = ["consumer", "brand_partner", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const AFFILIATION_TYPES = [
  "cooperative",
  "alumni",
  "professional",
  "nysc",
  "corporate",
  "religious",
  "union",
  "other",
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
