import type { Db } from "../db/client";
import { profiles } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

export interface CreateProfileInput {
  id: string;
  fullName?: string | null;
}

export async function getProfile(db: Db, id: string) {
  const rows = await db.select().from(profiles).where(eq(profiles.id, id));
  return rows[0] ?? null;
}

export async function getProfilesByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(profiles).where(inArray(profiles.id, ids));
}

export async function createProfile(db: Db, input: CreateProfileInput) {
  const rows = await db
    .insert(profiles)
    .values({ id: input.id, fullName: input.fullName ?? null })
    .returning();
  return rows[0];
}

export async function updateProfile(
  db: Db,
  id: string,
  data: Partial<Omit<typeof profiles.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(profiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(profiles.id, id))
    .returning();
  return rows[0] ?? null;
}
