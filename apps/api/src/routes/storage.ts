import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../services/storage.service";
import crypto from "crypto";

export const storageRoutes = new Hono();

storageRoutes.use("/*", requireAuth);

storageRoutes.post("/presign-upload", async (c) => {
  const userId = c.var.userId;
  const { bucket, fileName } = await c.req.json();
  const ext = fileName?.split(".").pop() ?? "bin";
  const key = `${bucket}/${userId}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await getPresignedUploadUrl(bucket, key);
  return c.json({ uploadUrl, key, expiresIn: 3600 });
});

storageRoutes.get("/presign-download", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.json({ error: "key query param required" }, 400);
  const bucket = key.split("/")[0];
  const downloadUrl = await getPresignedDownloadUrl(bucket, key);
  return c.json({ downloadUrl, key, expiresIn: 3600 });
});
