import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "./AppShell";
import { useTenant } from "@/hooks/useTenant";
import { can } from "@/lib/rbac";
import {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
} from "@/lib/accounting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Partner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  is_active: boolean;
};

type Draft = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
};

const empty: Draft = { name: "", email: "", phone: "", taxId: "", address: "" };

export function PartnersPage({ kind }: { kind: "customer" | "supplier" }) {
  const label = kind === "customer" ? "Customer" : "Supplier";
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const queryClient = useQueryClient();
  const fetchPartners = useServerFn(listPartners);
  const addPartner = useServerFn(createPartner);
  const editPartner = useServerFn(updatePartner);
  const removePartner = useServerFn(deletePartner);
  const [draft, setDraft] = useState<Draft | null>(null);

  const canWrite = can(tenant.role, "sales.manage");
  const canDelete = can(tenant.role, "company.manage");

  const { data, isLoading } = useQuery({
    queryKey: ["partners", companyId, kind],
    enabled: Boolean(companyId),
    queryFn: () => fetchPartners({ data: { companyId: companyId!, kind } }) as Promise<Partner[]>,
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        companyId: companyId!,
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        taxId: d.taxId || null,
        address: d.address || null,
      };
      return d.id
        ? editPartner({ data: { ...payload, id: d.id } })
        : addPartner({ data: { ...payload, kind } });
    },
    onSuccess: () => {
      toast.success(`${label} saved`);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["partners", companyId, kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removePartner({ data: { companyId: companyId!, id } }),
    onSuccess: () => {
      toast.success(`${label} deleted`);
      queryClient.invalidateQueries({ queryKey: ["partners", companyId, kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <AppShell title={`${label}s`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {label.toLowerCase()}
          {rows.length === 1 ? "" : "s"} in {tenant.company?.name ?? "this company"}
        </p>
        {canWrite && (
          <Button onClick={() => setDraft({ ...empty })}>
            <Plus className="size-4" aria-hidden /> New {label.toLowerCase()}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Tax ID</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No {label.toLowerCase()}s yet.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                <td className="num px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                <td className="num px-4 py-3 text-muted-foreground">{p.tax_id ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${p.name}`}
                      onClick={() =>
                        setDraft({
                          id: p.id,
                          name: p.name,
                          email: p.email ?? "",
                          phone: p.phone ?? "",
                          taxId: p.tax_id ?? "",
                          address: p.address ?? "",
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
                      aria-label={`Delete ${p.name}`}
                      onClick={() => remove.mutate(p.id)}
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

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft);
              }}
            >
              {(
                [
                  ["name", "Name", true],
                  ["email", "Email", false],
                  ["phone", "Phone", false],
                  ["taxId", "Tax ID", false],
                  ["address", "Address", false],
                ] as const
              ).map(([field, text, required]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{text}</Label>
                  <Input
                    id={field}
                    value={draft[field]}
                    required={required}
                    type={field === "email" ? "email" : "text"}
                    onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
