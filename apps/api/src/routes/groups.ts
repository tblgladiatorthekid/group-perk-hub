import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as groupsRepo from "../repositories/groups.repo";
import * as whitelistRepo from "../repositories/whitelist.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const groupRoutes = new Hono();

// Public list: only active by default. `?status=all` requires admin.
groupRoutes.get("/", async (c) => {
  const status = c.req.query("status") ?? "active";
  const all = await groupsRepo.listGroups(db);

  if (status === "active") {
    return c.json(all.filter((g) => g.active));
  }

  // Non-public statuses require admin
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
    const isAdmin = await userRolesRepo.hasRole(db, uid, "admin");
    if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json(all);
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
