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
  return commissionRate;
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
