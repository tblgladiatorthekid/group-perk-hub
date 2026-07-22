import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requireAdminSubRole, requireBrandSubRole } from "../middleware/auth";
import { db } from "../db/client";
import * as redemptionCodesRepo from "../repositories/redemptionCodes.repo";
import * as redemptionCodeService from "../services/redemption-code.service";
import * as userRolesRepo from "../repositories/userRoles.repo";
import type { RedemptionCode } from "@perkhub/shared";

export const redemptionCodeRoutes = new Hono();

redemptionCodeRoutes.get("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  const isBrand = roles.some((r) => ["brand_partner", "brand_manager"].includes(r.role));

  const brandId = c.req.query("brandId");
  const dealId = c.req.query("dealId");
  const status = c.req.query("status");

  if (isAdmin) {
    const codes = await redemptionCodesRepo.listRedemptionCodes(db, { brandId, dealId, status });
    return c.json(codes);
  }

  if (isBrand && brandId) {
    const brand = await (await import("../repositories/brands.repo")).getBrand(db, brandId);
    if (!brand || brand.ownerUserId !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const codes = await redemptionCodesRepo.listRedemptionCodes(db, { brandId, dealId, status });
    return c.json(codes);
  }

  return c.json({ error: "Forbidden" }, 403);
});

redemptionCodeRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const { dealId, maxUses, expiresAt } = body;

  const deal = await (await import("../repositories/deals.repo")).getDeal(db, dealId);
  if (!deal) return c.json({ error: "Deal not found" }, 404);

  const brand = await (await import("../repositories/brands.repo")).getBrand(db, deal.brandId);
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isBrandOwner = brand.ownerUserId === userId;
  const isBrandManager = roles.some((r) => r.role === "brand_manager");
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));

  if (!isBrandOwner && !isBrandManager && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const code = await redemptionCodeService.createRedemptionCodeForDeal(db, {
    dealId,
    brandId: brand.id,
    maxUses: maxUses ?? 1,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    createdBy: userId,
  });

  return c.json(code, 201);
});

redemptionCodeRoutes.post("/redeem", requireAuth, async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const { code, dealId } = body;

  const existing = await redemptionCodesRepo.getRedemptionCode(db, code);
  if (!existing) return c.json({ error: "Invalid redemption code" }, 404);

  const deal = await (await import("../repositories/deals.repo")).getDeal(db, dealId);
  if (!deal) return c.json({ error: "Deal not found" }, 404);

  if (existing.dealId !== deal.id) {
    return c.json({ error: "Redemption code does not match this deal" }, 400);
  }

  try {
    const updated = await redemptionCodeService.redeemCode(db, code, userId);
    return c.json({ success: true, code: updated });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Redemption failed" }, 400);
  }
});

redemptionCodeRoutes.patch("/:code", requireAuth, async (c) => {
  const userId = c.var.userId;
  const code = c.req.param("code");
  const body = await c.req.json();

  const existing = await redemptionCodesRepo.getRedemptionCode(db, code);
  if (!existing) return c.json({ error: "Redemption code not found" }, 404);

  const brand = await (await import("../repositories/brands.repo")).getBrand(db, existing.brandId);
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isBrandOwner = brand.ownerUserId === userId;
  const isBrandManager = roles.some((r) => r.role === "brand_manager");
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));

  if (!isBrandOwner && !isBrandManager && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const updated = await redemptionCodesRepo.updateRedemptionCode(db, code, body);
  return c.json(updated);
});

redemptionCodeRoutes.delete("/:code", requireAuth, async (c) => {
  const userId = c.var.userId;
  const code = c.req.param("code");

  const existing = await redemptionCodesRepo.getRedemptionCode(db, code);
  if (!existing) return c.json({ error: "Redemption code not found" }, 404);

  const brand = await (await import("../repositories/brands.repo")).getBrand(db, existing.brandId);
  if (!brand) return c.json({ error: "Brand not found" }, 404);

  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isBrandOwner = brand.ownerUserId === userId;
  const isBrandManager = roles.some((r) => r.role === "brand_manager");
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));

  if (!isBrandOwner && !isBrandManager && !isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await redemptionCodesRepo.deleteRedemptionCode(db, code);
  return c.json({ success: true });
});
