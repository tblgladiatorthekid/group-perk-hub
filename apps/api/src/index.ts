import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { errorHandler } from "./middleware/error";
import { authRoutes } from "./routes/auth";

export function createApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.route("/api/auth", authRoutes);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = Number.parseInt(process.env.API_PORT || "3001", 10);

  serve({ fetch: app.fetch, port });
  console.log(`API server running at http://localhost:${port}`);
}
