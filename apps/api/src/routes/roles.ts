import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const roleRoutes = new Hono();

roleRoutes.use("/*", requireAuth);

roleRoutes.get("/me", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  return c.json(roles);
});

roleRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const { userId: targetUserId, role } = await c.req.json();
  const result = await userRolesRepo.addRole(db, targetUserId, role);
  return c.json(result, 201);
});

roleRoutes.delete("/:userId/:role", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "super_admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await userRolesRepo.removeRole(db, c.req.param("userId"), c.req.param("role") as any);
  return c.json({ success: true });
});
