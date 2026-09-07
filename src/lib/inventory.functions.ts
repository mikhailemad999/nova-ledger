import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can, type AppRole, type Permission } from "./rbac";

type Ctx = { supabase: any; userId: string };

async function requireCompanyPermission(
  ctx: Ctx,
  companyId: string,
  permission: Permission,
): Promise<AppRole> {
  const { data, error } = await ctx.supabase
    .from("memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error("Failed to verify company access");
  if (!data) throw new Error("Forbidden: you are not a member of this company");
  const role = data.role as AppRole;
  if (!can(role, permission)) throw new Error(`Forbidden: ${permission} requires a higher role`);
  return role;
}

const companyInput = z.object({ companyId: z.string().uuid() });

/* ------------------------------- PRODUCTS ------------------------------- */

const productFields = {
  sku: z.string().min(1).max(40),
  name: z.string().min(2).max(160),
  unit: z.string().min(1).max(20).default("unit"),
  salePrice: z.number().min(0).default(0),
  costPrice: z.number().min(0).default(0),
  trackInventory: z.boolean().default(true),
};

const productSelect = "id, sku, name, unit, sale_price, cost_price, track_inventory, is_active";

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const [{ data: rows, error }, { data: moves }] = await Promise.all([
      ctx.supabase.from("products").select(productSelect).eq("company_id", data.companyId).order("sku"),
      ctx.supabase
        .from("stock_moves")
        .select("product_id, kind, quantity, unit_cost")
        .eq("company_id", data.companyId),
    ]);
    if (error) throw new Error(error.message);

    const onHand = new Map<string, { qty: number; value: number }>();
    for (const m of (moves ?? []) as any[]) {
      const sign = m.kind === "out" ? -1 : 1;
      const cur = onHand.get(m.product_id) ?? { qty: 0, value: 0 };
      cur.qty += sign * Number(m.quantity);
      cur.value += sign * Number(m.quantity) * Number(m.unit_cost);
      onHand.set(m.product_id, cur);
    }
    return (rows ?? []).map((p: any) => ({
      ...p,
      on_hand: onHand.get(p.id)?.qty ?? 0,
      stock_value: onHand.get(p.id)?.value ?? 0,
    }));
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend(productFields).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { data: row, error } = await ctx.supabase
      .from("products")
      .insert({
        company_id: data.companyId,
        sku: data.sku,
        name: data.name,
        unit: data.unit,
        sale_price: data.salePrice,
        cost_price: data.costPrice,
        track_inventory: data.trackInventory,
      })
      .select(productSelect)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ id: z.string().uuid(), ...productFields }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { error } = await ctx.supabase
      .from("products")
      .update({
        sku: data.sku,
        name: data.name,
        unit: data.unit,
        sale_price: data.salePrice,
        cost_price: data.costPrice,
        track_inventory: data.trackInventory,
      })
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "company.manage");
    const { error } = await ctx.supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ WAREHOUSES ------------------------------ */

const warehouseSelect = "id, name, code, address, branch_id, is_active";

export const listWarehouses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const [{ data: rows, error }, { data: moves }] = await Promise.all([
      ctx.supabase
        .from("warehouses")
        .select(`${warehouseSelect}, branches(name)`)
        .eq("company_id", data.companyId)
        .order("code"),
      ctx.supabase
        .from("stock_moves")
        .select("warehouse_id, kind, quantity, unit_cost")
        .eq("company_id", data.companyId),
    ]);
    if (error) throw new Error(error.message);
    const agg = new Map<string, { qty: number; value: number }>();
    for (const m of (moves ?? []) as any[]) {
      const sign = m.kind === "out" ? -1 : 1;
      const cur = agg.get(m.warehouse_id) ?? { qty: 0, value: 0 };
      cur.qty += sign * Number(m.quantity);
      cur.value += sign * Number(m.quantity) * Number(m.unit_cost);
      agg.set(m.warehouse_id, cur);
    }
    return (rows ?? []).map((w: any) => ({
      ...w,
      branch_name: w.branches?.name ?? null,
      on_hand: agg.get(w.id)?.qty ?? 0,
      stock_value: agg.get(w.id)?.value ?? 0,
    }));
  });

const warehouseFields = {
  name: z.string().min(2).max(120),
  code: z.string().min(1).max(20),
  address: z.string().max(300).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
};

export const createWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend(warehouseFields).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { data: row, error } = await ctx.supabase
      .from("warehouses")
      .insert({
        company_id: data.companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address || null,
        branch_id: data.branchId ?? null,
      })
      .select(warehouseSelect)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ id: z.string().uuid(), ...warehouseFields }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { error } = await ctx.supabase
      .from("warehouses")
      .update({
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address || null,
        branch_id: data.branchId ?? null,
      })
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "company.manage");
    const { error } = await ctx.supabase
      .from("warehouses")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- STOCK MOVES ------------------------------ */

export const listStockMoves = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const { data: rows, error } = await ctx.supabase
      .from("stock_moves")
      .select(
        "id, kind, quantity, unit_cost, reference, note, moved_at, products(sku, name), warehouses(code, name)",
      )
      .eq("company_id", data.companyId)
      .order("moved_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((m: any) => ({
      id: m.id,
      kind: m.kind,
      quantity: Number(m.quantity),
      unit_cost: Number(m.unit_cost),
      value: Number(m.quantity) * Number(m.unit_cost),
      reference: m.reference,
      note: m.note,
      moved_at: m.moved_at,
      product: m.products ? `${m.products.sku} · ${m.products.name}` : "—",
      warehouse: m.warehouses?.name ?? "—",
    }));
  });

export const createStockMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({
        warehouseId: z.string().uuid(),
        productId: z.string().uuid(),
        kind: z.enum(["in", "out", "adjustment"]),
        quantity: z.number().positive(),
        unitCost: z.number().min(0).default(0),
        reference: z.string().max(60).nullable().optional(),
        note: z.string().max(240).nullable().optional(),
        movedAt: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { error } = await ctx.supabase.from("stock_moves").insert({
      company_id: data.companyId,
      warehouse_id: data.warehouseId,
      product_id: data.productId,
      kind: data.kind,
      quantity: data.quantity,
      unit_cost: data.unitCost,
      reference: data.reference || null,
      note: data.note || null,
      moved_at: data.movedAt,
      created_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
