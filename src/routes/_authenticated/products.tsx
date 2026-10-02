import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import { createProduct, deleteProduct, listProducts, updateProduct } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const title = "Products · Pro Max Accounting ERP";
const description = "Manage products, prices and on-hand stock with live inventory valuation.";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ProductsPage,
});

type Draft = {
  id?: string;
  sku: string;
  name: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  trackInventory: boolean;
};
const empty: Draft = { sku: "", name: "", unit: "unit", salePrice: 0, costPrice: 0, trackInventory: true };
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function ProductsPage() {
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const qc = useQueryClient();
  const fetchAll = useServerFn(listProducts);
  const add = useServerFn(createProduct);
  const edit = useServerFn(updateProduct);
  const del = useServerFn(deleteProduct);
  const [draft, setDraft] = useState<Draft | null>(null);
  const canWrite = can(tenant.role, "sales.manage");
  const canDelete = can(tenant.role, "company.manage");

  const { data, isLoading } = useQuery({
    queryKey: ["products", companyId],
    enabled: Boolean(companyId),
    queryFn: () => fetchAll({ data: { companyId: companyId! } }) as Promise<any[]>,
  });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = { companyId: companyId!, ...d };
      return d.id ? edit({ data: { ...payload, id: d.id } }) : add({ data: payload });
    },
    onSuccess: () => {
      toast.success("Product saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["products", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { companyId: companyId!, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const valuation = rows.reduce((s, p) => s + Number(p.stock_value), 0);

  return (
    <AppShell title="Products">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} products · Inventory value <span className="num font-medium text-foreground">{money(valuation)}</span>
        </p>
        {canWrite && (
          <Button onClick={() => setDraft({ ...empty })}>
            <Plus className="size-4" /> New product
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Sale price</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">On hand</th>
              <th className="px-4 py-3 text-right">Stock value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="num px-4 py-3">{p.sku}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="num px-4 py-3 text-right">{money(Number(p.sale_price))}</td>
                <td className="num px-4 py-3 text-right">{money(Number(p.cost_price))}</td>
                <td className="num px-4 py-3 text-right">
                  {p.track_inventory ? `${p.on_hand} ${p.unit}` : "—"}
                </td>
                <td className="num px-4 py-3 text-right">{p.track_inventory ? money(p.stock_value) : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${p.name}`}
                      onClick={() =>
                        setDraft({
                          id: p.id,
                          sku: p.sku,
                          name: p.name,
                          unit: p.unit,
                          salePrice: Number(p.sale_price),
                          costPrice: Number(p.cost_price),
                          trackInventory: p.track_inventory,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" required value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pname">Name</Label>
                <Input id="pname" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" required value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale">Sale price</Label>
                <Input id="sale" type="number" min="0" step="0.01" value={draft.salePrice} onChange={(e) => setDraft({ ...draft, salePrice: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost price</Label>
                <Input id="cost" type="number" min="0" step="0.01" value={draft.costPrice} onChange={(e) => setDraft({ ...draft, costPrice: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={draft.trackInventory} onChange={(e) => setDraft({ ...draft, trackInventory: e.target.checked })} />
                Track stock
              </label>
              <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
