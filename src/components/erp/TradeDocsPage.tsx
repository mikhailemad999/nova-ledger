import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { AppShell } from "./AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import { listPartners } from "@/lib/accounting.functions";
import { listProducts, listWarehouses } from "@/lib/inventory.functions";
import {
  createTradeDocument,
  deleteTradeDocument,
  listTradeDocuments,
  postTradeDocument,
} from "@/lib/trade.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export type TradeKind = "quotation" | "invoice" | "purchase_order";

const META: Record<TradeKind, { title: string; single: string; partner: "customer" | "supplier" }> = {
  quotation: { title: "Quotations", single: "quotation", partner: "customer" },
  invoice: { title: "Invoices", single: "invoice", partner: "customer" },
  purchase_order: { title: "Purchase Orders", single: "purchase order", partner: "supplier" },
};

type Line = { productId: string; description: string; quantity: number; unitPrice: number; taxRate: number };
const emptyLine: Line = { productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 };

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function TradeDocsPage({ kind }: { kind: TradeKind }) {
  const meta = META[kind];
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const queryClient = useQueryClient();
  const fetchDocs = useServerFn(listTradeDocuments);
  const fetchPartners = useServerFn(listPartners);
  const fetchProducts = useServerFn(listProducts);
  const fetchWarehouses = useServerFn(listWarehouses);
  const addDoc = useServerFn(createTradeDocument);
  const postDoc = useServerFn(postTradeDocument);
  const removeDoc = useServerFn(deleteTradeDocument);

  const canWrite = can(tenant.role, "sales.manage");
  const canPost = can(tenant.role, "accounting.post");
  const canDelete = can(tenant.role, "company.manage");

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [warehouseId, setWarehouseId] = useState("");

  const key = ["trade", companyId, kind];
  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: Boolean(companyId),
    queryFn: () => fetchDocs({ data: { companyId: companyId!, kind } }) as Promise<any[]>,
  });
  const { data: partners } = useQuery({
    queryKey: ["partners", companyId, meta.partner],
    enabled: Boolean(companyId),
    queryFn: () =>
      fetchPartners({ data: { companyId: companyId!, kind: meta.partner } }) as Promise<any[]>,
  });
  const { data: products } = useQuery({
    queryKey: ["products", companyId],
    enabled: Boolean(companyId),
    queryFn: () => fetchProducts({ data: { companyId: companyId! } }) as Promise<any[]>,
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    enabled: Boolean(companyId),
    queryFn: () => fetchWarehouses({ data: { companyId: companyId! } }) as Promise<any[]>,
  });

  const reset = () => {
    setPartnerId("");
    setDueDate("");
    setNotes("");
    setLines([{ ...emptyLine }]);
  };

  const save = useMutation({
    mutationFn: () =>
      addDoc({
        data: {
          companyId: companyId!,
          kind,
          branchId: tenant.branch?.id ?? null,
          partnerId: partnerId || null,
          docDate,
          dueDate: dueDate || null,
          notes: notes || null,
          lines: lines.map((l) => ({
            productId: l.productId || null,
            description: l.description || undefined,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            taxRate: Number(l.taxRate),
          })),
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`${r.docNo} created`);
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      postDoc({ data: { companyId: companyId!, id, warehouseId: warehouseId || null } }),
    onSuccess: (r: any) => {
      toast.success(`Posted to the ledger as ${r.entryNo}`);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeDoc({ data: { companyId: companyId!, id } }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
  const taxTotal = lines.reduce(
    (s, l) => s + (Number(l.quantity) * Number(l.unitPrice) * Number(l.taxRate)) / 100,
    0,
  );

  return (
    <AppShell title={meta.title}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {meta.single}
          {rows.length === 1 ? "" : "s"} in {tenant.company?.name ?? "this company"}
        </p>
        <div className="flex items-center gap-2">
          {kind !== "quotation" && (
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-label="Warehouse used when posting"
            >
              <option value="">No stock movement</option>
              {(warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          {canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> New {meta.single}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">{meta.partner === "customer" ? "Customer" : "Supplier"}</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No {meta.single}s yet.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <Fragment key={d.id}>
                <tr className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <button
                      className="flex items-center gap-2 font-medium"
                      onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    >
                      {expanded === d.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                      {d.doc_no}
                    </button>
                  </td>
                  <td className="num px-4 py-3 text-muted-foreground">{d.doc_date}</td>
                  <td className="px-4 py-3">{d.partner_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        d.status === "posted"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-right">{money(Number(d.subtotal))}</td>
                  <td className="num px-4 py-3 text-right">{money(Number(d.tax_total))}</td>
                  <td className="num px-4 py-3 text-right font-medium">{money(Number(d.total))}</td>
                  <td className="px-4 py-3 text-right">
                    {kind !== "quotation" && canPost && d.status !== "posted" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={post.isPending}
                        onClick={() => post.mutate(d.id)}
                      >
                        <Send className="mr-1 size-4" /> Post
                      </Button>
                    )}
                    {canDelete && d.status !== "posted" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${d.doc_no}`}
                        onClick={() => remove.mutate(d.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
                {expanded === d.id && (
                  <tr className="border-b border-border/60 bg-muted/30">
                    <td colSpan={8} className="px-6 py-3">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 text-left">Item</th>
                            <th className="py-1 text-right">Qty</th>
                            <th className="py-1 text-right">Unit price</th>
                            <th className="py-1 text-right">Tax %</th>
                            <th className="py-1 text-right">Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.lines.map((l: any) => (
                            <tr key={l.id}>
                              <td className="py-1">
                                {l.sku ? `${l.sku} · ` : ""}
                                {l.description}
                              </td>
                              <td className="num py-1 text-right">{l.quantity}</td>
                              <td className="num py-1 text-right">{money(l.unit_price)}</td>
                              <td className="num py-1 text-right">{l.tax_rate}</td>
                              <td className="num py-1 text-right">{money(l.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {d.notes && <p className="mt-2 text-xs text-muted-foreground">{d.notes}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New {meta.single}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="partner">{meta.partner === "customer" ? "Customer" : "Supplier"}</Label>
                <select
                  id="partner"
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {(partners ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docDate">Date</Label>
                <Input
                  id="docDate"
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lines</Label>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    aria-label="Product"
                    className="col-span-4 h-10 rounded-md border border-border bg-background px-2 text-sm"
                    value={l.productId}
                    onChange={(e) => {
                      const p = (products ?? []).find((x) => x.id === e.target.value);
                      const next = [...lines];
                      next[i] = {
                        ...l,
                        productId: e.target.value,
                        description: p?.name ?? l.description,
                        unitPrice: p
                          ? Number(kind === "purchase_order" ? p.cost_price : p.sale_price)
                          : l.unitPrice,
                      };
                      setLines(next);
                    }}
                  >
                    <option value="">Free text…</option>
                    {(products ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="col-span-3"
                    aria-label="Description"
                    placeholder="Description"
                    value={l.description}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...l, description: e.target.value };
                      setLines(next);
                    }}
                  />
                  <Input
                    className="col-span-1"
                    aria-label="Quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...l, quantity: Number(e.target.value) };
                      setLines(next);
                    }}
                  />
                  <Input
                    className="col-span-2"
                    aria-label="Unit price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...l, unitPrice: Number(e.target.value) };
                      setLines(next);
                    }}
                  />
                  <Input
                    className="col-span-1"
                    aria-label="Tax rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={l.taxRate}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...l, taxRate: Number(e.target.value) };
                      setLines(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines(lines.filter((_, x) => x !== i))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { ...emptyLine }])}>
                <Plus className="mr-1 size-4" /> Add line
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm">
              <span className="text-muted-foreground">
                Subtotal {money(subtotal)} · Tax {money(taxTotal)}
              </span>
              <span className="num font-semibold">{money(subtotal + taxTotal)}</span>
            </div>

            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Save draft
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
