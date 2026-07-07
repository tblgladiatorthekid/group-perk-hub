import { useAuth, useUser } from "@clerk/tanstack-react-start";
import { useQuery } from "@tanstack/react-query";
import type { AppRole } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";

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
  if (roles.includes("admin")) return "admin";
  if (roles.includes("brand_partner")) return "brand_partner";
  return "consumer";
}

export function homePathFor(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "brand_partner") return "/brand";
  return "/app";
}
