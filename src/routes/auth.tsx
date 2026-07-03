import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/perk/Logo";
import { homePathFor, primaryRole, type AppRole } from "@/hooks/use-auth";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["consumer", "brand"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

async function fetchPrimaryRole(userId: string): Promise<AppRole> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return primaryRole((data ?? []).map((r) => r.role as AppRole));
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // If already logged in, bounce.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const role = await fetchPrimaryRole(user.id);
      navigate({ to: search.redirect ?? homePathFor(role), replace: true });
    });
  }, [navigate, search.redirect]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, intended_role: search.role ?? "consumer" },
          },
        });
        if (error) throw error;
        if (data.user && search.role === "brand") {
          // Grant brand_partner role in addition to default consumer
          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "brand_partner" });
        }
        toast.success("Account created. Welcome to PerkHub!");
        // If email confirmation is off, session is set already.
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          const role = await fetchPrimaryRole(sess.session.user.id);
          navigate({ to: homePathFor(role), replace: true });
        } else {
          toast.info("Check your email to confirm your account.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const role = await fetchPrimaryRole(data.user.id);
        navigate({ to: search.redirect ?? homePathFor(role), replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const role = await fetchPrimaryRole(data.session.user.id);
        navigate({ to: search.redirect ?? homePathFor(role), replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      toast.error("Enter your email first, then click reset.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden bg-primary p-10 text-primary-foreground md:block">
        <Logo className="text-primary-foreground" />
        <div className="mt-auto flex h-full flex-col justify-end">
          <blockquote className="max-w-md font-display text-2xl leading-snug">
            "One verification, every perk. This is how Nigerian membership should have always worked."
          </blockquote>
          <p className="mt-3 text-sm text-primary-foreground/70">— PerkHub team</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? search.role === "brand"
                ? "Apply as a brand partner to reach verified Nigerian audiences."
                : "Verify once, unlock discounts from every partner brand."
              : "Sign in to your PerkHub account."}
          </p>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.2-4.9 9.2-7.3 0-.5 0-.9-.1-1.3H12z" />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or with email
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      required
                      className="pl-9"
                      placeholder="Chidera Okafor"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="pl-9"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    className="pl-9"
                    placeholder="At least 8 characters"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to PerkHub?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
