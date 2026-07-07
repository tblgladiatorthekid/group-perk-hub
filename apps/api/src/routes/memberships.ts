import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as membershipsRepo from "../repositories/memberships.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";
import { createAndAutoVerify, stampExpiryOnVerification } from "../services/membership.service";

export const membershipRoutes = new Hono();

membershipRoutes.use("/*", requireAuth);

membershipRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (isAdmin && c.req.query("userId")) {
    const memberships = await membershipsRepo.listMembershipsForUser(db, c.req.query("userId")!);
    return c.json(memberships);
  }
  const memberships = await membershipsRepo.listMembershipsForUser(db, userId);
  return c.json(memberships);
});

membershipRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const membership = await createAndAutoVerify(db, { ...body, userId });
  return c.json(membership, 201);
});

membershipRoutes.get("/:id", async (c) => {
  const membership = await membershipsRepo.getMembership(db, c.req.param("id"));
  if (!membership) return c.json({ error: "Membership not found" }, 404);
  return c.json(membership);
});

membershipRoutes.patch("/:id", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const membership = await stampExpiryOnVerification(db, c.req.param("id"), body);
  return c.json(membership);
});
