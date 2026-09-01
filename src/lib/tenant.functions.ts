import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can, type AppRole, type Permission } from "./rbac";

type Ctx = { supabase: any; userId: string };

/**
 * Server-side tenant + permission gate.
 * Every endpoint that touches company data MUST call this: it proves the caller
 * is a member of the requested company AND holds a sufficient role.
 */
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

export const getMyWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, avatar_url").eq("id", userId).maybeSingle(),
      supabase
        .from("memberships")
        .select("id, role, company_id, branch_id, companies(id, name, legal_name, currency)")
        .eq("user_id", userId),
    ]);

    const companyIds = (memberships ?? []).map((m: any) => m.company_id);
    const { data: branches } = companyIds.length
      ? await supabase
          .from("branches")
          .select("id, company_id, name, code, is_active")
          .in("company_id", companyIds)
          .order("name")
      : { data: [] as any[] };

    return {
      userId,
      profile: profile ?? null,
      companies: (memberships ?? []).map((m: any) => ({
        id: m.company_id,
        name: m.companies?.name ?? "Company",
        currency: m.companies?.currency ?? "USD",
        role: m.role as AppRole,
      })),
      branches: branches ?? [],
    };
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        currency: z.string().min(3).max(3).default("USD"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: company, error } = await supabase
      .from("companies")
      .insert({ name: data.name, currency: data.currency.toUpperCase(), owner_id: userId })
      .select("id, name, currency")
      .single();
    if (error) throw new Error(error.message);
    return company;
  });

export const createBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        name: z.string().min(2).max(120),
        code: z.string().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "branch.manage");
    const { data: branch, error } = await ctx.supabase
      .from("branches")
      .insert({ company_id: data.companyId, name: data.name, code: data.code.toUpperCase() })
      .select("id, company_id, name, code, is_active")
      .single();
    if (error) throw new Error(error.message);
    return branch;
  });

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "member.manage");
    const { data: rows, error } = await ctx.supabase
      .from("memberships")
      .select("id, user_id, role, branch_id")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        membershipId: z.string().uuid(),
        role: z.enum(["super_admin", "owner", "admin", "accountant", "manager", "staff", "viewer"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireCompanyPermission(ctx, data.companyId, "member.manage");
    const { error } = await ctx.supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("id", data.membershipId)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Verifies a company/branch pair belongs together before the client switches tenant. */
export const switchTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        branchId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const role = await requireCompanyPermission(ctx, data.companyId, "accounting.view");
    if (data.branchId) {
      const { data: branch } = await ctx.supabase
        .from("branches")
        .select("id")
        .eq("id", data.branchId)
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (!branch) throw new Error("Forbidden: branch does not belong to this company");
    }
    return { companyId: data.companyId, branchId: data.branchId ?? null, role };
  });
