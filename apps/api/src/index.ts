import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
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
import { redemptionCodeRoutes } from "./routes/redemption-codes";
import { db } from "./db/client";
import * as dealsRepo from "./repositories/deals.repo";
import * as transactionsRepo from "./repositories/transactions.repo";

export function createApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.use(
    "/api/*",
    cors({
      origin: (process.env.WEB_ORIGIN ?? "*").split(","),
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

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
  app.route("/api/redemption-codes", redemptionCodeRoutes);

  return app;
}

function startAutoExpireChecker() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;

  async function runCheck() {
    try {
      const publishedDeals = await dealsRepo.listDeals(db, { status: "published" });
      const now = new Date();
      let expiredCount = 0;

      for (const deal of publishedDeals) {
        if (!deal.autoExpirePoorPerformance || deal.performanceThreshold === null || deal.performanceThreshold === undefined) {
          continue;
        }
        const elapsed = now.getTime() - new Date(deal.createdAt).getTime();
        const hoursElapsed = elapsed / (1000 * 60 * 60);
        if (hoursElapsed < (deal.performanceCheckHours ?? 48)) continue;

        const redemptionCount = await transactionsRepo.getDealRedemptionCount(db, deal.id, deal.createdAt);
        if (redemptionCount < deal.performanceThreshold) {
          await dealsRepo.updateDeal(db, deal.id, { status: "expired" });
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`[auto-expire] Expired ${expiredCount} poor-performing deal(s)`);
      }
    } catch (error) {
      console.error("[auto-expire] Check failed:", error);
    }
  }

  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = Number.parseInt(process.env.API_PORT || "3001", 10);

  startAutoExpireChecker();

  serve({ fetch: app.fetch, port });
  console.log(`API server running at http://localhost:${port}`);
}
