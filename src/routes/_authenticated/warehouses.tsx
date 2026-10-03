import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import {
  createStockMove,
  createWarehouse,
  deleteWarehouse,
  listProducts,
  listStockMoves,
  listWarehouses,
  updateWarehouse,
} from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const title = "Warehouses & Stock · Pro Max Accounting ERP";
const description =
  "Manage warehouses and record stock movements with live valuation per location.";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: WarehousesPage,
});

type Draft = { id?: string; name: string; code: string; address: string; branchId: string };
type Move = {
  warehouseId: string;
  productId: string;
  kind: "in" | "out" | "adjustment";
  quantity: number;
  unitCost: number;
  reference: string;
  movedAt: string;
};
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const sel = "h-10 w-full rounded-md border border-border bg-background px-2 text-sm";

function WarehousesPage() {
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const qc = useQueryClient();
  const fetchW = useServerFn(listWarehouses);
  const fetchM = useServerFn(listStockMoves);
  const fetchP = useServerFn(listProducts);
  const add = useServerFn(createWarehouse);
  const edit = useServerFn(updateWarehouse);
  const del = useServerFn(deleteWarehouse);
  const addMove = useServerFn(createStockMove);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const canWrite = can(tenant.role, "sales.manage");
  const canDelete = can(tenant.role, "company.manage");

  const enabled = Boolean(companyId);
  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses", companyId],
    enabled,
    queryFn: () => fetchW({ data: { companyId: companyId! } }) as Promise<any[]>,
  });
  const { data: moves } = useQuery({
    queryKey: ["stock-moves", companyId],
    enabled,
    queryFn: () => fetchM({ data: { companyId: companyId! } }) as Promise<any[]>,
  });
  const { data: products } = useQuery({
    queryKey: ["products", companyId],
    enabled,
    queryFn: () => fetchP({ data: { companyId: companyId! } }) as Promise<any[]>,
  });

  const refresh = () => qc.invalidateQueries();

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        companyId: companyId!,
        name: d.name,
        code: d.code,
        address: d.address || null,
        branchId: d.branchId || null,
      };
      return d.id ? edit({ data: { ...payload, id: d.id } }) : add({ data: payload });
    },
    onSuccess: () => {
      toast.success("Warehouse saved");
      setDraft(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { companyId: companyId!, id } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const saveMove = useMutation({
    mutationFn: (m: Move) =>
      addMove({ data: { companyId: companyId!, ...m, reference: m.reference || null } }),
    onSuccess: () => {
      toast.success("Stock movement recorded");
      setMove(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = warehouses ?? [];

  return (
    <AppShell title="Warehouses & Stock">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} warehouses · Total value{" "}
          <span className="num font-medium text-foreground">
            {money(rows.reduce((s, w) => s + w.stock_value, 0))}
          </span>
        </p>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setMove({
                  warehouseId: rows[0]?.id ?? "",
                  productId: "",
                  kind: "in",
                  quantity: 1,
                  unitCost: 0,
                  reference: "",
                  movedAt: new Date().toISOString().slice(0, 10),
                })
              }
            >
              <ArrowLeftRight className="size-4" /> Record movement
            </Button>
            <Button onClick={() => setDraft({ name: "", code: "", address: "", branchId: "" })}>
              <Plus className="size-4" /> New warehouse
            </Button>
          </div>
        )}
      </div>

      <div className="mb-8 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3 text-right">Units</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-border/60 last:border-0">
                <td className="num px-4 py-3">{w.code}</td>
                <td className="px-4 py-3 font-medium">{w.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{w.branch_name ?? "—"}</td>
                <td className="num px-4 py-3 text-right">{w.on_hand}</td>
                <td className="num px-4 py-3 text-right">{money(w.stock_value)}</td>
                <td className="px-4 py-3 text-right">
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${w.name}`}
                      onClick={() =>
                        setDraft({
                          id: w.id,
                          name: w.name,
                          code: w.code,
                          address: w.address ?? "",
                          branchId: w.branch_id ?? "",
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${w.name}`}
                      onClick={() => remove.mutate(w.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Stock movements</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {(moves ?? []).map((m) => (
              <tr key={m.id} className="border-b border-border/60 last:border-0">
                <td className="num px-4 py-3 text-muted-foreground">{m.moved_at}</td>
                <td className="px-4 py-3">{m.product}</td>
                <td className="px-4 py-3">{m.warehouse}</td>
                <td className="px-4 py-3">
                  {m.kind === "in" ? "In" : m.kind === "out" ? "Out" : "Adjustment"}
                </td>
                <td className="num px-4 py-3 text-right">
                  {m.kind === "out" ? -m.quantity : m.quantity}
                </td>
                <td className="num px-4 py-3 text-right">{money(m.value)}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.reference ?? "—"}</td>
              </tr>
            ))}
            {(moves ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit warehouse" : "New warehouse"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="wname">Name</Label>
                <Input
                  id="wname"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wcode">Code</Label>
                <Input
                  id="wcode"
                  required
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waddr">Address</Label>
                <Input
                  id="waddr"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wbranch">Branch</Label>
                <select
                  id="wbranch"
                  className={sel}
                  value={draft.branchId}
                  onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
                >
                  <option value="">None</option>
                  {tenant.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={move !== null} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record stock movement</DialogTitle>
          </DialogHeader>
          {move && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveMove.mutate(move);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="mwh">Warehouse</Label>
                <select
                  id="mwh"
                  className={sel}
                  required
                  value={move.warehouseId}
                  onChange={(e) => setMove({ ...move, warehouseId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {rows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mprod">Product</Label>
                <select
                  id="mprod"
                  className={sel}
                  required
                  value={move.productId}
                  onChange={(e) => {
                    const p = (products ?? []).find((x) => x.id === e.target.value);
                    setMove({
                      ...move,
                      productId: e.target.value,
                      unitCost: p ? Number(p.cost_price) : move.unitCost,
                    });
                  }}
                >
                  <option value="">Select…</option>
                  {(products ?? [])
                    .filter((p) => p.track_inventory)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkind">Type</Label>
                <select
                  id="mkind"
                  className={sel}
                  value={move.kind}
                  onChange={(e) => setMove({ ...move, kind: e.target.value as Move["kind"] })}
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mdate">Date</Label>
                <Input
                  id="mdate"
                  type="date"
                  value={move.movedAt}
                  onChange={(e) => setMove({ ...move, movedAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqty">Quantity</Label>
                <Input
                  id="mqty"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={move.quantity}
                  onChange={(e) => setMove({ ...move, quantity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcost">Unit cost</Label>
                <Input
                  id="mcost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={move.unitCost}
                  onChange={(e) => setMove({ ...move, unitCost: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mref">Reference</Label>
                <Input
                  id="mref"
                  value={move.reference}
                  onChange={(e) => setMove({ ...move, reference: e.target.value })}
                />
              </div>
              <Button type="submit" className="sm:col-span-2" disabled={saveMove.isPending}>
                Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
