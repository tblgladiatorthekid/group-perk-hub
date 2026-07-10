import type { Db } from "../db/client";
import { savedDeals } from "../db/schema";
import { eq, and } from "drizzle-orm";

export async function listSavedDeals(db: Db, userId: string) {
  return db.select().from(savedDeals).where(eq(savedDeals.userId, userId));
}

export async function saveDeal(db: Db, userId: string, dealId: string) {
  const rows = await db
    .insert(savedDeals)
    .values({ userId, dealId })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function unsaveDeal(db: Db, userId: string, dealId: string) {
  await db
    .delete(savedDeals)
    .where(and(eq(savedDeals.userId, userId), eq(savedDeals.dealId, dealId)));
}
