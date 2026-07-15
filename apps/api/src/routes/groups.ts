import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as groupsRepo from "../repositories/groups.repo";
import * as whitelistRepo from "../repositories/whitelist.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const groupRoutes = new Hono();

groupRoutes.get("/", async (c) => {
  const groups = await groupsRepo.listGroups(db);
  return c.json(groups.filter((g) => g.active));
});

groupRoutes.get("/:id", async (c) => {
  const group = await groupsRepo.getGroup(db, c.req.param("id"));
  if (!group) return c.json({ error: "Group not found" }, 404);
  return c.json(group);
});

groupRoutes.post("/", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const group = await groupsRepo.createGroup(db, body);
  return c.json(group, 201);
});

groupRoutes.patch("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const group = await groupsRepo.updateGroup(db, c.req.param("id"), body);
  if (!group) return c.json({ error: "Group not found" }, 404);
  return c.json(group);
});

groupRoutes.delete("/:id", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await groupsRepo.deleteGroup(db, c.req.param("id"));
  return c.json({ success: true });
});

groupRoutes.get("/:id/whitelist", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const entries = await whitelistRepo.listWhitelist(db, c.req.param("id"));
  return c.json(entries);
});

groupRoutes.post("/:id/whitelist", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const entry = await whitelistRepo.addWhitelistEntry(db, c.req.param("id"), body.membershipNumber, body.fullName);
  return c.json(entry, 201);
});

groupRoutes.delete("/:id/whitelist/:entryId", requireAuth, async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  await whitelistRepo.removeWhitelistEntry(db, c.req.param("entryId"));
  return c.json({ success: true });
});
