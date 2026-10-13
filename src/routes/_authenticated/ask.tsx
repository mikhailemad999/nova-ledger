import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { askRecords, type SearchHit, type SearchResult } from "@/lib/ai-search.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const title = "Ask your books · Pro Max Accounting ERP";
const description =
  "Search invoices, customers, products and journal entries with a plain-language question.";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AskPage,
});

const linkFor: Record<SearchHit["type"], string> = {
  invoice: "/invoices",
  quotation: "/quotations",
  purchase_order: "/purchase-orders",
  partner: "/customers",
  product: "/products",
  journal: "/journal",
};
const examples = [
  "Which invoices are still unpaid?",
  "What did we buy from suppliers this year?",
  "Show the biggest sales documents",
];

function AskPage() {
  const tenant = useTenant();
  const ask = useServerFn(askRecords);
  const [q, setQ] = useState("");
  const run = useMutation({
    mutationFn: (question: string) =>
      ask({ data: { companyId: tenant.company!.id, question } }) as Promise<SearchResult>,
  });
  const submit = (question: string) => {
    if (question.trim().length >= 3 && tenant.company) run.mutate(question.trim());
  };

  return (
    <AppShell title="Ask your books">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <Input
          aria-label="Question"
          autoFocus
          placeholder="e.g. Which customers owe us more than $10,000?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" disabled={run.isPending || q.trim().length < 3}>
          {run.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Ask
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <Button
            key={ex}
            variant="outline"
            size="sm"
            onClick={() => {
              setQ(ex);
              submit(ex);
            }}
          >
            {ex}
          </Button>
        ))}
      </div>

      {run.isPending && (
        <p className="mt-8 text-sm text-muted-foreground">Searching your records…</p>
      )}
      {run.error && <p className="mt-8 text-sm text-destructive">{(run.error as Error).message}</p>}
      {run.data && !run.isPending && (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Answer</h2>
            <p className="text-sm leading-relaxed">{run.data.summary}</p>
          </div>
          {run.data.hits.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {run.data.hits.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{h.label}</p>
                    <p className="text-sm text-muted-foreground">{h.reason}</p>
                  </div>
                  <Link
                    to={linkFor[h.type]}
                    className="shrink-0 text-xs capitalize text-primary hover:underline"
                  >
                    {h.type.replace("_", " ")} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
