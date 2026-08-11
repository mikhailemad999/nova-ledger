import { useState, type ReactNode } from "react";
import { Menu, Search, Bell, Plus, Building2, ChevronsUpDown } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <AppSidebar />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <AppSidebar />
            </SheetContent>
          </Sheet>

          <h1 className="font-display text-base font-semibold sm:text-lg">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary md:flex"
            >
              <Search className="size-4" aria-hidden />
              Search
              <kbd className="num rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setPaletteOpen(true)}
            >
              <Bell className="size-5" />
            </Button>
            <div className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:flex">
              <Building2 className="size-4 text-primary" aria-hidden />
              Acme Holding
              <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
            </div>
            <Button size="icon" aria-label="Quick create" onClick={() => setPaletteOpen(true)}>
              <Plus className="size-5" />
            </Button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}