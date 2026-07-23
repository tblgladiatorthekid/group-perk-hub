import type { Db } from "../db/client";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import * as redemptionCodesRepo from "../repositories/redemptionCodes.repo";
import { redemptionCodes } from "../db/schema";

export function generateRedemptionCode(): string {
  return "PRK-" + randomBytes(6).toString("hex").toUpperCase();
}

export async function createRedemptionCodeForDeal(db: Db, input: {
  dealId: string;
  brandId: string;
  maxUses: number;
  expiresAt?: Date;
  createdBy: string;
}) {
  const code = generateRedemptionCode();
  return redemptionCodesRepo.createRedemptionCode(db, {
    dealId: input.dealId,
    brandId: input.brandId,
    code,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt,
    createdBy: input.createdBy,
  });
}

export async function getRedemptionCodeById(db: Db, id: string) {
  const rows = await db
    .select()
    .from(redemptionCodes)
    .where(eq(redemptionCodes.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function redeemCode(db: Db, code: string, userId: string) {
  const existing = await redemptionCodesRepo.getRedemptionCode(db, code);
  if (!existing) {
    throw new Error("Redemption code not found");
  }
  if (existing.status !== "active") {
    throw new Error("Redemption code is not active");
  }
  if (existing.expiresAt && new Date() > existing.expiresAt) {
    throw new Error("Redemption code has expired");
  }
  if (existing.useCount >= existing.maxUses) {
    throw new Error("Redemption code has reached its usage limit");
  }
  return redemptionCodesRepo.markRedemptionCodeUsed(db, code);
}
