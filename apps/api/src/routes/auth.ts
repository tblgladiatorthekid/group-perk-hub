import { Hono } from "hono";
import { requireWebhookSignature } from "../middleware/auth";
import { handleUserCreated, handleUserUpdated, handleUserDeleted } from "../services/auth.service";
import { db } from "../db/client";

interface ClerkWebhookEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
    public_metadata: Record<string, unknown>;
    private_metadata: Record<string, unknown>;
    created_at: number;
    updated_at: number;
  };
}

export const authRoutes = new Hono();

authRoutes.post("/clerk-webhook", requireWebhookSignature, async (c) => {
  const rawBody = c.var.rawBody!;
  const event: ClerkWebhookEvent = JSON.parse(rawBody);

  try {
    switch (event.type) {
      case "user.created":
        await handleUserCreated(db, event.data);
        break;
      case "user.updated":
        await handleUserUpdated(db, event.data);
        break;
      case "user.deleted":
        await handleUserDeleted(db, event.data);
        break;
    }
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error(`[Webhook] Error handling ${event.type}:`, err);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});
