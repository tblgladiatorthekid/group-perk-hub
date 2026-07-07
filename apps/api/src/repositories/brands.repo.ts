import type { Db } from "../db/client";
import { brands } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function listBrands(db: Db) {
  return db.select().from(brands).orderBy(desc(brands.createdAt));
}

export async function getBrand(db: Db, id: string) {
  const rows = await db.select().from(brands).where(eq(brands.id, id));
  return rows[0] ?? null;
}

export async function createBrand(db: Db, data: typeof brands.$inferInsert) {
  const rows = await db.insert(brands).values(data).returning();
  return rows[0];
}

export async function updateBrand(
  db: Db,
  id: string,
  data: Partial<Omit<typeof brands.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(brands)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brands.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteBrand(db: Db, id: string) {
  await db.delete(brands).where(eq(brands.id, id));
}
