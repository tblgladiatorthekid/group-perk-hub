import { CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "pending" | "verified" | "rejected" | "expired";

const config: Record<
  Status,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  verified: {
    label: "Verified",
    className: "bg-success/10 text-success border-success/20",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Pending review",
    className: "bg-warning/10 text-warning-foreground border-warning/30",
    Icon: Clock,
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: XCircle,
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
    Icon: AlertTriangle,
  },
};

export function VerifiedBadge({ status, className }: { status: Status; className?: string }) {
  const { label, className: variant, Icon } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
