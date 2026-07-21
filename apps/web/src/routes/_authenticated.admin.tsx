import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { apiClient } from "@/lib/api-client";
import type { AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const roles = await apiClient<{ role: AppRole }[]>("/roles/me");
    const hasAccess = roles.some((r) =>
      ["super_admin", "admin", "affiliation_admin", "commerce_admin"].includes(r.role)
    );
    if (!hasAccess) throw redirect({ to: "/app" });
  },
  component: () => <Outlet />,
});
