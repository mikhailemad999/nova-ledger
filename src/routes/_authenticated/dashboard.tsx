import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Loader2,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { useTenant } from "@/hooks/useTenant";
import { getDashboardMetrics } from "@/lib/accounting.functions";

const title = "Dashboard · Pro Max Accounting ERP";
const description =
  "Live revenue, profit, cash, receivables and payables from your posted journal entries.";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

function Dashboard() {
  const tenant = useTenant();
  const companyId = tenant.company?.id;
  const currency = tenant.company?.currency ?? "USD";
  const fetchMetrics = useServerFn(getDashboardMetrics);

  const { data, isLoading } = useQuery({
    queryKey: ["metrics", companyId, tenant.branch?.id ?? null],
    enabled: Boolean(companyId),
    queryFn: () =>
      fetchMetrics({ data: { companyId: companyId!, branchId: tenant.branch?.id ?? null } }),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  if (isLoading || !data) {
    return (
      <AppShell title="Dashboard">
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const kpis = [
    { label: "Revenue", value: data.revenue, icon: TrendingUp, positive: true },
    { label: "Expenses", value: data.expenses, icon: Receipt, positive: false },
    { label: "Net profit", value: data.profit, icon: Banknote, positive: data.profit >= 0 },
    { label: "Cash & bank", value: data.cash, icon: Wallet, positive: data.cash >= 0 },
  ];

  return (
    <AppShell title="Dashboard">
      <p className="mb-5 text-sm text-muted-foreground">
        {tenant.company?.name ?? "Your company"}
        {tenant.branch ? ` · ${tenant.branch.name}` : " · all branches"} — figures come from posted
        journal entries.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">{k.label}</span>
              <k.icon className="size-4" aria-hidden />
            </div>
            <p className="num mt-3 text-2xl font-semibold">{fmt(k.value)}</p>
            <p
              className={`mt-1 flex items-center gap-1 text-xs ${
                k.positive ? "text-emerald-400" : "text-destructive"
              }`}
            >
              {k.positive ? (
                <ArrowUpRight className="size-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden />
              )}
              {k.label === "Revenue"
                ? "Income accounts"
                : k.label === "Expenses"
                  ? "Expense accounts"
                  : k.label === "Net profit"
                    ? "Revenue less expenses"
                    : "Cash on hand + bank"}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Receivables", value: data.receivable, to: "/customers" as const },
          { label: "Payables", value: data.payable, to: "/suppliers" as const },
          { label: "Equity", value: data.equity, to: "/accounts" as const },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-secondary/40"
          >
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="num mt-2 text-xl font-semibold">{fmt(s.value)}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold">Revenue vs expenses</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3441" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#151B25", border: "1px solid #2A3441", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Area dataKey="revenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                <Area dataKey="expenses" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">Expense breakdown</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expenseBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {data.expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#151B25", border: "1px solid #2A3441", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">Top customers by revenue</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCustomers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3441" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  cursor={{ fill: "#1A1F29" }}
                  contentStyle={{ background: "#151B25", border: "1px solid #2A3441", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 font-display text-sm font-semibold">
            Trial balance
          </h2>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.trialBalance.map((t) => (
                  <tr key={t.code} className="border-b border-border/60 last:border-0">
                    <td className="num px-5 py-2 text-muted-foreground">{t.code}</td>
                    <td className="px-2 py-2">{t.name}</td>
                    <td className="num px-2 py-2 text-right">{fmt(t.debit)}</td>
                    <td className="num px-5 py-2 text-right">{fmt(t.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
