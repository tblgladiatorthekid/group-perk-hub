import type { Db } from "../db/client";
import { transactions, brands, deals, redemptionCodes } from "../db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

function yearRange(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

export async function getMonthlyCommissionAggregates(db: Db, year: number) {
  const { start, end } = yearRange(year);
  const monthExpr = sql<number>`extract(month from ${transactions.createdAt})::int`;
  return db
    .select({
      month: monthExpr,
      transactionCount: sql<number>`count(*)::int`,
      commissionAmount: sql<string>`coalesce(sum(${transactions.commissionAmount}), 0)`,
    })
    .from(transactions)
    .where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end)))
    .groupBy(monthExpr);
}

export async function getBrandCommissionAggregates(db: Db, year: number, limit = 8) {
  const { start, end } = yearRange(year);
  return db
    .select({
      brandId: transactions.brandId,
      brandName: brands.name,
      commissionAmount: sql<string>`coalesce(sum(${transactions.commissionAmount}), 0)`,
    })
    .from(transactions)
    .innerJoin(brands, eq(transactions.brandId, brands.id))
    .where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end)))
    .groupBy(transactions.brandId, brands.name)
    .orderBy(desc(sql`sum(${transactions.commissionAmount})`))
    .limit(limit);
}

export async function getStatusCommissionAggregates(db: Db, year: number) {
  const { start, end } = yearRange(year);
  return db
    .select({
      status: transactions.commissionStatus,
      commissionAmount: sql<string>`coalesce(sum(${transactions.commissionAmount}), 0)`,
    })
    .from(transactions)
    .where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end)))
    .groupBy(transactions.commissionStatus);
}

export async function getCommissionHistogramCounts(db: Db, year: number) {
  const { start, end } = yearRange(year);
  const bucketExpr = sql<string>`case
    when ${transactions.commissionAmount}::numeric < 1000 then '0-1k'
    when ${transactions.commissionAmount}::numeric < 5000 then '1k-5k'
    when ${transactions.commissionAmount}::numeric < 10000 then '5k-10k'
    when ${transactions.commissionAmount}::numeric < 25000 then '10k-25k'
    else '25k+'
  end`;
  return db
    .select({
      bucket: bucketExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end)))
    .groupBy(bucketExpr);
}

export async function getRedemptionCodeAnalytics(db: Db) {
  const totalCodeRows = await db.select({ count: sql<number>`count(*)::int` }).from(redemptionCodes);
  const totalRedemptionRows = await db.select({ count: sql<number>`count(*)::int` }).from(transactions);
  const codesByStatusRows = await db
    .select({
      status: redemptionCodes.status,
      count: sql<number>`count(*)::int`,
    })
    .from(redemptionCodes)
    .groupBy(redemptionCodes.status);

  const topDealsRows = await db
    .select({
      dealId: transactions.dealId,
      dealTitle: deals.title,
      codeCount: sql<number>`count(${redemptionCodes.id})::int`,
      redemptionCount: sql<number>`count(${transactions.id})::int`,
    })
    .from(transactions)
    .leftJoin(redemptionCodes, eq(redemptionCodes.id, transactions.redemptionCodeId))
    .leftJoin(deals, eq(deals.id, transactions.dealId))
    .groupBy(transactions.dealId, deals.title)
    .orderBy(desc(sql`count(${transactions.id})`))
    .limit(8);

  const topBrandsRows = await db
    .select({
      brandId: transactions.brandId,
      brandName: brands.name,
      redemptionCount: sql<number>`count(${transactions.id})::int`,
    })
    .from(transactions)
    .innerJoin(brands, eq(brands.id, transactions.brandId))
    .groupBy(transactions.brandId, brands.name)
    .orderBy(desc(sql`count(${transactions.id})`))
    .limit(8);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyRedemptionsRows = await db
    .select({
      date: sql<string>`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(gte(transactions.createdAt, thirtyDaysAgo))
    .groupBy(sql`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${transactions.createdAt}, 'YYYY-MM-DD')`);

  const recentRedemptionsRows = await db
    .select({
      id: transactions.id,
      code: redemptionCodes.code,
      dealTitle: deals.title,
      brandName: brands.name,
      redeemedAt: sql<string>`coalesce(to_char(${transactions.redeemedAt}, 'YYYY-MM-DD HH24:MI:SS'), to_char(${transactions.createdAt}, 'YYYY-MM-DD HH24:MI:SS'))`,
    })
    .from(transactions)
    .leftJoin(redemptionCodes, eq(redemptionCodes.id, transactions.redemptionCodeId))
    .leftJoin(deals, eq(deals.id, transactions.dealId))
    .innerJoin(brands, eq(brands.id, transactions.brandId))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  return {
    totalCodes: totalCodeRows[0]?.count ?? 0,
    totalRedemptions: totalRedemptionRows[0]?.count ?? 0,
    codesByStatus: codesByStatusRows.map((r) => ({ status: r.status, count: r.count })),
    topDealsByRedemptions: topDealsRows.map((r) => ({
      dealId: r.dealId,
      dealTitle: r.dealTitle ?? "Unknown",
      codeCount: r.codeCount ?? 0,
      redemptionCount: r.redemptionCount ?? 0,
    })),
    topBrandsByRedemptions: topBrandsRows.map((r) => ({
      brandId: r.brandId,
      brandName: r.brandName ?? "Unknown",
      redemptionCount: r.redemptionCount ?? 0,
    })),
    dailyRedemptions: dailyRedemptionsRows.map((r) => ({ date: r.date, count: r.count })),
    recentRedemptions: recentRedemptionsRows.map((r) => ({
      id: r.id,
      code: r.code ?? "N/A",
      dealTitle: r.dealTitle ?? "Unknown",
      brandName: r.brandName ?? "Unknown",
      redeemedAt: r.redeemedAt ?? r.redeemedAt,
    })),
  };
}