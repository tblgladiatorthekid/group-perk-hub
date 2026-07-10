import type { Db } from "../db/client";
import { groupWhitelist } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function listWhitelist(db: Db, groupId: string) {
  return db.select().from(groupWhitelist).where(eq(groupWhitelist.groupId, groupId));
}

export async function addWhitelistEntry(
  db: Db,
  groupId: string,
  membershipNumber: string,
  fullName?: string | null,
) {
  const rows = await db
    .insert(groupWhitelist)
    .values({ groupId, membershipNumber, fullName: fullName ?? null })
    .returning();
  return rows[0];
}

export async function removeWhitelistEntry(db: Db, id: string) {
  await db.delete(groupWhitelist).where(eq(groupWhitelist.id, id));
}

export async function whitelistEntryExists(db: Db, groupId: string, membershipNumber: string) {
  const rows = await db
    .select()
    .from(groupWhitelist)
    .where(
      and(
        eq(groupWhitelist.groupId, groupId),
        sql`lower(${groupWhitelist.membershipNumber}) = lower(${membershipNumber})`,
      ),
    );
  return rows.length > 0;
}
