import type { Db } from "../db/client";
import { affiliationGroups } from "../db/schema";
import { eq } from "drizzle-orm";
import type { AffiliationType, VerificationMethod } from "@perkhub/shared";

export interface CreateGroupInput {
  name: string;
  type: AffiliationType;
  description?: string | null;
  verificationMethods?: VerificationMethod[];
  emailDomains?: string[];
  badgeValidityMonths?: number;
}

export async function listGroups(db: Db) {
  return db.select().from(affiliationGroups);
}

export async function getGroup(db: Db, id: string) {
  const rows = await db.select().from(affiliationGroups).where(eq(affiliationGroups.id, id));
  return rows[0] ?? null;
}

export async function createGroup(db: Db, input: CreateGroupInput) {
  const rows = await db.insert(affiliationGroups).values(input).returning();
  return rows[0];
}

export async function updateGroup(db: Db, id: string, data: Partial<typeof affiliationGroups.$inferInsert>) {
  const rows = await db
    .update(affiliationGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(affiliationGroups.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteGroup(db: Db, id: string) {
  await db.delete(affiliationGroups).where(eq(affiliationGroups.id, id));
}
