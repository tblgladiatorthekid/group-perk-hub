import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as dealsRepo from "../repositories/deals.repo";
import * as brandsRepo from "../repositories/brands.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";
import * as transactionsRepo from "../repositories/transactions.repo";
import type { DealStatus, DealDurationType } from "@perkhub/shared";

export const dealRoutes = new Hono();

// GET /deals?status=published|pending_review|draft|all&brandId=...
// - Default: published only (public)
// - status != published requires super_admin OR (brandId filter that caller owns)
dealRoutes.get("/", async (c) => {
  const status = c.req.query("status") ?? "published";
  const brandId = c.req.query("brandId");

  if (status === "published" && !brandId) {
    const list = await dealsRepo.listDeals(db, { status: "published" });
    return c.json(list);
  }

  // Need auth
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) return c.json({ error: "Unauthorized" }, 401);
  const { createClerkClient } = await import("@clerk/backend");
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  });
  const auth = await clerkClient.authenticateRequest(c.req.raw);
  if (!auth.isSignedIn) return c.json({ error: "Unauthorized" }, 401);
  const uid = auth.toAuth().userId!;
  const isAdmin = await userRolesRepo.hasRole(db, uid, "super_admin");

  let ownedBrand = false;
  if (brandId) {
    const brand = await brandsRepo.getBrand(db, brandId);
    ownedBrand = brand?.ownerUserId === uid;
    if (!ownedBrand && !isAdmin) return c.json({ error: "Forbidden" }, 403);
  } else if (!isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const filter: { status?: DealStatus; brandId?: string } = {};
  if (status !== "all") filter.status = status as DealStatus;
  if (brandId) filter.brandId = brandId;
  return c.json(await dealsRepo.listDeals(db, filter));
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

  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (brand.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden: Not your brand" }, 403);
  }
  if (brand.status !== "approved" && !isAdmin) {
    return c.json({ error: "Your brand must be approved before creating deals" }, 403);
  }

  if (body.redemptionLimit !== undefined && body.redemptionLimit !== null) {
    const limit = Number(body.redemptionLimit);
    if (!Number.isInteger(limit) || limit < 50 || limit > 1000) {
      return c.json({ error: "redemptionLimit must be an integer between 50 and 1000" }, 400);
    }
  }

  const validDurations: DealDurationType[] = ["one_time", "monthly", "half_yearly", "yearly"];
  if (body.durationType && !validDurations.includes(body.durationType)) {
    return c.json({ error: "Invalid durationType" }, 400);
  }

  // Non-super_admin submissions default to pending_review
  const payload = { ...body };
  if (!isAdmin) payload.status = "pending_review";
  if (payload.startDate) payload.startDate = new Date(payload.startDate);
  if (payload.endDate) payload.endDate = new Date(payload.endDate);

  const deal = await dealsRepo.createDeal(db, payload);
  return c.json(deal, 201);
});

dealRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);

  const brand = await brandsRepo.getBrand(db, deal.brandId);
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (brand?.ownerUserId !== userId && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  if (!isAdmin && body.status && body.status !== deal.status) {
    if (!(deal.status === "draft" && body.status === "pending_review")) {
      delete body.status;
    }
  }
  if (body.redemptionLimit !== undefined && body.redemptionLimit !== null) {
    const limit = Number(body.redemptionLimit);
    if (!Number.isInteger(limit) || limit < 50 || limit > 1000) {
      return c.json({ error: "redemptionLimit must be an integer between 50 and 1000" }, 400);
    }
  }
  if (body.durationType) {
    const validDurations: DealDurationType[] = ["one_time", "monthly", "half_yearly", "yearly"];
    if (!validDurations.includes(body.durationType)) {
      return c.json({ error: "Invalid durationType" }, 400);
    }
  }
  if (body.startDate) body.startDate = new Date(body.startDate);
  if (body.endDate) body.endDate = new Date(body.endDate);
  const updated = await dealsRepo.updateDeal(db, c.req.param("id"), body);
  return c.json(updated);
});

dealRoutes.delete("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await dealsRepo.deleteDeal(db, c.req.param("id"));
  return c.json({ success: true });
});

dealRoutes.post("/:id/auto-expire-check", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const deal = await dealsRepo.getDeal(db, c.req.param("id"));
  if (!deal) return c.json({ error: "Deal not found" }, 404);
  if (deal.status !== "published") {
    return c.json({ error: "Only published deals can be auto-expired" }, 400);
  }
  if (!deal.autoExpirePoorPerformance || deal.performanceThreshold === null || deal.performanceThreshold === undefined) {
    return c.json({ error: "Auto-expire poor performance is not enabled for this deal" }, 400);
  }

  const checkSince = new Date(deal.createdAt);
  checkSince.setHours(checkSince.getHours() + (deal.performanceCheckHours ?? 48));
  if (new Date() < checkSince) {
    return c.json({ error: "Performance check window has not elapsed yet" }, 400);
  }

  const redemptionCount = await transactionsRepo.getDealRedemptionCount(db, deal.id, deal.createdAt);
  if (redemptionCount < deal.performanceThreshold) {
    const updated = await dealsRepo.updateDeal(db, deal.id, { status: "expired" });
    return c.json({ expired: true, deal: updated });
  }

  return c.json({ expired: false, redemptionCount });
});
