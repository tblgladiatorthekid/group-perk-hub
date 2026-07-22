import type {
  AffiliationType,
  AdminSubRole,
  AppRole,
  BrandStatus,
  BrandSubRole,
  CommissionStatus,
  CommissionType,
  DealChannel,
  DealDurationType,
  DealStatus,
  DiscountType,
  InvoiceStatus,
  MembershipStatus,
  RedemptionCodeStatus,
  TransactionStatus,
  VerificationMethod,
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
  durationType: DealDurationType | null;
  redemptionLimit: number | null;
  performanceThreshold: number | null;
  performanceCheckHours: number | null;
  autoExpirePoorPerformance: boolean | null;
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
    unsafe_metadata: Record<string, unknown>;
    created_at: number;
    updated_at: number;
  };
}

export interface RedemptionCode {
  id: string;
  dealId: string;
  brandId: string;
  code: string;
  status: RedemptionCodeStatus;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}
