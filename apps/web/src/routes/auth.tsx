import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { SignIn, SignUp, useAuth } from "@clerk/tanstack-react-start";
import { BadgeCheck, Building2, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/perk/Logo";
import { RoleRedirect } from "@/components/perk/RoleRedirect";
import { apiClient } from "@/lib/api-client";
import { primaryRole, homePathFor, type AppRole } from "@/hooks/use-auth";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["consumer", "brand"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

type SignupRole = "consumer" | "brand";

const roleCards: {
  value: SignupRole;
  label: string;
  tagline: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "consumer",
    label: "Member",
    tagline: "Verify your affiliation and unlock partner discounts.",
    icon: <BadgeCheck className="h-5 w-5" />,
  },
  {
    value: "brand",
    label: "Brand partner",
    tagline: "Reach verified Nigerian audiences. Pay per redemption.",
    icon: <Building2 className="h-5 w-5" />,
  },
];

const clerkAppearance = {
  elements: {
    rootBox: "mx-auto w-full",
    cardBox: "shadow-none border-none w-full",
    card: "shadow-none border-none p-0 bg-transparent w-full",
    header: "hidden",
    footer: "mt-6",
  },
};

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const mode = search.mode ?? "signin";

  const [signupRole, setSignupRole] = useState<SignupRole>(search.role ?? "consumer");

  // After sign-in, resolve the real role then redirect appropriately.
  const [resolving, setResolving] = useState(false);

  // Preserve role/redirect context across Clerk's own sign-in/sign-up
  // navigation links, not just our own toggle button below.
  const authHref = (targetMode: "signin" | "signup") => {
    const params = new URLSearchParams({ mode: targetMode });
    if (search.role) params.set("role", search.role);
    if (search.redirect) params.set("redirect", search.redirect);
    return `/auth?${params.toString()}`;
  };

  const resolveRoles = useCallback(async (retries = 5): Promise<void> => {
    try {
      const roles = await apiClient<{ role: AppRole }[]>("/roles/me");
      const dest = homePathFor(primaryRole(roles.map((r) => r.role)));
      navigate({ to: dest, replace: true });
    } catch {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1200));
        return resolveRoles(retries - 1);
      }
      navigate({ to: "/app", replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!isSignedIn) return;

    if (search.redirect) {
      navigate({ to: search.redirect, replace: true });
      return;
    }

    setResolving(true);
    resolveRoles();
  }, [isSignedIn, navigate, search.redirect, resolveRoles]);

  if (resolving) return <RoleRedirect />;

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden flex-col bg-primary p-10 text-primary-foreground md:flex">
        <Logo />

        {/* Role showcase */}
        <div className="mt-12 flex flex-col gap-4">
          {[
            {
              icon: <BadgeCheck className="h-5 w-5" />,
              title: "Members",
              body: "Verify once — NYSC, alumni, professional bodies, cooperatives — and unlock discounts from every partner brand.",
            },
            {
              icon: <Building2 className="h-5 w-5" />,
              title: "Brand partners",
              body: "Target verified Nigerian audiences. Pay only when a member redeems your deal.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              title: "Admins",
              body: "Review verifications, approve brands, and publish deals across the platform.",
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex gap-3 rounded-xl bg-primary-foreground/10 p-4">
              <div className="mt-0.5 shrink-0 text-accent">{icon}</div>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-0.5 text-xs text-primary-foreground/70">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-12">
          <blockquote className="max-w-md font-display text-xl leading-snug">
            "One verification, every perk. This is how Nigerian membership should have always worked."
          </blockquote>
          <p className="mt-3 text-sm text-primary-foreground/70">— PerkHub team</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 md:hidden">
            <Logo />
          </div>

          <h1 className="font-display text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Tell us who you are — we'll tailor your experience."
              : "Sign in to your PerkHub account to access your dashboard."}
          </p>

          {/* Role selector — only on sign-up */}
          {mode === "signup" && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {roleCards.map((card) => {
                const active = signupRole === card.value;
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setSignupRole(card.value)}
                    className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                        : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {card.icon}
                    </span>
                    <span className="text-sm font-semibold leading-tight">{card.label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{card.tagline}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6">
            {mode === "signup" ? (
              <SignUp
                routing="hash"
                signInUrl={authHref("signin")}
                fallbackRedirectUrl={signupRole === "brand" ? "/brand" : "/app"}
                unsafeMetadata={{ intended_role: signupRole }}
                appearance={clerkAppearance}
              />
            ) : (
              <SignIn
                routing="hash"
                signUpUrl={authHref("signup")}
                fallbackRedirectUrl="/auth"
                appearance={clerkAppearance}
              />
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to PerkHub?"}{" "}
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/auth",
                  search: { ...search, mode: mode === "signup" ? "signin" : "signup" },
                  replace: true,
                })
              }
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
