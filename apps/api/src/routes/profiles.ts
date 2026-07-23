import { Hono } from "hono";
import { requireAuth, requireAdminSubRole } from "../middleware/auth";
import { db } from "../db/client";
import * as profilesRepo from "../repositories/profiles.repo";

export const profileRoutes = new Hono();

profileRoutes.use("/*", requireAuth);

profileRoutes.get("/", requireAdminSubRole("super_admin", "affiliation_admin", "commerce_admin"), async (c) => {
  const ids = (c.req.query("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const profiles = await profilesRepo.getProfilesByIds(db, ids);
  return c.json(profiles);
});

profileRoutes.get("/me", async (c) => {
  const userId = c.var.userId;
  const profile = await profilesRepo.getProfile(db, userId);
  if (!profile) return c.json({ error: "Profile not found" }, 404);
  return c.json(profile);
});

profileRoutes.patch("/me", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const allowed = ["fullName", "phone", "state", "lga", "avatarUrl"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const profile = await profilesRepo.updateProfile(db, userId, updates);
  return c.json(profile);
});
