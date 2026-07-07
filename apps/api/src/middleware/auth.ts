import { createClerkClient, type AuthObject } from "@clerk/backend";
import type { AppRole } from "@perkhub/shared";
import { createMiddleware } from "hono/factory";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthObject;
    rawBody?: string;
    userId: string;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) {
    return c.json({ error: "Unauthorized: No token provided" }, 401);
  }

  try {
    const auth = await clerkClient.authenticateRequest(c.req.raw);
    if (!auth.isSignedIn) {
      return c.json({ error: "Unauthorized: Invalid session" }, 401);
    }
    c.set("auth", auth.toAuth());
    c.set("userId", auth.toAuth().userId!);
    await next();
  } catch {
    return c.json({ error: "Unauthorized: Invalid session" }, 401);
  }
});

export function requireRole(...roles: AppRole[]) {
  return createMiddleware(async (c, next) => {
    const { userId } = c.var;
    const userRoles = await getRolesFromDb(userId);
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    await next();
  });
}

async function getRolesFromDb(userId: string): Promise<AppRole[]> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../db/client");
  const { userRoles } = await import("../db/schema");
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));

  return rows.map((row) => row.role as AppRole);
}

export const requireWebhookSignature = createMiddleware(async (c, next) => {
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing webhook headers" }, 401);
  }

  const { Webhook } = await import("svix");
  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const body = await c.req.text();

  try {
    webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    c.set("rawBody", body);
    await next();
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }
});
