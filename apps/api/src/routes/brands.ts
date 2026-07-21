import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as brandsRepo from "../repositories/brands.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const brandRoutes = new Hono();

// Public list: only approved by default. `?status=all|pending|approved` requires super_admin for non-approved.
brandRoutes.get("/", async (c) => {
  const status = c.req.query("status") ?? "approved";
  const all = await brandsRepo.listBrands(db);

  if (status === "approved") {
    return c.json(all.filter((b) => b.status === "approved"));
  }

  // Non-public statuses require super_admin
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { createClerkClient } = await import("@clerk/backend");
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
    });
    const auth = await clerkClient.authenticateRequest(c.req.raw);
    if (!auth.isSignedIn) return c.json({ error: "Unauthorized" }, 401);
    const uid = auth.toAuth().userId!;
    const isAdmin = await userRolesRepo.hasRole(db, uid, "super_admin");
    if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (status === "all") return c.json(all);
  return c.json(all.filter((b) => b.status === status));
});

// Authenticated: caller's own brand regardless of status.
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
  const brand = await brandsRepo.createBrand(db, { ...body, ownerUserId: userId, status: "pending" });
  return c.json(brand, 201);
});

brandRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const brand = await brandsRepo.getBrand(db, c.req.param("id"));
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  // Non-super_admins cannot self-approve.
  if (!isAdmin && body.status && body.status !== brand.status) {
    delete body.status;
  }
  const updated = await brandsRepo.updateBrand(db, c.req.param("id"), body);
  return c.json(updated);
});

brandRoutes.delete("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await brandsRepo.deleteBrand(db, c.req.param("id"));
  return c.json({ success: true });
});
