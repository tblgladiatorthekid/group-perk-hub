import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);

  const status = "status" in err && typeof err.status === "number" ? err.status : 500;

  return c.json(
    { error: status === 500 ? "Internal server error" : err.message },
    status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
  );
};
