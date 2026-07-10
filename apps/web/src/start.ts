import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// No functionMiddleware: this app has no TanStack Start server functions —
// authenticated calls go through the Hono API via apiClient (which attaches
// the Clerk session token itself), not through server-function RPCs.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
