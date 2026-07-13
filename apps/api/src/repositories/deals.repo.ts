import type { Db } from "../db/client";
import { deals } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { DealStatus } from "@perkhub/shared";

export interface ListDealsFilter {
  status?: DealStatus;
  brandId?: string;
}

export async function listDeals(db: Db, filter?: ListDealsFilter) {
  const conditions = [];
  if (filter?.status) conditions.push(eq(deals.status, filter.status));
  if (filter?.brandId) conditions.push(eq(deals.brandId, filter.brandId));
  const base = db.select().from(deals).$dynamic();
  const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
  return filtered.orderBy(desc(deals.createdAt));
}

export async function getDeal(db: Db, id: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, id));
  return rows[0] ?? null;
}

export async function createDeal(db: Db, data: typeof deals.$inferInsert) {
  const rows = await db.insert(deals).values(data).returning();
  return rows[0];
}

export async function updateDeal(
  db: Db,
  id: string,
  data: Partial<Omit<typeof deals.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deals.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteDeal(db: Db, id: string) {
  await db.delete(deals).where(eq(deals.id, id));
}
