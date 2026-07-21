import { Hono } from "hono";
import { requireAuth, requireAdminSubRole, requireBrandSubRole } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";
import * as analyticsService from "../services/analytics.service";
import { profiles, userMemberships, affiliationGroups, brands, transactions, redemptionCodes } from "../db/schema";
import { count, eq } from "drizzle-orm";
import type { AppRole } from "@perkhub/shared";

export const adminRoutes = new Hono();

adminRoutes.use("/*", requireAuth);

adminRoutes.get("/stats", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

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

  return c.json({
    totalUsers: profileCount[0]?.count ?? 0,
    totalMemberships: membershipCount[0]?.count ?? 0,
    groups: groupCount[0]?.count ?? 0,
    brands: brandCount[0]?.count ?? 0,
    pendingVerifications: pendingCount[0]?.count ?? 0,
    transactions: transactionCount[0]?.count ?? 0,
    activeRedemptionCodes: activeCodeCount[0]?.count ?? 0,
  });
});

adminRoutes.patch("/users/:userId/role", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => ["super_admin", "admin"].includes(r.role));
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const { userId: targetUserId } = c.req.param();
  const { role } = await c.req.json() as { role: AppRole };
  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result);
});

adminRoutes.get("/analytics", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const yearParam = c.req.query("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const analytics = await analyticsService.getAdminAnalytics(db, year);
  return c.json(analytics);
});

adminRoutes.get("/sub-users", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => ["super_admin", "admin"].includes(r.role));
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const allRoles = await db.select().from(userRoles);
  return c.json(allRoles);
});

adminRoutes.post("/sub-users", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isSuperAdmin = roles.some((r) => ["super_admin", "admin"].includes(r.role));
  if (!isSuperAdmin) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
  const { targetUserId, role } = body as { targetUserId: string; role: AppRole };

  if (!targetUserId || !role) {
    return c.json({ error: "targetUserId and role are required" }, 400);
  }

  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result, 201);
});
