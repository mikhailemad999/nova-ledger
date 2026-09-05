import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import {
  createJournalEntry,
  listAccounts,
  listJournalEntries,
  listPartners,
  postJournalEntry,
} from "@/lib/accounting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const title = "Journal Entries · Pro Max Accounting ERP";
const description = "Record, review and post balanced double-entry journal entries.";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: JournalPage,
});

type Account = { id: string; code: string; name: string; type: string };
type Line = { accountId: string; description: string; debit: string; credit: string };
type Entry = {
  id: string;
  entry_no: string;
  entry_date: string;
  memo: string | null;
  reference: string | null;
  status: "draft" | "posted" | "void";
  partner_name: string | null;
  total: number;
  journal_lines: {
    id: string;
    debit: number;
    credit: number;
    description: string | null;
    accounts: { code: string; name: string } | null;
  }[];
};

const emptyLine: Line = { accountId: "", description: "", debit: "", credit: "" };

function JournalPage() {
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const currency = tenant.company?.currency ?? "USD";
  const queryClient = useQueryClient();
  const fetchEntries = useServerFn(listJournalEntries);
  const fetchAccounts = useServerFn(listAccounts);
  const fetchCustomers = useServerFn(listPartners);
  const addEntry = useServerFn(createJournalEntry);
  const post = useServerFn(postJournalEntry);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }, { ...emptyLine }]);

  const canPost = can(tenant.role, "accounting.post");
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const entries = useQuery({
    queryKey: ["journal", companyId, tenant.branch?.id ?? null],
    enabled: Boolean(companyId),
    queryFn: () =>
      fetchEntries({
        data: { companyId: companyId!, branchId: tenant.branch?.id ?? null },
      }) as Promise<Entry[]>,
  });

  const accounts = useQuery({
    queryKey: ["accounts", companyId],
    enabled: Boolean(companyId),
    queryFn: () => fetchAccounts({ data: { companyId: companyId! } }) as Promise<Account[]>,
  });

  const partners = useQuery({
    queryKey: ["partners", companyId, "all"],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const [customers, suppliers] = await Promise.all([
        fetchCustomers({ data: { companyId: companyId!, kind: "customer" as const } }),
        fetchCustomers({ data: { companyId: companyId!, kind: "supplier" as const } }),
      ]);
      return [...(customers as any[]), ...(suppliers as any[])] as { id: string; name: string }[];
    },
  });

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.round((debit - credit) * 100) === 0 && debit > 0 };
  }, [lines]);

  const create = useMutation({
    mutationFn: (shouldPost: boolean) =>
      addEntry({
        data: {
          companyId: companyId!,
          branchId: tenant.branch?.id ?? null,
          partnerId: partnerId || null,
          entryDate,
          memo: memo || undefined,
          reference: reference || undefined,
          post: shouldPost,
          lines: lines
            .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
            .map((l) => ({
              accountId: l.accountId,
              description: l.description || undefined,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            })),
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`${res.entryNo} ${res.posted ? "posted" : "saved as draft"}`);
      setOpen(false);
      setLines([{ ...emptyLine }, { ...emptyLine }]);
      setMemo("");
      setReference("");
      setPartnerId("");
      queryClient.invalidateQueries({ queryKey: ["journal", companyId] });
      queryClient.invalidateQueries({ queryKey: ["metrics", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postEntry = useMutation({
    mutationFn: (id: string) => post({ data: { companyId: companyId!, id } }),
    onSuccess: () => {
      toast.success("Entry posted");
      queryClient.invalidateQueries({ queryKey: ["journal", companyId] });
      queryClient.invalidateQueries({ queryKey: ["metrics", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = entries.data ?? [];

  return (
    <AppShell title="Journal Entries">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} entries{tenant.branch ? ` · ${tenant.branch.name}` : ""}
        </p>
        {canPost && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New entry
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Memo</th>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <Fragment key={e.id}>
                <tr
                  className="cursor-pointer border-b border-border/60 hover:bg-secondary/40"
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <td className="num px-4 py-3 font-medium">{e.entry_no}</td>
                  <td className="num px-4 py-3 text-muted-foreground">{e.entry_date}</td>
                  <td className="px-4 py-3">{e.memo ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.partner_name ?? "—"}</td>
                  <td className="num px-4 py-3 text-right">{fmt(e.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                        e.status === "posted"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canPost && e.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          postEntry.mutate(e.id);
                        }}
                      >
                        <Check className="size-3.5" aria-hidden /> Post
                      </Button>
                    )}
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr className="border-b border-border/60 bg-secondary/20">
                    <td colSpan={7} className="px-8 py-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {e.journal_lines.map((l) => (
                            <tr key={l.id}>
                              <td className="num py-1 pr-4 text-muted-foreground">
                                {l.accounts?.code}
                              </td>
                              <td className="py-1 pr-4">{l.accounts?.name}</td>
                              <td className="py-1 pr-4 text-muted-foreground">
                                {l.description ?? ""}
                              </td>
                              <td className="num py-1 pr-4 text-right">
                                {Number(l.debit) > 0 ? fmt(Number(l.debit)) : ""}
                              </td>
                              <td className="num py-1 text-right">
                                {Number(l.credit) > 0 ? fmt(Number(l.credit)) : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!entries.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No journal entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New journal entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref">Reference</Label>
                <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner">Customer / Supplier</Label>
                <select
                  id="partner"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">None</option>
                  {(partners.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="memo">Memo</Label>
              <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    aria-label={`Account for line ${i + 1}`}
                    className="col-span-5 h-10 rounded-md border border-input bg-background px-2 text-sm"
                    value={line.accountId}
                    onChange={(e) =>
                      setLines(lines.map((l, j) => (i === j ? { ...l, accountId: e.target.value } : l)))
                    }
                  >
                    <option value="">Select account…</option>
                    {(accounts.data ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Description for line ${i + 1}`}
                    placeholder="Description"
                    className="col-span-3"
                    value={line.description}
                    onChange={(e) =>
                      setLines(lines.map((l, j) => (i === j ? { ...l, description: e.target.value } : l)))
                    }
                  />
                  <Input
                    aria-label={`Debit for line ${i + 1}`}
                    placeholder="Debit"
                    inputMode="decimal"
                    className="col-span-2"
                    value={line.debit}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, j) =>
                          i === j ? { ...l, debit: e.target.value, credit: "" } : l,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Credit for line ${i + 1}`}
                    placeholder="Credit"
                    inputMode="decimal"
                    className="col-span-1"
                    value={line.credit}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, j) =>
                          i === j ? { ...l, credit: e.target.value, debit: "" } : l,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line ${i + 1}`}
                    className="col-span-1"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { ...emptyLine }])}
              >
                <Plus className="size-4" aria-hidden /> Add line
              </Button>
            </div>

            <div className="num flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm">
              <span>Debits {fmt(totals.debit)}</span>
              <span>Credits {fmt(totals.credit)}</span>
              <span className={totals.balanced ? "text-emerald-400" : "text-destructive"}>
                {totals.balanced ? "Balanced" : `Difference ${fmt(totals.debit - totals.credit)}`}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={create.isPending || !totals.balanced}
                onClick={() => create.mutate(false)}
              >
                Save draft
              </Button>
              <Button
                className="flex-1"
                disabled={create.isPending || !totals.balanced}
                onClick={() => create.mutate(true)}
              >
                {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Post entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
