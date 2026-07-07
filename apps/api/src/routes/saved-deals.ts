import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as savedDealsRepo from "../repositories/savedDeals.repo";

export const savedDealRoutes = new Hono();

savedDealRoutes.use("/*", requireAuth);

savedDealRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const deals = await savedDealsRepo.listSavedDeals(db, userId);
  return c.json(deals);
});

savedDealRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const { dealId } = await c.req.json();
  const saved = await savedDealsRepo.saveDeal(db, userId, dealId);
  return c.json(saved, 201);
});

savedDealRoutes.delete("/:dealId", async (c) => {
  const userId = c.var.userId;
  await savedDealsRepo.unsaveDeal(db, userId, c.req.param("dealId"));
  return c.json({ success: true });
});
