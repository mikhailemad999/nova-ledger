import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can, type AppRole } from "./rbac";

export type SearchHit = {
  type: "invoice" | "quotation" | "purchase_order" | "partner" | "product" | "journal";
  id: string;
  label: string;
  reason: string;
};
export type SearchResult = { summary: string; hits: SearchHit[] };

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "hits"],
  properties: {
    summary: { type: "string" },
    hits: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "reason"],
        properties: { ref: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
};

export const askRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid(), question: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const sb = context.supabase as any;
    const { data: m } = await sb
      .from("memberships")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m || !can(m.role as AppRole, "accounting.view")) throw new Error("Forbidden");

    const cid = data.companyId;
    const [docs, partners, products, journals] = await Promise.all([
      sb.from("trade_documents").select("id,kind,doc_no,doc_date,due_date,status,total,notes,partner_id").eq("company_id", cid).order("doc_date", { ascending: false }).limit(150),
      sb.from("partners").select("id,kind,name,email,tax_id").eq("company_id", cid).limit(150),
      sb.from("products").select("id,sku,name,sale_price,cost_price").eq("company_id", cid).limit(150),
      sb.from("journal_entries").select("id,entry_no,entry_date,status,memo,reference").eq("company_id", cid).order("entry_date", { ascending: false }).limit(150),
    ]);
    const pName = new Map<string, string>((partners.data ?? []).map((p: any) => [p.id, p.name]));

    const index = new Map<string, SearchHit>();
    const lines: string[] = [];
    const add = (ref: string, hit: Omit<SearchHit, "reason">, text: string) => {
      index.set(ref, { ...hit, reason: "" });
      lines.push(`[${ref}] ${text}`);
    };
    (docs.data ?? []).forEach((d: any, i: number) =>
      add(`D${i}`, { type: d.kind, id: d.id, label: d.doc_no },
        `${d.kind} ${d.doc_no} date=${d.doc_date} due=${d.due_date ?? "-"} status=${d.status} total=${d.total} partner=${pName.get(d.partner_id) ?? "-"} notes=${d.notes ?? ""}`),
    );
    (partners.data ?? []).forEach((p: any, i: number) =>
      add(`P${i}`, { type: "partner", id: p.id, label: p.name }, `${p.kind} ${p.name} email=${p.email ?? "-"} tax=${p.tax_id ?? "-"}`),
    );
    (products.data ?? []).forEach((p: any, i: number) =>
      add(`R${i}`, { type: "product", id: p.id, label: `${p.sku} ${p.name}` }, `product ${p.sku} ${p.name} price=${p.sale_price} cost=${p.cost_price}`),
    );
    (journals.data ?? []).forEach((j: any, i: number) =>
      add(`J${i}`, { type: "journal", id: j.id, label: j.entry_no }, `journal ${j.entry_no} date=${j.entry_date} status=${j.status} memo=${j.memo ?? ""} ref=${j.reference ?? ""}`),
    );

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI search is not configured");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You help accounting staff find company records. Using ONLY the records given, pick the most relevant ones (max 8, best first) by their [ref] and give a short reason each. Then write a concise 2-4 sentence summary answering the question, citing document numbers and amounts. If nothing matches, say so and return no hits.",
        input: `Today: ${new Date().toISOString().slice(0, 10)}\nQuestion: ${data.question}\n\nRecords:\n${lines.join("\n")}`,
        text: { format: { type: "json_schema", name: "search_result", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI search is busy right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are used up. Add credits to keep using AI search.");
      throw new Error(`AI search failed (${res.status}) ${msg.slice(0, 200)}`);
    }

    // Consume SSE stream and accumulate output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") out += ev.delta;
          if (ev.type === "response.refusal.delta" || ev.type === "error" || ev.type === "response.failed")
            throw new Error(ev.error?.message ?? "The AI could not answer this question.");
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    let parsed: { summary: string; hits: { ref: string; reason: string }[] };
    try {
      parsed = JSON.parse(out);
    } catch {
      return { summary: out || "No answer returned.", hits: [] };
    }
    const hits = parsed.hits
      .map((h) => {
        const base = index.get(h.ref);
        return base ? { ...base, reason: h.reason } : null;
      })
      .filter(Boolean)
      .slice(0, 8) as SearchHit[];
    return { summary: parsed.summary, hits };
  });
