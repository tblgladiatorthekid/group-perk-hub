import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, Heart, Home, Sparkles, Tag, Ticket, User } from "lucide-react";
import type { Brand, Deal, SavedDeal, UserMembership } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/deals")({
  component: DealsPage,
});

const nav = [
  { to: "/app", label: "Overview", icon: <Home className="h-4 w-4" /> },
  { to: "/app/verify", label: "Verify membership", icon: <BadgeCheck className="h-4 w-4" /> },
  { to: "/app/membership", label: "My card", icon: <Ticket className="h-4 w-4" /> },
  { to: "/app/deals", label: "Deals", icon: <Sparkles className="h-4 w-4" /> },
  { to: "/app/redeem", label: "Redeem code", icon: <Tag className="h-4 w-4" /> },
  { to: "/app", label: "Profile (soon)", icon: <User className="h-4 w-4" /> },
];

function discountLabel(d: Deal) {
  switch (d.discountType) {
    case "percent":
      return `${d.discountValue}% off`;
    case "fixed":
      return `₦${d.discountValue.toLocaleString("en-NG")} off`;
    case "bogo":
      return "Buy one, get one";
    case "free_item":
      return "Free item";
  }
}

function DealsPage() {
  const qc = useQueryClient();
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [showOther, setShowOther] = useState(false);

  const { data: deals } = useQuery({
    queryKey: ["deals", "published"],
    queryFn: () => apiClient<Deal[]>("/deals"),
  });

  const { data: brands } = useQuery({
    queryKey: ["brands", "approved"],
    queryFn: () => apiClient<Brand[]>("/brands"),
  });

  const { data: memberships } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: () => apiClient<UserMembership[]>("/memberships"),
  });

  const { data: savedDeals } = useQuery({
    queryKey: ["saved-deals"],
    queryFn: () => apiClient<SavedDeal[]>("/saved-deals"),
  });

  const brandMap = useMemo(() => new Map((brands ?? []).map((b) => [b.id, b])), [brands]);
  const savedIds = useMemo(() => new Set((savedDeals ?? []).map((s) => s.dealId)), [savedDeals]);
  const verifiedGroupIds = useMemo(
    () => new Set((memberships ?? []).filter((m) => m.status === "verified").map((m) => m.groupId)),
    [memberships],
  );

  const { matching, other } = useMemo(() => {
    if (!deals) return { matching: [] as Deal[], other: [] as Deal[] };
    if (verifiedGroupIds.size === 0) return { matching: deals, other: [] as Deal[] };
    const matching: Deal[] = [];
    const other: Deal[] = [];
    for (const d of deals) {
      const isMatch = d.targetGroupIds.some((id) => verifiedGroupIds.has(id));
      (isMatch ? matching : other).push(d);
    }
    return { matching, other };
  }, [deals, verifiedGroupIds]);

  const toggleSave = useMutation({
    mutationFn: async ({ dealId, saved }: { dealId: string; saved: boolean }) => {
      if (saved) {
        await apiClient(`/saved-deals/${dealId}`, { method: "DELETE" });
      } else {
        await apiClient("/saved-deals", { method: "POST", body: JSON.stringify({ dealId }) });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-deals"] }),
  });

  const subtitle =
    verifiedGroupIds.size > 0
      ? "Offers unlocked by your verified memberships."
      : "Verify a membership to unlock deals tailored to your groups.";

  return (
    <DashboardShell title="Deals" subtitle={subtitle} nav={nav} accent="Consumer">
      {!deals || deals.length === 0 ? (
        <EmptyState
          title="No deals published yet"
          description="Partner brands haven't published any offers yet — check back soon."
        />
      ) : matching.length === 0 && other.length === 0 ? null : (
        <div className="space-y-8">
          {matching.length > 0 ? (
            <DealGrid
              deals={matching}
              brandMap={brandMap}
              savedIds={savedIds}
              onOpen={setActiveDeal}
              onToggleSave={(dealId, saved) => toggleSave.mutate({ dealId, saved })}
            />
          ) : (
            <EmptyState
              title="No deals for your groups yet"
              description="We'll show offers here as soon as a brand targets one of your verified memberships."
            />
          )}

          {other.length > 0 && (
            <div>
              {!showOther ? (
                <Button variant="outline" onClick={() => setShowOther(true)}>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Show {other.length} deal{other.length === 1 ? "" : "s"} from other groups
                </Button>
              ) : (
                <>
                  <h3 className="mb-3 font-display text-lg font-semibold">Other groups</h3>
                  <DealGrid
                    deals={other}
                    brandMap={brandMap}
                    savedIds={savedIds}
                    onOpen={setActiveDeal}
                    onToggleSave={(dealId, saved) => toggleSave.mutate({ dealId, saved })}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!activeDeal} onOpenChange={(open) => !open && setActiveDeal(null)}>
        <DialogContent className="max-w-lg">
          {activeDeal && (
            <>
              <DialogHeader>
                <DialogTitle>{activeDeal.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {brandMap.get(activeDeal.brandId)?.name ?? "Partner brand"}
                </p>
                <p className="text-sm">{activeDeal.description}</p>
                {activeDeal.terms && (
                  <p className="text-xs text-muted-foreground">{activeDeal.terms}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{discountLabel(activeDeal)}</Badge>
                  <Badge variant="outline" className="capitalize">
                    {activeDeal.channel}
                  </Badge>
                  <Badge variant="outline">
                    Ends {new Date(activeDeal.endDate).toLocaleDateString("en-NG")}
                  </Badge>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setActiveDeal(null)}>
                  Close
                </Button>
                {activeDeal.redemptionUrl && (
                  <Button asChild>
                    <a href={activeDeal.redemptionUrl} target="_blank" rel="noreferrer">
                      Get this deal
                    </a>
                  </Button>
                )}
                <Button asChild>
                  <Link to={`/app/redeem?dealId=${activeDeal.id}`}>
                    <Ticket className="mr-2 h-4 w-4" /> Redeem with code
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function DealGrid({
  deals,
  brandMap,
  savedIds,
  onOpen,
  onToggleSave,
}: {
  deals: Deal[];
  brandMap: Map<string, Brand>;
  savedIds: Set<string>;
  onOpen: (deal: Deal) => void;
  onToggleSave: (dealId: string, saved: boolean) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {deals.map((d) => {
        const saved = savedIds.has(d.id);
        return (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(d)}
            onKeyDown={(e) => e.key === "Enter" && onOpen(d)}
            className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <div className="font-display text-base font-semibold leading-tight">{d.title}</div>
              </div>
              <button
                type="button"
                aria-label={saved ? "Unsave deal" : "Save deal"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(d.id, saved);
                }}
                className="shrink-0 text-muted-foreground transition hover:text-primary"
              >
                <Heart className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`} />
              </button>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {brandMap.get(d.brandId)?.name ?? "Partner brand"}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{discountLabel(d)}</Badge>
              <Badge variant="outline" className="capitalize">
                {d.channel}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
