import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPostingPlan, type PostingDoc } from "./posting";
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

export const listTradeDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ kind: kindEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const { data: rows, error } = await ctx.supabase
      .from("trade_documents")
      .select(
        "id, doc_no, doc_date, due_date, status, notes, subtotal, tax_total, total, journal_entry_id, partner_id, partners(name), branches(name), trade_document_lines(id, product_id, description, quantity, unit_price, tax_rate, line_total, products(sku, name))",
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
        product_id: l.product_id ?? null,
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
        requestId: z.string().uuid(),
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
    const { data: docs, error } = await ctx.supabase.rpc("create_trade_document_draft", {
      p_company_id: data.companyId,
      p_kind: data.kind,
      p_branch_id: data.branchId ?? null,
      p_partner_id: data.partnerId ?? null,
      p_doc_date: data.docDate,
      p_due_date: data.dueDate ?? null,
      p_notes: data.notes ?? null,
      p_request_id: data.requestId,
      p_lines: data.lines.map((line) => ({
        product_id: line.productId ?? null,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
      })),
    });
    if (error) throw new Error(error.message);
    const doc = docs?.[0];
    if (!doc) throw new Error("The draft could not be saved");
    return { id: doc.id, docNo: doc.doc_no };
  });

/** Edits a draft document: replaces its header fields and lines. Posted documents are refused. */
export const updateTradeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({
        id: z.string().uuid(),
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

    const { data: docs, error } = await ctx.supabase.rpc("update_trade_document_draft", {
      p_company_id: data.companyId,
      p_document_id: data.id,
      p_partner_id: data.partnerId ?? null,
      p_doc_date: data.docDate,
      p_due_date: data.dueDate ?? null,
      p_notes: data.notes ?? null,
      p_lines: data.lines.map((line) => ({
        product_id: line.productId ?? null,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
      })),
    });
    if (error) throw new Error(error.message);
    const doc = docs?.[0];
    if (!doc) throw new Error("The draft could not be updated");
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
    const plan = buildPostingPlan(doc as PostingDoc, byCode, Boolean(data.warehouseId));
    const lines = plan.lines;
    const stock = plan.moves.map((m) => ({
      ...m,
      company_id: data.companyId,
      warehouse_id: data.warehouseId,
      reference: doc.doc_no,
      moved_at: doc.doc_date,
      created_by: ctx.userId,
    }));

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
