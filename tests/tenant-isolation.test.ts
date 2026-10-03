/**
 * Live tenant-isolation tests against the real backend.
 *
 * Signs in as two users who belong to DIFFERENT companies and proves that
 * user B can neither read nor change user A's customers, suppliers,
 * invoices, products or stock movements.
 *
 * Required env (skipped when missing, e.g. on forks):
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
 *   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD,
 *   TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const env = (k: string) => process.env[k] ?? process.env[`VITE_${k}`];
const url = env("SUPABASE_URL");
const key = env("SUPABASE_PUBLISHABLE_KEY");
const creds = {
  a: [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_A_PASSWORD],
  b: [process.env.TEST_USER_B_EMAIL, process.env.TEST_USER_B_PASSWORD],
};
const ready = Boolean(url && key && creds.a[0] && creds.a[1] && creds.b[0] && creds.b[1]);

async function signIn(email: string, password: string) {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

async function companiesOf(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("memberships").select("company_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((m) => m.company_id as string);
}

describe.skipIf(!ready)("tenant isolation between two companies", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let companyA: string;
  const sample: Record<string, string> = {};

  beforeAll(async () => {
    const sa = await signIn(creds.a[0]!, creds.a[1]!);
    const sb = await signIn(creds.b[0]!, creds.b[1]!);
    a = sa.client;
    b = sb.client;
    const aCompanies = await companiesOf(a, sa.userId);
    const bCompanies = await companiesOf(b, sb.userId);
    companyA = aCompanies.find((c) => !bCompanies.includes(c))!;
    expect(companyA, "user A needs a company that user B is not a member of").toBeTruthy();

    // Grab one real row of each type from company A (as A) to attack as B.
    const pick = async (table: string, filter?: [string, string]) => {
      let q = a.from(table).select("id").eq("company_id", companyA).limit(1);
      if (filter) q = q.eq(filter[0], filter[1]);
      const { data } = await q;
      return data?.[0]?.id as string | undefined;
    };
    sample.customer = (await pick("partners", ["kind", "customer"]))!;
    sample.supplier = (await pick("partners", ["kind", "supplier"]))!;
    sample.invoice = (await pick("trade_documents", ["kind", "invoice"]))!;
    sample.product = (await pick("products"))!;
    sample.stock_move = (await pick("stock_moves"))!;
  });

  const cases: [string, string, string, Record<string, unknown>][] = [
    ["customers", "partners", "customer", { name: "Hijacked" }],
    ["suppliers", "partners", "supplier", { name: "Hijacked" }],
    ["invoices", "trade_documents", "invoice", { notes: "Hijacked" }],
    ["products", "products", "product", { name: "Hijacked" }],
    ["stock movements", "stock_moves", "stock_move", { note: "Hijacked" }],
  ];

  for (const [label, table, sampleKey, patch] of cases) {
    it(`user A can see their own ${label}`, async () => {
      expect(sample[sampleKey], `company A has no ${label} to test with`).toBeTruthy();
      const { data } = await a.from(table).select("id").eq("id", sample[sampleKey]);
      expect(data).toHaveLength(1);
    });

    it(`user B cannot read company A's ${label}`, async () => {
      const { data: byCompany } = await b.from(table).select("id").eq("company_id", companyA);
      expect(byCompany ?? []).toHaveLength(0);
      const { data: byId } = await b.from(table).select("id").eq("id", sample[sampleKey]);
      expect(byId ?? []).toHaveLength(0);
    });

    it(`user B cannot change or delete company A's ${label}`, async () => {
      const { data: updated } = await b.from(table).update(patch).eq("id", sample[sampleKey]).select("id");
      expect(updated ?? []).toHaveLength(0);
      const { data: deleted } = await b.from(table).delete().eq("id", sample[sampleKey]).select("id");
      expect(deleted ?? []).toHaveLength(0);
      // Still intact for the owner.
      const { data } = await a.from(table).select("id").eq("id", sample[sampleKey]);
      expect(data).toHaveLength(1);
    });
  }

  it("user B cannot add records into company A", async () => {
    const attempts = await Promise.all([
      b.from("partners").insert({ company_id: companyA, kind: "customer", name: "Intruder" }),
      b.from("products").insert({ company_id: companyA, sku: "X-INTRUDER", name: "Intruder" }),
      b.from("trade_documents").insert({ company_id: companyA, kind: "invoice", doc_no: "INV-HACK" }),
    ]);
    for (const res of attempts) expect(res.error).toBeTruthy();
  });
});
