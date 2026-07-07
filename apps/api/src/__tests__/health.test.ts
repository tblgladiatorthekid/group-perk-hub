import { describe, expect, it } from "vitest";
import { createApp } from "../index";

describe("GET /api/health", () => {
  it("should return ok status", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
