import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus } from "lucide-react";
import type { AffiliationGroup, GroupWhitelistEntry } from "@perkhub/shared";
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
import { useRoles } from "@/hooks/use-auth";

const groupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum([
    "cooperative",
    "alumni",
    "professional",
    "nysc",
    "corporate",
    "religious",
    "union",
    "other",
  ]),
  description: z.string().optional(),
  verificationMethods: z
    .array(z.enum(["id_upload", "email_domain", "membership_number"]))
    .min(1, "Pick at least one verification method"),
  emailDomains: z.string().optional(),
  badgeValidityMonths: z.coerce.number().int().min(1, "Must be at least 1 month"),
});
type GroupForm = z.infer<typeof groupSchema>;

const VERIFICATION_METHOD_OPTIONS = [
  ["id_upload", "ID document upload"],
  ["email_domain", "Email domain match"],
  ["membership_number", "Membership number / whitelist"],
] as const;

export const Route = createFileRoute("/_authenticated/admin/groups")({
  component: AdminGroups,
});

function AdminGroups() {
  const qc = useQueryClient();
  const { data: roles } = useRoles();
  const isSuperAdmin = roles?.includes("super_admin") ?? false;
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AffiliationGroup | null>(null);
  const [whitelistGroup, setWhitelistGroup] = useState<AffiliationGroup | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => apiClient<AffiliationGroup[]>("/groups?status=all"),
  });

  const form = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      type: "other",
      description: "",
      verificationMethods: [],
      emailDomains: "",
      badgeValidityMonths: 12,
    },
  });

  function openCreate() {
    setEditingGroup(null);
    form.reset({
      name: "",
      type: "other",
      description: "",
      verificationMethods: [],
      emailDomains: "",
      badgeValidityMonths: 12,
    });
    setOpen(true);
  }

  function openEdit(g: AffiliationGroup) {
    setEditingGroup(g);
    form.reset({
      name: g.name,
      type: g.type,
      description: g.description ?? "",
      verificationMethods: g.verificationMethods,
      emailDomains: g.emailDomains.join(", "),
      badgeValidityMonths: g.badgeValidityMonths,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async (v: GroupForm) => {
      const payload = {
        name: v.name,
        type: v.type,
        description: v.description?.trim() ? v.description.trim() : null,
        verificationMethods: v.verificationMethods,
        emailDomains: v.emailDomains
          ? v.emailDomains
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean)
          : [],
        badgeValidityMonths: v.badgeValidityMonths,
      };
      return editingGroup
        ? apiClient<AffiliationGroup>(`/groups/${editingGroup.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : apiClient<AffiliationGroup>("/groups", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      toast.success(editingGroup ? "Group updated" : "Group created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["admin-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save group"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient<AffiliationGroup>(`/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      toast.success("Group updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const selectedMethods = form.watch("verificationMethods");

  return (
    <DashboardShell
      title="Affiliation groups"
      subtitle="Create and manage the groups members verify against."
      nav={[{ to: "/admin", label: "Back to overview", icon: <ArrowLeft className="h-4 w-4" /> }]}
      accent="Admin"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {groups?.length ?? 0} group{groups?.length === 1 ? "" : "s"} total
        </p>
        {isSuperAdmin && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New group
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          title="No affiliation groups yet"
          description="Create your first group so members have something to verify against."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-start md:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">{g.name}</div>
                  <Badge variant="outline" className="capitalize">
                    {g.type}
                  </Badge>
                  <Badge variant={g.active ? "default" : "secondary"}>
                    {g.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {g.description && (
                  <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {g.verificationMethods.map((m) => (
                    <Badge key={m} variant="outline" className="capitalize">
                      {m.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {g.emailDomains.length > 0
                    ? `Domains: ${g.emailDomains.join(", ")}`
                    : "No email domains"}{" "}
                  · Badge valid {g.badgeValidityMonths} month
                  {g.badgeValidityMonths === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isSuperAdmin && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                    Edit
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setWhitelistGroup(g)}>
                    Whitelist
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant={g.active ? "outline" : "default"}
                    onClick={() => toggleActive.mutate({ id: g.id, active: !g.active })}
                    disabled={toggleActive.isPending}
                  >
                    {g.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit group" : "New affiliation group"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="e.g. NYSC Batch A 2026" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v: GroupForm["type"]) =>
                  form.setValue("type", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="nysc">NYSC</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="religious">Religious</SelectItem>
                  <SelectItem value="union">Union</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={2} {...form.register("description")} />
            </div>

            <div className="space-y-1.5">
              <Label>Verification methods</Label>
              <div className="space-y-1.5 rounded-md border border-border p-3">
                {VERIFICATION_METHOD_OPTIONS.map(([value, label]) => {
                  const checked = selectedMethods.includes(value);
                  return (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const current = form.getValues("verificationMethods");
                          const next = v ? [...current, value] : current.filter((m) => m !== value);
                          form.setValue("verificationMethods", next, { shouldValidate: true });
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
              {form.formState.errors.verificationMethods && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.verificationMethods.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Email domains (comma-separated, optional)</Label>
              <Input {...form.register("emailDomains")} placeholder="unilag.edu.ng, nysc.gov.ng" />
            </div>

            <div className="space-y-1.5">
              <Label>Badge validity (months)</Label>
              <Input type="number" min={1} {...form.register("badgeValidityMonths")} />
              {form.formState.errors.badgeValidityMonths && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.badgeValidityMonths.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editingGroup ? "Save changes" : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WhitelistDialog group={whitelistGroup} onOpenChange={(v) => !v && setWhitelistGroup(null)} />
    </DashboardShell>
  );
}

function WhitelistDialog({
  group,
  onOpenChange,
}: {
  group: AffiliationGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [membershipNumber, setMembershipNumber] = useState("");
  const [fullName, setFullName] = useState("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["group-whitelist", group?.id],
    enabled: !!group,
    queryFn: () => apiClient<GroupWhitelistEntry[]>(`/groups/${group!.id}/whitelist`),
  });

  const addEntry = useMutation({
    mutationFn: () =>
      apiClient<GroupWhitelistEntry>(`/groups/${group!.id}/whitelist`, {
        method: "POST",
        body: JSON.stringify({ membershipNumber, fullName: fullName || null }),
      }),
    onSuccess: () => {
      setMembershipNumber("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["group-whitelist", group?.id] });
      toast.success("Added to whitelist");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add entry"),
  });

  const removeEntry = useMutation({
    mutationFn: (entryId: string) =>
      apiClient(`/groups/${group!.id}/whitelist/${entryId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-whitelist", group?.id] });
      toast.success("Removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove entry"),
  });

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group?.name} whitelist</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!membershipNumber.trim()) return;
            addEntry.mutate();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="wl-number">Membership number</Label>
            <Input
              id="wl-number"
              value={membershipNumber}
              onChange={(e) => setMembershipNumber(e.target.value)}
              placeholder="e.g. NYSC/2026/123456"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="wl-name">Full name (optional)</Label>
            <Input id="wl-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button type="submit" disabled={addEntry.isPending || !membershipNumber.trim()}>
            Add
          </Button>
        </form>

        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !entries || entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No whitelist entries yet.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="font-mono text-sm">{entry.membershipNumber}</div>
                  {entry.fullName && (
                    <div className="text-xs text-muted-foreground">{entry.fullName}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeEntry.mutate(entry.id)}
                  disabled={removeEntry.isPending}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
