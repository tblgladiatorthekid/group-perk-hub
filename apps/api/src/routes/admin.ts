import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";
import { profiles } from "../db/schema";
import { userMemberships } from "../db/schema";
import { count } from "drizzle-orm";

export const adminRoutes = new Hono();

adminRoutes.use("/*", requireAuth);

adminRoutes.get("/stats", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);

  const profileCount = await db.select({ count: count() }).from(profiles);
  const membershipCount = await db.select({ count: count() }).from(userMemberships);
  return c.json({
    totalUsers: profileCount[0]?.count ?? 0,
    totalMemberships: membershipCount[0]?.count ?? 0,
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
