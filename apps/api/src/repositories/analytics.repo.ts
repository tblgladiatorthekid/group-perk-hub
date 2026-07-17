import type { Db } from "../db/client";
import { transactions, brands } from "../db/schema";
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