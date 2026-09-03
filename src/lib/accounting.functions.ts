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

/* ------------------------------- PARTNERS ------------------------------- */

const partnerFields = {
  name: z.string().min(2).max(160),
  email: z.string().email().max(160).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  taxId: z.string().max(60).nullable().optional(),
  address: z.string().max(400).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const listPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ kind: z.enum(["customer", "supplier"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const { data: rows, error } = await ctx.supabase
      .from("partners")
      .select("id, name, email, phone, tax_id, address, is_active, created_at")
      .eq("company_id", data.companyId)
      .eq("kind", data.kind)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ kind: z.enum(["customer", "supplier"]), ...partnerFields }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { data: row, error } = await ctx.supabase
      .from("partners")
      .insert({
        company_id: data.companyId,
        kind: data.kind,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        tax_id: data.taxId || null,
        address: data.address || null,
      })
      .select("id, name, email, phone, tax_id, address, is_active, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ id: z.string().uuid(), ...partnerFields }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "sales.manage");
    const { error } = await ctx.supabase
      .from("partners")
      .update({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        tax_id: data.taxId || null,
        address: data.address || null,
        ...(data.isActive === undefined ? {} : { is_active: data.isActive }),
      })
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "company.manage");
    const { error } = await ctx.supabase
      .from("partners")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- ACCOUNTS ------------------------------- */

export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    const { data: rows, error } = await ctx.supabase
      .from("accounts")
      .select("id, code, name, type, is_active")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({
        code: z.string().min(1).max(20),
        name: z.string().min(2).max(160),
        type: z.enum(["asset", "liability", "equity", "income", "expense"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.post");
    const { data: row, error } = await ctx.supabase
      .from("accounts")
      .insert({
        company_id: data.companyId,
        code: data.code,
        name: data.name,
        type: data.type,
      })
      .select("id, code, name, type, is_active")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* --------------------------- JOURNAL ENTRIES ---------------------------- */

export const listJournalEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ branchId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    let query = ctx.supabase
      .from("journal_entries")
      .select(
        "id, entry_no, entry_date, memo, reference, status, branch_id, partners(name), journal_lines(id, debit, credit, description, accounts(code, name))",
      )
      .eq("company_id", data.companyId)
      .order("entry_date", { ascending: false })
      .limit(200);
    if (data.branchId) query = query.eq("branch_id", data.branchId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      partner_name: r.partners?.name ?? null,
      total: (r.journal_lines ?? []).reduce((s: number, l: any) => s + Number(l.debit), 0),
    }));
  });

const lineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().max(240).optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput
      .extend({
        branchId: z.string().uuid().nullable().optional(),
        partnerId: z.string().uuid().nullable().optional(),
        entryDate: z.string().min(8),
        memo: z.string().max(240).optional(),
        reference: z.string().max(60).optional(),
        post: z.boolean().default(false),
        lines: z.array(lineSchema).min(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.post");

    const debit = data.lines.reduce((s, l) => s + l.debit, 0);
    const credit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      throw new Error(`Entry is out of balance: debits ${debit} vs credits ${credit}`);
    }
    if (debit === 0) throw new Error("Entry total cannot be zero");

    const { data: last } = await ctx.supabase
      .from("journal_entries")
      .select("entry_no")
      .eq("company_id", data.companyId)
      .order("entry_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNo = `JE-${String(Number(String(last?.entry_no ?? "JE-0000").split("-")[1] ?? 0) + 1).padStart(4, "0")}`;

    const { data: entry, error } = await ctx.supabase
      .from("journal_entries")
      .insert({
        company_id: data.companyId,
        branch_id: data.branchId ?? null,
        partner_id: data.partnerId ?? null,
        entry_no: nextNo,
        entry_date: data.entryDate,
        memo: data.memo ?? null,
        reference: data.reference ?? null,
        status: "draft",
        created_by: ctx.userId,
      })
      .select("id, entry_no")
      .single();
    if (error) throw new Error(error.message);

    const { error: lineError } = await ctx.supabase.from("journal_lines").insert(
      data.lines.map((l) => ({
        entry_id: entry.id,
        company_id: data.companyId,
        account_id: l.accountId,
        description: l.description ?? null,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    if (lineError) {
      await ctx.supabase.from("journal_entries").delete().eq("id", entry.id);
      throw new Error(lineError.message);
    }

    if (data.post) {
      const { error: postError } = await ctx.supabase
        .from("journal_entries")
        .update({ status: "posted" })
        .eq("id", entry.id);
      if (postError) throw new Error(postError.message);
    }

    return { id: entry.id, entryNo: entry.entry_no, posted: data.post };
  });

export const postJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "accounting.post");
    const { error } = await ctx.supabase
      .from("journal_entries")
      .update({ status: "posted" })
      .eq("id", data.id)
      .eq("company_id", data.companyId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ DASHBOARD ------------------------------- */

export const getDashboardMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companyInput.extend({ branchId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "reports.view");

    const { data: lines, error } = await ctx.supabase
      .from("journal_lines")
      .select(
        "debit, credit, accounts!inner(code, name, type), journal_entries!inner(entry_date, status, branch_id, partner_id, partners(name))",
      )
      .eq("company_id", data.companyId)
      .eq("journal_entries.status", "posted");
    if (error) throw new Error(error.message);

    type Row = {
      debit: number;
      credit: number;
      accounts: { code: string; name: string; type: string };
      journal_entries: {
        entry_date: string;
        branch_id: string | null;
        partners: { name: string } | null;
      };
    };
    const rows = ((lines ?? []) as Row[]).filter(
      (r) => !data.branchId || r.journal_entries.branch_id === data.branchId,
    );

    const sum = (pred: (r: Row) => boolean, signed: (r: Row) => number) =>
      rows.filter(pred).reduce((s, r) => s + signed(r), 0);

    const dr = (r: Row) => Number(r.debit) - Number(r.credit);
    const cr = (r: Row) => Number(r.credit) - Number(r.debit);

    const revenue = sum((r) => r.accounts.type === "income", cr);
    const expenses = sum((r) => r.accounts.type === "expense", dr);
    const cash = sum((r) => ["1000", "1010"].includes(r.accounts.code), dr);
    const receivable = sum((r) => r.accounts.code === "1100", dr);
    const payable = sum((r) => r.accounts.code === "2000", cr);
    const assets = sum((r) => r.accounts.type === "asset", dr);
    const liabilities = sum((r) => r.accounts.type === "liability", cr);

    // monthly revenue vs expenses (last 6 months)
    const months: { month: string; revenue: number; expenses: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const inMonth = (r: Row) => r.journal_entries.entry_date.slice(0, 7) === key;
      months.push({
        month: dt.toLocaleString("en", { month: "short" }),
        revenue: sum((r) => inMonth(r) && r.accounts.type === "income", cr),
        expenses: sum((r) => inMonth(r) && r.accounts.type === "expense", dr),
      });
    }

    const byExpense = new Map<string, number>();
    rows
      .filter((r) => r.accounts.type === "expense")
      .forEach((r) => byExpense.set(r.accounts.name, (byExpense.get(r.accounts.name) ?? 0) + dr(r)));

    const byCustomer = new Map<string, number>();
    rows
      .filter((r) => r.accounts.type === "income" && r.journal_entries.partners?.name)
      .forEach((r) =>
        byCustomer.set(
          r.journal_entries.partners!.name,
          (byCustomer.get(r.journal_entries.partners!.name) ?? 0) + cr(r),
        ),
      );

    const trialBalance = new Map<string, { code: string; name: string; debit: number; credit: number }>();
    rows.forEach((r) => {
      const key = r.accounts.code;
      const t = trialBalance.get(key) ?? { code: key, name: r.accounts.name, debit: 0, credit: 0 };
      t.debit += Number(r.debit);
      t.credit += Number(r.credit);
      trialBalance.set(key, t);
    });

    return {
      revenue,
      expenses,
      profit: revenue - expenses,
      cash,
      receivable,
      payable,
      assets,
      liabilities,
      equity: assets - liabilities,
      months,
      expenseBreakdown: [...byExpense.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      topCustomers: [...byCustomer.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      trialBalance: [...trialBalance.values()].sort((a, b) => a.code.localeCompare(b.code)),
    };
  });
