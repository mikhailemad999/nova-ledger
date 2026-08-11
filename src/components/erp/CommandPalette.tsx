import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navGroups } from "./nav-config";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const available = navGroups.filter((group) => group.to);
  const upcoming = navGroups.flatMap((group) =>
    group.items?.length ? group.items.map((i) => i.label) : group.to ? [] : [group.label],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, records, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {available.map((group) => (
            <CommandItem
              key={group.label}
              value={group.label}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: group.to! });
              }}
            >
              {group.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Planned modules">
          {upcoming.map((label) => (
            <CommandItem key={label} value={label} disabled>
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}