import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Tag, Ticket } from "lucide-react";
import type { AffiliationGroup, Brand, Deal } from "@perkhub/shared";
import { apiClient } from "@/lib/api-client";
import { DashboardShell, EmptyState } from "@/components/perk/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const dealSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  terms: z.string().optional(),
  discountType: z.enum(["percent", "flat", "bogo", "free_item"]),
  discountValue: z.coerce.number().min(0),
  channel: z.enum(["online", "instore", "both"]),
  redemptionUrl: z.string().url().or(z.literal("")).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  targetGroupIds: z.array(z.string()).min(1, "Pick at least one target group"),
});
type DealForm = z.infer<typeof dealSchema>;

export const Route = createFileRoute("/_authenticated/brand/deals")({
  component: BrandDeals,
});

function BrandDeals() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: myBrand } = useQuery({
    queryKey: ["my-brand"],
    queryFn: () => apiClient<Brand | null>("/brands/mine"),
  });

  const { data: deals } = useQuery({
    queryKey: ["my-deals", myBrand?.id],
    enabled: !!myBrand?.id,
    queryFn: () => apiClient<Deal[]>(`/deals?status=all&brandId=${myBrand!.id}`),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiClient<AffiliationGroup[]>("/groups"),
  });

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      description: "",
      terms: "",
      discountType: "percent",
      discountValue: 10,
      channel: "both",
      redemptionUrl: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      perUserLimit: 1,
      targetGroupIds: [],
    },
  });

  const create = useMutation({
    mutationFn: async (v: DealForm) => {
      return apiClient<Deal>("/deals", {
        method: "POST",
        body: JSON.stringify({
          ...v,
          brandId: myBrand!.id,
          redemptionUrl: v.redemptionUrl || null,
          terms: v.terms || null,
          startDate: new Date(v.startDate).toISOString(),
          endDate: new Date(v.endDate).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      toast.success("Deal submitted for admin review");
      setOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: ["my-deals", myBrand?.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!myBrand) {
    return (
      <DashboardShell
        title="Deals"
        subtitle="Complete your brand application first."
        nav={[{ to: "/brand", label: "Back", icon: <ArrowLeft className="h-4 w-4" /> }]}
        accent="Brand partner"
      >
        <EmptyState
          title="No brand on file"
          description="Submit your brand application before composing deals."
          action={
            <Button asChild>
              <Link to="/brand/apply">Apply as a brand</Link>
            </Button>
          }
        />
      </DashboardShell>
    );
  }

  if (myBrand.status !== "approved") {
    return (
      <DashboardShell
        title="Deals"
        subtitle="Waiting on admin approval."
        nav={[{ to: "/brand", label: "Back", icon: <ArrowLeft className="h-4 w-4" /> }]}
        accent={myBrand.status}
      >
        <EmptyState
          title={`Application ${myBrand.status}`}
          description="Once your brand is approved, you can start composing deals here."
        />
      </DashboardShell>
    );
  }

  const selectedGroups = form.watch("targetGroupIds");

  return (
    <DashboardShell
      title="Your deals"
      subtitle="Compose deals, target the right groups, and track their review status."
      nav={[{ to: "/brand", label: "Back", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent={myBrand.name}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {deals?.length ?? 0} deal{deals?.length === 1 ? "" : "s"} total
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New deal
        </Button>
      </div>

      {!deals || deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Compose your first offer to make it available to verified members."
        />
      ) : (
        <div className="grid gap-3">
          {deals.map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between rounded-2xl border border-border bg-card p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <div className="font-display text-lg font-semibold">{d.title}</div>
                </div>
                <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                  {d.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="capitalize">
                    {d.discountType} · {d.discountValue}
                    {d.discountType === "percent" ? "%" : ""}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {d.channel}
                  </Badge>
                  <Badge variant="outline">
                    Ends {new Date(d.endDate).toLocaleDateString("en-NG")}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  className="capitalize"
                  variant={
                    d.status === "published"
                      ? "default"
                      : d.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {d.status.replace("_", " ")}
                </Badge>
                {d.status === "published" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/brand/deals/${d.id}/redemption-codes`}>
                      <Ticket className="mr-2 h-4 w-4" /> Manage codes
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compose a deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="e.g. 20% off any bowl" />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...form.register("description")} />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Discount type</Label>
                <Select
                  value={form.watch("discountType")}
                  onValueChange={(v: DealForm["discountType"]) =>
                    form.setValue("discountType", v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage off</SelectItem>
                    <SelectItem value="flat">Flat naira off</SelectItem>
                    <SelectItem value="bogo">Buy one, get one</SelectItem>
                    <SelectItem value="free_item">Free item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Discount value</Label>
                <Input type="number" step="0.5" {...form.register("discountValue")} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select
                  value={form.watch("channel")}
                  onValueChange={(v: DealForm["channel"]) =>
                    form.setValue("channel", v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="instore">In-store</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Per-user limit</Label>
                <Input type="number" min={1} {...form.register("perUserLimit")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Redemption URL (optional)</Label>
              <Input {...form.register("redemptionUrl")} placeholder="https://" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" {...form.register("startDate")} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" {...form.register("endDate")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Terms (optional)</Label>
              <Textarea rows={2} {...form.register("terms")} />
            </div>

            <div className="space-y-1.5">
              <Label>Target affiliation groups</Label>
              <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-md border border-border p-3">
                {groups
                  ?.filter((g) => g.active)
                  .map((g) => {
                    const checked = selectedGroups.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedGroups);
                            if (v) next.add(g.id);
                            else next.delete(g.id);
                            form.setValue("targetGroupIds", [...next], { shouldValidate: true });
                          }}
                        />
                        <span className="text-sm">
                          {g.name}
                          <span className="ml-2 text-xs uppercase text-muted-foreground">
                            {g.type}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
              {form.formState.errors.targetGroupIds && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.targetGroupIds.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
