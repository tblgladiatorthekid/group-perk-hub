import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as dealsRepo from "../repositories/deals.repo";
import * as brandsRepo from "../repositories/brands.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const dealRoutes = new Hono();

dealRoutes.get("/", async (c) => {
  const allDeals = await dealsRepo.listDeals(db);
  return c.json(allDeals.filter((d) => d.status === "published"));
});

dealRoutes.get("/:id", async (c) => {
  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);
  return c.json(deal);
});

dealRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const brand = await brandsRepo.getBrand(db, body.brandId);
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden: Not your brand" }, 403);
  }

  const deal = await dealsRepo.createDeal(db, body);
  return c.json(deal, 201);
});

dealRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);

  const brand = await brandsRepo.getBrand(db, deal.brandId);
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (brand?.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updated = await dealsRepo.updateDeal(db, c.req.param("id"), body);
  return c.json(updated);
});

dealRoutes.delete("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await dealsRepo.deleteDeal(db, c.req.param("id"));
  return c.json({ success: true });
});
