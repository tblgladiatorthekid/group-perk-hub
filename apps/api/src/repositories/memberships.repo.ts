import type { Db } from "../db/client";
import { userMemberships } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import type { MembershipStatus, VerificationMethod } from "@perkhub/shared";

export interface CreateMembershipInput {
  userId: string;
  groupId: string;
  method: VerificationMethod;
  membershipNumber?: string | null;
  idDocumentUrl?: string | null;
  submittedEmail?: string | null;
}

export async function listMembershipsForUser(db: Db, userId: string) {
  return db
    .select()
    .from(userMemberships)
    .where(eq(userMemberships.userId, userId))
    .orderBy(desc(userMemberships.createdAt));
}

export async function listMembershipsByStatus(db: Db, status: MembershipStatus) {
  return db
    .select()
    .from(userMemberships)
    .where(eq(userMemberships.status, status))
    .orderBy(desc(userMemberships.createdAt));
}

export async function getMembership(db: Db, id: string) {
  const rows = await db.select().from(userMemberships).where(eq(userMemberships.id, id));
  return rows[0] ?? null;
}

export async function createMembership(db: Db, input: CreateMembershipInput) {
  const rows = await db.insert(userMemberships).values(input).returning();
  return rows[0];
}

export async function updateMembership(
  db: Db,
  id: string,
  data: Partial<Omit<typeof userMemberships.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(userMemberships)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userMemberships.id, id))
    .returning();
  return rows[0] ?? null;
}
