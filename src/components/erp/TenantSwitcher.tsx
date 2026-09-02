import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, GitBranch, LogOut, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalTenant } from "@/hooks/useTenant";
import { useServerFn } from "@tanstack/react-start";
import { createBranch, createCompany } from "@/lib/tenant.functions";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function TenantSwitcher() {
  const tenant = useOptionalTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addCompany = useServerFn(createCompany);
  const addBranch = useServerFn(createBranch);
  const [dialog, setDialog] = useState<"company" | "branch" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleCreate() {
    if (!tenant) return;
    setBusy(true);
    try {
      if (dialog === "company") {
        const company = await addCompany({ data: { name, currency: "USD" } });
        tenant.refresh();
        await tenant.setCompany(company.id);
        toast.success("Company created");
      } else if (dialog === "branch" && tenant.company) {
        await addBranch({ data: { companyId: tenant.company.id, name, code } });
        tenant.refresh();
        toast.success("Branch created");
      }
      setDialog(null);
      setName("");
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  if (!tenant) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <Building2 className="size-4 text-primary" aria-hidden />
            <span className="hidden sm:inline">{tenant.company?.name ?? "No company"}</span>
            {tenant.branch && (
              <span className="hidden text-muted-foreground md:inline">/ {tenant.branch.code}</span>
            )}
            <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Companies</DropdownMenuLabel>
          {tenant.companies.length === 0 && (
            <DropdownMenuItem disabled>No companies yet</DropdownMenuItem>
          )}
          {tenant.companies.map((c) => (
            <DropdownMenuItem key={c.id} onSelect={() => void tenant.setCompany(c.id)}>
              <Check
                className={`size-4 ${tenant.company?.id === c.id ? "opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[c.role]}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => setDialog("company")}>
            <Plus className="size-4" aria-hidden /> New company
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Branches</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void tenant.setBranch(null)}>
            <Check className={`size-4 ${!tenant.branch ? "opacity-100" : "opacity-0"}`} aria-hidden />
            All branches
          </DropdownMenuItem>
          {tenant.branches.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => void tenant.setBranch(b.id)}>
              <Check
                className={`size-4 ${tenant.branch?.id === b.id ? "opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <GitBranch className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="flex-1">{b.name}</span>
              <span className="num text-xs text-muted-foreground">{b.code}</span>
            </DropdownMenuItem>
          ))}
          {can(tenant.role, "branch.manage") && tenant.company && (
            <DropdownMenuItem onSelect={() => setDialog("branch")}>
              <Plus className="size-4" aria-hidden /> New branch
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {tenant.profile?.email ?? "Signed in"}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void handleSignOut()}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "company" ? "New company" : "New branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            {dialog === "branch" && (
              <Input placeholder="Code (e.g. HQ)" value={code} onChange={(e) => setCode(e.target.value)} />
            )}
            <Button className="w-full" disabled={busy || name.length < 2} onClick={() => void handleCreate()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
