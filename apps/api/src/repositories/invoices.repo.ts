import type { Db } from "../db/client";
import { commissionInvoices } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export async function listInvoices(db: Db, brandId?: string) {
  const query = db.select().from(commissionInvoices);
  if (brandId) query.where(eq(commissionInvoices.brandId, brandId));
  return query.orderBy(desc(commissionInvoices.createdAt));
}

export async function getInvoice(db: Db, id: string) {
  const rows = await db
    .select()
    .from(commissionInvoices)
    .where(eq(commissionInvoices.id, id));
  return rows[0] ?? null;
}

export async function createInvoice(db: Db, data: typeof commissionInvoices.$inferInsert) {
  const rows = await db.insert(commissionInvoices).values(data).returning();
  return rows[0];
}

export async function updateInvoice(
  db: Db,
  id: string,
  data: Partial<Omit<typeof commissionInvoices.$inferInsert, "id" | "createdAt">>,
) {
  const rows = await db
    .update(commissionInvoices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(commissionInvoices.id, id))
    .returning();
  return rows[0] ?? null;
}
