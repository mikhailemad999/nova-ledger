import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import { createAccount, listAccounts } from "@/lib/accounting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const title = "Chart of Accounts · Pro Max Accounting ERP";
const description = "Browse and extend the double-entry chart of accounts for your company.";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AccountsPage,
});

type Account = { id: string; code: string; name: string; type: string; is_active: boolean };
const TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

function AccountsPage() {
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const addAccount = useServerFn(createAccount);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as (typeof TYPES)[number] });

  const canWrite = can(tenant.role, "accounting.post");

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", companyId],
    enabled: Boolean(companyId),
    queryFn: () => fetchAccounts({ data: { companyId: companyId! } }) as Promise<Account[]>,
  });

  const save = useMutation({
    mutationFn: () => addAccount({ data: { companyId: companyId!, ...form } }),
    onSuccess: () => {
      toast.success("Account created");
      setOpen(false);
      setForm({ code: "", name: "", type: "asset" });
      queryClient.invalidateQueries({ queryKey: ["accounts", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <AppShell title="Chart of Accounts">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rows.length} accounts</p>
        {canWrite && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New account
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {TYPES.map((type) => (
          <section key={type} className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-display text-sm font-semibold capitalize">
              {type}
            </h2>
            <ul className="divide-y divide-border/60">
              {isLoading && (
                <li className="px-4 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </li>
              )}
              {rows
                .filter((a) => a.type === type)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="num w-14 text-muted-foreground">{a.code}</span>
                    <span className="flex-1">{a.name}</span>
                    {!a.is_active && (
                      <span className="text-xs uppercase text-muted-foreground">inactive</span>
                    )}
                  </li>
                ))}
              {!isLoading && rows.filter((a) => a.type === type).length === 0 && (
                <li className="px-4 py-5 text-sm text-muted-foreground">No accounts.</li>
              )}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as (typeof TYPES)[number] })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
