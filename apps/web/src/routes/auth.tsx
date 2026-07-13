import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { SignIn, SignUp, useAuth } from "@clerk/tanstack-react-start";

import { Logo } from "@/components/perk/Logo";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["consumer", "brand"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

// Clerk's <SignIn/>/<SignUp/> components handle email/password, Google OAuth
// (once enabled as a social connection in the Clerk dashboard), and the
// forgot-password flow internally — no custom Supabase calls needed here.
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

  const defaultRedirect = search.role === "brand" ? "/brand" : "/app";
  const redirectTo = search.redirect ?? defaultRedirect;

  // Preserve role/redirect context across Clerk's own sign-in/sign-up
  // navigation links, not just our own toggle button below.
  const authHref = (targetMode: "signin" | "signup") => {
    const params = new URLSearchParams({ mode: targetMode });
    if (search.role) params.set("role", search.role);
    if (search.redirect) params.set("redirect", search.redirect);
    return `/auth?${params.toString()}`;
  };

  // If already signed in, bounce.
  useEffect(() => {
    if (isSignedIn) navigate({ to: redirectTo, replace: true });
  }, [isSignedIn, navigate, redirectTo]);

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

          <div className="mt-6">
            {mode === "signup" ? (
              <SignUp
                routing="hash"
                signInUrl={authHref("signin")}
                fallbackRedirectUrl={redirectTo}
                unsafeMetadata={{ intended_role: search.role ?? "consumer" }}
                appearance={clerkAppearance}
              />
            ) : (
              <SignIn
                routing="hash"
                signUpUrl={authHref("signup")}
                fallbackRedirectUrl={redirectTo}
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
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
