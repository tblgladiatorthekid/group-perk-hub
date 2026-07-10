import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as brandsRepo from "../repositories/brands.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const brandRoutes = new Hono();

brandRoutes.get("/", async (c) => {
  const allBrands = await brandsRepo.listBrands(db);
  return c.json(allBrands.filter((b) => b.status === "approved"));
});

// Authenticated: caller's own brand regardless of status. Registered before
// /:id so "mine" isn't captured as an :id param.
brandRoutes.get("/mine", requireAuth, async (c) => {
  const brand = await brandsRepo.getBrandByOwner(db, c.var.userId);
  return c.json(brand);
});

brandRoutes.get("/:id", async (c) => {
  const brand = await brandsRepo.getBrand(db, c.req.param("id"));
  if (!brand) return c.json({ error: "Brand not found" }, 404);
  return c.json(brand);
});

brandRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const brand = await brandsRepo.createBrand(db, { ...body, ownerUserId: userId });
  return c.json(brand, 201);
});

brandRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const brand = await brandsRepo.getBrand(db, c.req.param("id"));
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updated = await brandsRepo.updateBrand(db, c.req.param("id"), body);
  return c.json(updated);
});

brandRoutes.delete("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await brandsRepo.deleteBrand(db, c.req.param("id"));
  return c.json({ success: true });
});
