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
const kindEnum = z.enum(["quotation", "invoice", "purchase_order"]);

const PREFIX: Record<string, string> = {
  quotation: "QUO",
  invoice: "INV",
  purchase_order: "PO",
};

export const listTradeDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ kind: kindEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const { data: rows, error } = await ctx.supabase
      .from("trade_documents")
      .select(
        "id, doc_no, doc_date, due_date, status, notes, subtotal, tax_total, total, journal_entry_id, partners(name), branches(name), trade_document_lines(id, description, quantity, unit_price, tax_rate, line_total, products(sku, name))",
      )
      .eq("company_id", data.companyId)
      .eq("kind", data.kind)
      .order("doc_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      partner_name: r.partners?.name ?? null,
      branch_name: r.branches?.name ?? null,
      lines: (r.trade_document_lines ?? []).map((l: any) => ({
        id: l.id,
        description: l.description ?? l.products?.name ?? "—",
        sku: l.products?.sku ?? null,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate),
        line_total: Number(l.line_total),
      })),
    }));
  });

const docLine = z.object({
  productId: z.string().uuid().nullable().optional(),
  description: z.string().max(240).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const createTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({
        kind: kindEnum,
        branchId: z.string().uuid().nullable().optional(),
        partnerId: z.string().uuid().nullable().optional(),
        docDate: z.string().min(8),
        dueDate: z.string().min(8).nullable().optional(),
        notes: z.string().max(400).nullable().optional(),
        lines: z.array(docLine).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");

    const computed = data.lines.map((l) => {
      const net = l.quantity * l.unitPrice;
      return { ...l, net, tax: (net * l.taxRate) / 100 };
    });
    const subtotal = computed.reduce((s, l) => s + l.net, 0);
    const taxTotal = computed.reduce((s, l) => s + l.tax, 0);

    const { data: last } = await ctx.supabase
      .from("trade_documents")
      .select("doc_no")
      .eq("company_id", data.companyId)
      .eq("kind", data.kind)
      .order("doc_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prefix = PREFIX[data.kind]!;
    const lastNum = Number(String(last?.doc_no ?? "").split("-")[1] ?? 0);
    const docNo = `${prefix}-${String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, "0")}`;

    const { data: doc, error } = await ctx.supabase
      .from("trade_documents")
      .insert({
        company_id: data.companyId,
        branch_id: data.branchId ?? null,
        partner_id: data.partnerId ?? null,
        kind: data.kind,
        doc_no: docNo,
        doc_date: data.docDate,
        due_date: data.dueDate || null,
        status: "draft",
        notes: data.notes || null,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_total: Math.round(taxTotal * 100) / 100,
        total: Math.round((subtotal + taxTotal) * 100) / 100,
        created_by: ctx.userId,
      })
      .select("id, doc_no")
      .single();
    if (error) throw new Error(error.message);

    const { error: lineError } = await ctx.supabase.from("trade_document_lines").insert(
      computed.map((l) => ({
        document_id: doc.id,
        company_id: data.companyId,
        product_id: l.productId ?? null,
        description: l.description ?? null,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        tax_rate: l.taxRate,
        line_total: Math.round(l.net * 100) / 100,
      })),
    );
    if (lineError) {
      await ctx.supabase.from("trade_documents").delete().eq("id", doc.id);
      throw new Error(lineError.message);
    }
    return { id: doc.id, docNo: doc.doc_no };
  });

export const deleteTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "company.manage");
    const { error } = await ctx.supabase
      .from("trade_documents")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId)
      .neq("status", "posted");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Posts an invoice or purchase order: writes a balanced journal entry and,
 * when a warehouse is given, the matching stock movements.
 */
export const postTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({ id: z.string().uuid(), warehouseId: z.string().uuid().nullable().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.post");

    const { data: doc, error } = await ctx.supabase
      .from("trade_documents")
      .select(
        "id, kind, doc_no, doc_date, status, branch_id, partner_id, subtotal, tax_total, total, trade_document_lines(product_id, quantity, unit_price, line_total, products(track_inventory, cost_price))",
      )
      .eq("id", data.id)
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document not found");
    if (doc.status === "posted") throw new Error("This document is already posted");
    if (doc.kind === "quotation") throw new Error("Quotations cannot be posted to the ledger");

    const { data: accounts } = await ctx.supabase
      .from("accounts")
      .select("id, code")
      .eq("company_id", data.companyId);
    const byCode = new Map<string, string>((accounts ?? []).map((a: any) => [a.code, a.id]));
    const need = (code: string, label: string) => {
      const id = byCode.get(code);
      if (!id) throw new Error(`Missing account ${code} (${label}) in the chart of accounts`);
      return id;
    };

    const subtotal = Number(doc.subtotal);
    const tax = Number(doc.tax_total);
    const total = Number(doc.total);
    const lines: any[] = [];
    const stock: any[] = [];
    const docLines = (doc.trade_document_lines ?? []) as any[];

    if (doc.kind === "invoice") {
      lines.push({ account_id: need("1100", "Accounts Receivable"), debit: total, credit: 0 });
      lines.push({ account_id: need("4000", "Product Sales"), debit: 0, credit: subtotal });
      if (tax > 0) lines.push({ account_id: need("2100", "VAT Payable"), debit: 0, credit: tax });

      const cogs = docLines.reduce(
        (s, l) => s + (l.products?.track_inventory ? Number(l.quantity) * Number(l.products.cost_price) : 0),
        0,
      );
      if (cogs > 0) {
        lines.push({ account_id: need("5000", "Cost of Goods Sold"), debit: cogs, credit: 0 });
        lines.push({ account_id: need("1200", "Inventory"), debit: 0, credit: cogs });
      }
      if (data.warehouseId) {
        docLines
          .filter((l) => l.product_id && l.products?.track_inventory)
          .forEach((l) =>
            stock.push({
              company_id: data.companyId,
              warehouse_id: data.warehouseId,
              product_id: l.product_id,
              kind: "out",
              quantity: Number(l.quantity),
              unit_cost: Number(l.products.cost_price),
              reference: doc.doc_no,
              moved_at: doc.doc_date,
              created_by: ctx.userId,
            }),
          );
      }
    } else {
      const stocked = docLines.reduce(
        (s, l) => s + (l.products?.track_inventory ? Number(l.line_total) : 0),
        0,
      );
      const expensed = subtotal - stocked;
      if (stocked > 0) lines.push({ account_id: need("1200", "Inventory"), debit: stocked, credit: 0 });
      if (expensed > 0)
        lines.push({ account_id: need("5000", "Cost of Goods Sold"), debit: expensed, credit: 0 });
      if (tax > 0) lines.push({ account_id: need("2100", "VAT Payable"), debit: tax, credit: 0 });
      lines.push({ account_id: need("2000", "Accounts Payable"), debit: 0, credit: total });

      if (data.warehouseId) {
        docLines
          .filter((l) => l.product_id && l.products?.track_inventory)
          .forEach((l) =>
            stock.push({
              company_id: data.companyId,
              warehouse_id: data.warehouseId,
              product_id: l.product_id,
              kind: "in",
              quantity: Number(l.quantity),
              unit_cost: Number(l.unit_price),
              reference: doc.doc_no,
              moved_at: doc.doc_date,
              created_by: ctx.userId,
            }),
          );
      }
    }

    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      throw new Error(`Entry is out of balance: debits ${debit} vs credits ${credit}`);
    }

    const { data: last } = await ctx.supabase
      .from("journal_entries")
      .select("entry_no")
      .eq("company_id", data.companyId)
      .order("entry_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const entryNo = `JE-${String(Number(String(last?.entry_no ?? "JE-0000").split("-")[1] ?? 0) + 1).padStart(4, "0")}`;

    const { data: entry, error: entryError } = await ctx.supabase
      .from("journal_entries")
      .insert({
        company_id: data.companyId,
        branch_id: doc.branch_id,
        partner_id: doc.partner_id,
        entry_no: entryNo,
        entry_date: doc.doc_date,
        memo: `${doc.kind === "invoice" ? "Invoice" : "Purchase order"} ${doc.doc_no}`,
        reference: doc.doc_no,
        status: "draft",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (entryError) throw new Error(entryError.message);

    const { error: jlError } = await ctx.supabase.from("journal_lines").insert(
      lines.map((l) => ({
        entry_id: entry.id,
        company_id: data.companyId,
        account_id: l.account_id,
        partner_id: doc.partner_id,
        description: doc.doc_no,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    if (jlError) {
      await ctx.supabase.from("journal_entries").delete().eq("id", entry.id);
      throw new Error(jlError.message);
    }

    const { error: postError } = await ctx.supabase
      .from("journal_entries")
      .update({ status: "posted" })
      .eq("id", entry.id);
    if (postError) throw new Error(postError.message);

    if (stock.length) await ctx.supabase.from("stock_moves").insert(stock);

    const { error: docError } = await ctx.supabase
      .from("trade_documents")
      .update({ status: "posted", journal_entry_id: entry.id })
      .eq("id", doc.id)
      .eq("company_id", data.companyId);
    if (docError) throw new Error(docError.message);

    return { ok: true, entryNo };
  });
