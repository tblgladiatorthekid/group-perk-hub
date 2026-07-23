import { Hono } from "hono";
import { requireAuth, requireAdminSubRole } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";
import * as analyticsService from "../services/analytics.service";
import * as dealsRepo from "../repositories/deals.repo";
import * as transactionsRepo from "../repositories/transactions.repo";
import { profiles, userMemberships, affiliationGroups, brands, transactions, redemptionCodes, userRoles as userRolesTable } from "../db/schema";
import { count, eq } from "drizzle-orm";
import type { AppRole, Deal } from "@perkhub/shared";

export const adminRoutes = new Hono();

adminRoutes.use("/*", requireAuth);
adminRoutes.use("/*", requireAdminSubRole("super_admin", "affiliation_admin", "commerce_admin"));

adminRoutes.get("/stats", async (c) => {
  const [profileCount, membershipCount, groupCount, brandCount, pendingCount, transactionCount, activeCodeCount] =
    await Promise.all([
      db.select({ count: count() }).from(profiles),
      db.select({ count: count() }).from(userMemberships),
      db.select({ count: count() }).from(affiliationGroups),
      db.select({ count: count() }).from(brands),
      db.select({ count: count() }).from(userMemberships).where(eq(userMemberships.status, "pending")),
      db.select({ count: count() }).from(transactions),
      db.select({ count: count() }).from(redemptionCodes).where(eq(redemptionCodes.status, "active")),
    ]);

  const publishedDeals = await dealsRepo.listDeals(db, { status: "published" });
  type PoorPerformingDeal = Deal & { redemptionCount: number };
  const poorPerforming: PoorPerformingDeal[] = [];
  const now = new Date();
  for (const deal of publishedDeals) {
    if (!deal.autoExpirePoorPerformance || deal.performanceThreshold === null || deal.performanceThreshold === undefined) {
      continue;
    }
    const elapsed = now.getTime() - new Date(deal.createdAt).getTime();
    const hoursElapsed = elapsed / (1000 * 60 * 60);
    if (hoursElapsed < (deal.performanceCheckHours ?? 48)) continue;
    const redemptionCount = await transactionsRepo.getDealRedemptionCount(db, deal.id, deal.createdAt);
    if (redemptionCount < deal.performanceThreshold) {
      poorPerforming.push({ ...deal, redemptionCount });
    }
  }

  return c.json({
    totalUsers: profileCount[0]?.count ?? 0,
    totalMemberships: membershipCount[0]?.count ?? 0,
    groups: groupCount[0]?.count ?? 0,
    brands: brandCount[0]?.count ?? 0,
    pendingVerifications: pendingCount[0]?.count ?? 0,
    transactions: transactionCount[0]?.count ?? 0,
    activeRedemptionCodes: activeCodeCount[0]?.count ?? 0,
    poorPerformingDeals: poorPerforming,
  });
});

adminRoutes.post("/deals/auto-expire-poor", async (c) => {
  const publishedDeals = await dealsRepo.listDeals(db, { status: "published" });
  const now = new Date();
  let expiredCount = 0;

  for (const deal of publishedDeals) {
    if (!deal.autoExpirePoorPerformance || deal.performanceThreshold === null || deal.performanceThreshold === undefined) {
      continue;
    }
    const elapsed = now.getTime() - new Date(deal.createdAt).getTime();
    const hoursElapsed = elapsed / (1000 * 60 * 60);
    if (hoursElapsed < (deal.performanceCheckHours ?? 48)) continue;

    const redemptionCount = await transactionsRepo.getDealRedemptionCount(db, deal.id, deal.createdAt);
    if (redemptionCount < deal.performanceThreshold) {
      await dealsRepo.updateDeal(db, deal.id, { status: "expired" });
      expiredCount++;
    }
  }

  return c.json({ expiredCount });
});

adminRoutes.patch("/users/:userId/role", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin");
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const { userId: targetUserId } = c.req.param();
  const { role } = await c.req.json() as { role: AppRole };
  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result);
});

adminRoutes.get("/analytics", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const yearParam = c.req.query("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const analytics = await analyticsService.getAdminAnalytics(db, year);
  return c.json(analytics);
});

adminRoutes.get("/redemption-codes/analytics", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const data = await analyticsService.getRedemptionCodeAnalytics(db);
  return c.json(data);
});

adminRoutes.get("/sub-users", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin");
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const allRoles = await db.select().from(userRolesTable);
  return c.json(allRoles);
});

adminRoutes.post("/sub-users", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => r.role === "super_admin");
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
  const { targetUserId, role } = body as { targetUserId: string; role: AppRole };

  if (!targetUserId || !role) {
    return c.json({ error: "targetUserId and role are required" }, 400);
  }

  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result, 201);
});
