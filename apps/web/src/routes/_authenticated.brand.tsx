import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import type { AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/brand")({
  ssr: false,
  beforeLoad: async () => {
    const roles = await apiClient<{ role: AppRole }[]>("/roles/me");
    if (!roles.some((r) => r.role === "brand_partner" || r.role === "admin")) {
      throw redirect({ to: "/app" });
    }
  },
  component: () => <Outlet />,
});
