import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ShieldCheck, Sparkles, TrendingUp, Store, Users } from "lucide-react";
import { Logo } from "@/components/perk/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#brands" className="hover:text-foreground">For brands</a>
            <a href="#tribes" className="hover:text-foreground">Tribes</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" } as never}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified membership. Real perks.
              </span>
              <h1 className="mt-6 text-balance font-display text-4xl font-bold tracking-tight md:text-6xl">
                Discounts built for
                <span className="text-primary"> Nigeria's tribes.</span>
              </h1>
              <p className="mt-5 text-balance text-lg text-muted-foreground md:text-xl">
                NYSC corps members, alumni associations, ICAN, NBA, cooperatives, staff bodies —
                verify once and unlock exclusive perks from brands who want to reach you.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" } as never}>Verify my membership</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{ mode: "signup", role: "brand" } as never}>List my brand</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Free for members. Brands pay only per verified redemption.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-primary/5 via-accent/5 to-transparent" />
        </section>

        {/* How */}
        <section id="how" className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center font-display text-3xl font-bold">How PerkHub works</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              One verification, one digital membership card, unlimited discounts across partner brands.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  Icon: ShieldCheck,
                  title: "1. Prove your tribe",
                  body: "Upload your ID, use an official email, or enter your membership number. Auto-verified where possible; manual review otherwise.",
                },
                {
                  Icon: Sparkles,
                  title: "2. Unlock the deals",
                  body: "Browse offers filtered to your groups. Restaurants, tech, travel, health, telecoms — Nigerian and global brands.",
                },
                {
                  Icon: BadgeCheck,
                  title: "3. Redeem in one tap",
                  body: "Show your digital badge or claim a unique code. Every redemption is tracked, private, and yours to keep.",
                },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elev-1)]">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tribes */}
        <section id="tribes" className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold">Which tribe are you?</h2>
              <p className="mt-2 text-muted-foreground">Sign up and search for your specific group — or request a new one.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[
              "NYSC Corps Members",
              "University Alumni Associations",
              "ICAN, NBA, NMA & Professional Bodies",
              "Cooperative Societies",
              "Corporate Staff Associations",
              "Trade Unions & Religious Orgs",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Brands */}
        <section id="brands" className="border-t border-border/60 bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium">
                <Store className="h-3.5 w-3.5" />
                For Brands & Businesses
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                Reach millions of verified Nigerians. Pay only when they buy.
              </h2>
              <p className="mt-4 text-primary-foreground/80">
                Target by affiliation, cap redemptions, track every conversion. We handle verification and reporting;
                you handle the great offer. No wasted spend on unverified traffic.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth" search={{ mode: "signup", role: "brand" } as never}>Apply as a brand</Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Verified members", v: "One source of truth" },
                { k: "Commission-based", v: "Pay per redemption" },
                { k: "Group targeting", v: "Reach the right tribe" },
                { k: "Full analytics", v: "See every redemption" },
              ].map(({ k, v }) => (
                <div key={k} className="rounded-2xl bg-primary-foreground/10 p-5">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  <div className="mt-3 font-display text-lg font-semibold">{k}</div>
                  <div className="text-sm text-primary-foreground/70">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} PerkHub Nigeria. Built for the tribes that build Nigeria.</p>
        </div>
      </footer>
    </div>
  );
}
