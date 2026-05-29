import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  stopped: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  chunking: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  processing: "border-primary/30 bg-primary/10 text-primary",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-normal", STATUS_STYLES[status] ?? "text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
