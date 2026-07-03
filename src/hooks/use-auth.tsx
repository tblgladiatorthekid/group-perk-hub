import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type AppRole = "consumer" | "brand_partner" | "admin";

export function useRoles(user: User | null) {
  return useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
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
