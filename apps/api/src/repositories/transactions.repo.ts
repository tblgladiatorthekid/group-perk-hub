import type { Db } from "../db/client";
import { transactions } from "../db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export async function listTransactions(db: Db, filter?: { userId?: string; brandId?: string }) {
  const conditions = [];
  if (filter?.userId) conditions.push(eq(transactions.userId, filter.userId));
  if (filter?.brandId) conditions.push(eq(transactions.brandId, filter.brandId));
  const query = db.select().from(transactions);
  if (conditions.length > 0) query.where(and(...conditions));
  return query.orderBy(desc(transactions.createdAt));
}

export async function getTransaction(db: Db, id: string) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id));
  return rows[0] ?? null;
}

export async function createTransaction(db: Db, data: typeof transactions.$inferInsert) {
  const rows = await db.insert(transactions).values(data).returning();
  return rows[0];
}

export async function updateTransaction(
  db: Db,
  id: string,
  data: Partial<Omit<typeof transactions.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(transactions)
    .set(data)
    .where(eq(transactions.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function getWeeklyRedemptionCount(db: Db, userId: string, weekStart: Date) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.createdAt, weekStart)));
  return rows[0]?.count ?? 0;
}

export async function getDealRedemptionCount(db: Db, dealId: string, since: Date) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.dealId, dealId), gte(transactions.createdAt, since)));
  return rows[0]?.count ?? 0;
}

export async function getDealUniqueRedeemers(db: Db, dealId: string, since: Date) {
  const rows = await db
    .select({ count: sql<number>`count(distinct ${transactions.userId})::int` })
    .from(transactions)
    .where(and(eq(transactions.dealId, dealId), gte(transactions.createdAt, since)));
  return rows[0]?.count ?? 0;
}
