import { useAuth, useUser } from "@clerk/tanstack-react-start";
import { useQuery } from "@tanstack/react-query";
import type { AppRole, AdminSubRole, BrandSubRole } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";

export type { AppRole, AdminSubRole, BrandSubRole } from "@perkhub/shared";

export function useAuthStatus() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  return { isSignedIn, userId, user };
}

export function useRoles() {
  const { userId, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["user_roles", userId],
    enabled: !!isSignedIn && !!userId,
    queryFn: async () => {
      const roles = await apiClient<{ role: AppRole }[]>("/roles/me");
      return roles.map((r) => r.role);
    },
  });
}

export function primaryRole(roles: AppRole[] | undefined): AppRole {
  if (!roles || roles.length === 0) return "consumer";
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("affiliation_admin")) return "affiliation_admin";
  if (roles.includes("commerce_admin")) return "commerce_admin";
  if (roles.includes("brand_partner") || roles.includes("brand_manager")) return "brand_partner";
  return "consumer";
}

export function homePathFor(role: AppRole): string {
  if (role === "super_admin") return "/admin";
  if (role === "affiliation_admin") return "/admin/groups";
  if (role === "commerce_admin") return "/admin/deals";
  if (role === "brand_partner" || role === "brand_manager") return "/brand";
  return "/app";
}

export function hasAdminAccess(roles: AppRole[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) =>
    ["super_admin", "affiliation_admin", "commerce_admin"].includes(r),
  );
}

export function hasBrandAccess(roles: AppRole[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) => ["brand_partner", "brand_manager"].includes(r));
}
