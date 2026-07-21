import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.DEMO_PORT || 8080);
const PUBLIC_DIR = join(import.meta.dirname, ".output", "public");
const workerUrl = pathToFileURL(join(import.meta.dirname, ".output", "server", "index.mjs")).href;
const { default: worker } = await import(workerUrl);

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = join(PUBLIC_DIR, decodeURIComponent(url.pathname));

  if (url.pathname !== "/" && existsSync(filePath) && statSync(filePath).isFile()) {
    res.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
    createReadStream(filePath).pipe(res);
    return;
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    duplex: "half",
  });

  try {
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`demo server listening on http://0.0.0.0:${PORT}`);
});
