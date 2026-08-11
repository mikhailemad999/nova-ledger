import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-config";

type Props = { onNavigate?: () => void };

export function AppSidebar({ onNavigate }: Props) {
  const [open, setOpen] = useState<string | null>("Sales");

  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Gauge className="size-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-sidebar-foreground">Pro Max ERP</p>
          <p className="text-xs text-muted-foreground">Accounting Suite</p>
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {navGroups.map((group) => {
          const Icon = group.icon;
          if (group.to) {
            return (
              <Link
                key={group.label}
                to={group.to}
                onClick={onNavigate}
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {group.label}
              </Link>
            );
          }

          const isOpen = open === group.label;
          const hasChildren = Boolean(group.items?.length);

          return (
            <div key={group.label}>
              <button
                type="button"
                aria-expanded={hasChildren ? isOpen : undefined}
                onClick={() => hasChildren && setOpen(isOpen ? null : group.label)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{group.label}</span>
                {hasChildren ? (
                  <ChevronDown
                    className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                ) : (
                  <span className="rounded-full border border-sidebar-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                )}
              </button>
              {hasChildren && isOpen && (
                <ul className="ml-6 border-l border-sidebar-border pl-3">
                  {group.items!.map((item) => (
                    <li key={item.label}>
                      <span className="flex items-center justify-between py-1.5 pr-2 text-sm text-muted-foreground">
                        {item.label}
                        <span className="text-[10px] uppercase tracking-wide">Soon</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
        Phase 1 · Shell &amp; Dashboard
      </div>
    </nav>
  );
}