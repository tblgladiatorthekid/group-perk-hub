import type { Db } from "../db/client";
import { redemptionCodes } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { RedemptionCode } from "@perkhub/shared";

export async function createRedemptionCode(db: Db, data: {
  dealId: string;
  brandId: string;
  code: string;
  maxUses: number;
  expiresAt?: Date;
  createdBy: string;
}) {
  const rows = await db
    .insert(redemptionCodes)
    .values(data)
    .returning();
  return rows[0] ?? null;
}

export async function getRedemptionCode(db: Db, code: string) {
  const rows = await db
    .select()
    .from(redemptionCodes)
    .where(eq(redemptionCodes.code, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRedemptionCodesByDeal(db: Db, dealId: string) {
  return db.select().from(redemptionCodes).where(eq(redemptionCodes.dealId, dealId));
}

export async function getRedemptionCodesByBrand(db: Db, brandId: string) {
  return db.select().from(redemptionCodes).where(eq(redemptionCodes.brandId, brandId));
}

export async function updateRedemptionCode(db: Db, code: string, data: Partial<typeof redemptionCodes.$inferInsert>) {
  const rows = await db
    .update(redemptionCodes)
    .set(data)
    .where(eq(redemptionCodes.code, code))
    .returning();
  return rows[0] ?? null;
}

export async function deleteRedemptionCode(db: Db, code: string) {
  await db.delete(redemptionCodes).where(eq(redemptionCodes.code, code));
}

export async function markRedemptionCodeUsed(db: Db, code: string) {
  const rows = await db
    .update(redemptionCodes)
    .set({
      status: "used",
      useCount: sql`${redemptionCodes.useCount} + 1`,
    })
    .where(eq(redemptionCodes.code, code))
    .returning();
  return rows[0] ?? null;
}

export async function listRedemptionCodes(db: Db, filter?: { brandId?: string; dealId?: string; status?: "active" | "used" | "expired" | "cancelled" }) {
  const conditions = [];
  if (filter?.brandId) conditions.push(eq(redemptionCodes.brandId, filter.brandId));
  if (filter?.dealId) conditions.push(eq(redemptionCodes.dealId, filter.dealId));
  if (filter?.status) conditions.push(eq(redemptionCodes.status, filter.status));

  if (conditions.length === 0) {
    return db.select().from(redemptionCodes);
  }
  return db.select().from(redemptionCodes).where(and(...conditions));
}
