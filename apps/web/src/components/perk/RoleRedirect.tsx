import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useRoles, primaryRole, homePathFor } from "@/hooks/use-auth";
import { Logo } from "@/components/perk/Logo";
import { Loader as Loader2 } from "lucide-react";

/**
 * Fetches the signed-in user's roles then navigates to the correct dashboard.
 * Renders a full-screen loading state while the API call is in flight.
 */
export function RoleRedirect({ fallback }: { fallback?: string }) {
  const navigate = useNavigate();
  const { data: roles, isLoading, isError } = useRoles();

  useEffect(() => {
    if (isLoading) return;
    const dest = isError || !roles
      ? (fallback ?? "/app")
      : homePathFor(primaryRole(roles));
    navigate({ to: dest, replace: true });
  }, [roles, isLoading, isError, navigate, fallback]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Taking you to your dashboard…
      </div>
    </div>
  );
}
