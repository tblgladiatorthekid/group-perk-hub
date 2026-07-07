import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { errorHandler } from "./middleware/error";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profiles";
import { roleRoutes } from "./routes/roles";
import { groupRoutes } from "./routes/groups";
import { membershipRoutes } from "./routes/memberships";
import { brandRoutes } from "./routes/brands";
import { dealRoutes } from "./routes/deals";
import { savedDealRoutes } from "./routes/saved-deals";
import { transactionRoutes } from "./routes/transactions";
import { invoiceRoutes } from "./routes/invoices";
import { adminRoutes } from "./routes/admin";
import { storageRoutes } from "./routes/storage";

export function createApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.route("/api/auth", authRoutes);
  app.route("/api/profiles", profileRoutes);
  app.route("/api/roles", roleRoutes);
  app.route("/api/groups", groupRoutes);
  app.route("/api/memberships", membershipRoutes);
  app.route("/api/brands", brandRoutes);
  app.route("/api/deals", dealRoutes);
  app.route("/api/saved-deals", savedDealRoutes);
  app.route("/api/transactions", transactionRoutes);
  app.route("/api/invoices", invoiceRoutes);
  app.route("/api/admin", adminRoutes);
  app.route("/api/storage", storageRoutes);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = Number.parseInt(process.env.API_PORT || "3001", 10);

  serve({ fetch: app.fetch, port });
  console.log(`API server running at http://localhost:${port}`);
}
