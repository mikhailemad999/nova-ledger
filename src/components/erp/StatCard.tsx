import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number;
}) {
  const positive = delta >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="panel p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-2 text-2xl font-semibold">{value}</p>
      <p
        className={cn(
          "mt-2 inline-flex items-center gap-1 text-xs",
          positive ? "text-success" : "text-destructive",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        <span className="num">{Math.abs(delta).toFixed(1)}%</span>
        <span className="text-muted-foreground">vs last period</span>
      </p>
    </div>
  );
}