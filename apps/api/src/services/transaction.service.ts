import type { Db } from "../db/client";
import * as transactionsRepo from "../repositories/transactions.repo";
import * as brandsRepo from "../repositories/brands.repo";
import * as dealsRepo from "../repositories/deals.repo";
import * as redemptionCodeService from "./redemption-code.service";
import crypto from "crypto";

const WEEKLY_REDEMPTION_LIMIT = 10;

export interface CreateTransactionInput {
  userId: string;
  dealId: string;
  brandId: string;
  groupId?: string | null;
  method: "online" | "instore" | "both";
  originalPrice?: number | null;
  finalPrice?: number | null;
  discountApplied?: number;
  redemptionCodeId?: string | null;
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
  return `PRK-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function createTransaction(db: Db, input: CreateTransactionInput) {
  const weekStart = getWeekStart(new Date());
  const weeklyCount = await transactionsRepo.getWeeklyRedemptionCount(db, input.userId, weekStart);
  if (weeklyCount >= WEEKLY_REDEMPTION_LIMIT) {
    throw new Error("Weekly redemption limit exceeded (max 10 per week)");
  }

  const brand = await brandsRepo.getBrand(db, input.brandId);
  if (!brand) throw new Error("Brand not found");

  const deal = await dealsRepo.getDeal(db, input.dealId);
  if (!deal) throw new Error("Deal not found");

  const finalPrice = input.finalPrice ?? null;
  const discountApplied = input.discountApplied ?? 0;
  const commissionAmount = calculateCommission(finalPrice, brand.commissionType, Number(brand.commissionRate));

  const redemptionCode = input.redemptionCodeId
    ? await redemptionCodeService.getRedemptionCodeById(db, input.redemptionCodeId)
    : null;

  return transactionsRepo.createTransaction(db, {
    userId: input.userId,
    dealId: input.dealId,
    brandId: input.brandId,
    groupId: input.groupId ?? null,
    method: input.method,
    originalPrice: input.originalPrice ?? null,
    finalPrice: finalPrice ?? null,
    discountApplied: discountApplied,
    commissionType: brand.commissionType,
    commissionRate: brand.commissionRate.toString(),
    commissionAmount: commissionAmount.toString(),
    commissionStatus: "pending",
    status: "redeemed",
    redemptionCode: redemptionCode?.code ?? generateRedemptionCode(),
    redemptionCodeId: redemptionCode?.id ?? null,
    redeemedAt: new Date(),
  });
}

export async function redeemDealWithCode(db: Db, userId: string, code: string, dealId: string) {
  const codeData = await redemptionCodeService.redeemCode(db, code, userId);
  if (!codeData) {
    throw new Error("Invalid or expired redemption code");
  }

  const deal = await dealsRepo.getDeal(db, dealId);
  if (!deal) {
    throw new Error("Deal not found");
  }

  if (codeData.dealId !== deal.id) {
    throw new Error("Redemption code does not match this deal");
  }

  return createTransaction(db, {
    userId,
    dealId: deal.id,
    brandId: deal.brandId,
    method: deal.channel,
    originalPrice: deal.discountValue,
    finalPrice: deal.discountValue,
    discountApplied: deal.discountValue,
    redemptionCodeId: codeData.id,
  });
}
