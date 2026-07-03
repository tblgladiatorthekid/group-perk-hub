import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { homePathFor, primaryRole, type AppRole } from "@/hooks/use-auth";

// /_authenticated leaf: figures out the primary role and forwards to /app, /brand, or /admin.
export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const role = primaryRole((data ?? []).map((r) => r.role as AppRole));
    throw redirect({ to: homePathFor(role) });
  },
  component: () => null,
});
