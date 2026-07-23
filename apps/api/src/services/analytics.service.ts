import type { Db } from "../db/client";
import { COMMISSION_STATUSES, type CommissionStatus } from "@perkhub/shared";
import * as analyticsRepo from "../repositories/analytics.repo";

const HISTOGRAM_BUCKETS = ["0-1k", "1k-5k", "5k-10k", "10k-25k", "25k+"] as const;

export interface AdminAnalytics {
  year: number;
  monthly: { month: number; transactionCount: number; commissionAmount: number }[];
  byBrand: { brandId: string; brandName: string; commissionAmount: number }[];
  byStatus: { status: CommissionStatus; commissionAmount: number }[];
  histogram: { bucket: string; count: number }[];
}

export interface RedemptionCodeAnalytics {
  totalCodes: number;
  totalRedemptions: number;
  codesByStatus: { status: string; count: number }[];
  topDealsByRedemptions: { dealId: string; dealTitle: string; codeCount: number; redemptionCount: number }[];
  topBrandsByRedemptions: { brandId: string; brandName: string; redemptionCount: number }[];
  dailyRedemptions: { date: string; count: number }[];
  recentRedemptions: { id: string; code: string; dealTitle: string; brandName: string; redeemedAt: string | null }[];
}

export async function getAdminAnalytics(db: Db, year: number): Promise<AdminAnalytics> {
  const [monthlyRows, brandRows, statusRows, histogramRows] = await Promise.all([
    analyticsRepo.getMonthlyCommissionAggregates(db, year),
    analyticsRepo.getBrandCommissionAggregates(db, year),
    analyticsRepo.getStatusCommissionAggregates(db, year),
    analyticsRepo.getCommissionHistogramCounts(db, year),
  ]);

  const monthlyByNumber = new Map(monthlyRows.map((r) => [r.month, r]));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const row = monthlyByNumber.get(month);
    return {
      month,
      transactionCount: row?.transactionCount ?? 0,
      commissionAmount: Number(row?.commissionAmount ?? 0),
    };
  });

  const byBrand = brandRows.map((r) => ({
    brandId: r.brandId,
    brandName: r.brandName,
    commissionAmount: Number(r.commissionAmount),
  }));

  const statusByName = new Map(statusRows.map((r) => [r.status, r]));
  const byStatus = COMMISSION_STATUSES.map((status) => ({
    status,
    commissionAmount: Number(statusByName.get(status)?.commissionAmount ?? 0),
  }));

  const histogramByBucket = new Map(histogramRows.map((r) => [r.bucket, r]));
  const histogram = HISTOGRAM_BUCKETS.map((bucket) => ({
    bucket,
    count: histogramByBucket.get(bucket)?.count ?? 0,
  }));

  return { year, monthly, byBrand, byStatus, histogram };
}

export async function getRedemptionCodeAnalytics(db: Db): Promise<RedemptionCodeAnalytics> {
  return analyticsRepo.getRedemptionCodeAnalytics(db);
}