import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";
import { profiles, userMemberships, affiliationGroups, brands, transactions } from "../db/schema";
import { count, eq } from "drizzle-orm";

export const adminRoutes = new Hono();

adminRoutes.use("/*", requireAuth);

adminRoutes.get("/stats", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const [profileCount, membershipCount, groupCount, brandCount, pendingCount, transactionCount] =
    await Promise.all([
      db.select({ count: count() }).from(profiles),
      db.select({ count: count() }).from(userMemberships),
      db.select({ count: count() }).from(affiliationGroups),
      db.select({ count: count() }).from(brands),
      db.select({ count: count() }).from(userMemberships).where(eq(userMemberships.status, "pending")),
      db.select({ count: count() }).from(transactions),
    ]);

  return c.json({
    totalUsers: profileCount[0]?.count ?? 0,
    totalMemberships: membershipCount[0]?.count ?? 0,
    groups: groupCount[0]?.count ?? 0,
    brands: brandCount[0]?.count ?? 0,
    pendingVerifications: pendingCount[0]?.count ?? 0,
    transactions: transactionCount[0]?.count ?? 0,
  });
});

adminRoutes.patch("/users/:userId/role", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const { userId: targetUserId } = c.req.param();
  const { role } = await c.req.json();
  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result);
});
