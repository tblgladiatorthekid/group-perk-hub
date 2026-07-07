import type { Db } from "../db/client";
import { userRoles } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { AppRole } from "@perkhub/shared";

export async function getRolesForUser(db: Db, userId: string) {
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function addRole(db: Db, userId: string, role: AppRole) {
  const rows = await db
    .insert(userRoles)
    .values({ userId, role })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function removeRole(db: Db, userId: string, role: AppRole) {
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
}

export async function hasRole(db: Db, userId: string, role: AppRole) {
  const rows = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  return rows.length > 0;
}
