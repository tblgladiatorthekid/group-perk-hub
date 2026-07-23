import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import type { AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/brand")({
  ssr: false,
  beforeLoad: async () => {
    const roles = await apiClient<{ role: AppRole }[]>("/roles/me");
    const hasAccess = roles.some((r) =>
      ["brand_partner", "brand_manager", "super_admin"].includes(r.role),
    );
    if (!hasAccess) throw redirect({ to: "/app" });
  },
  component: () => <Outlet />,
});
