import { createFileRoute } from "@tanstack/react-router";
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
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/erp/AppShell";
import { StatCard } from "@/components/erp/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  apAging,
  arAging,
  currency,
  currencyPrecise,
  expenseDistribution,
  kpis,
  lowStock,
  pendingApprovals,
  recentInvoices,
  recentTransactions,
  revenueVsExpenses,
  topCustomers,
} from "@/lib/erp-demo-data";

const title = "Dashboard — Pro Max Accounting ERP";
const description =
  "Financial control center with revenue, expense, cash, receivables and inventory KPIs for a multi-company accounting ERP.";

export const Route = createFileRoute("/")({
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

const pieColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};

const statusTone: Record<string, string> = {
  Paid: "border-success/40 text-success",
  Posted: "border-info/40 text-info",
  "Partially Paid": "border-warning/40 text-warning",
  Overdue: "border-destructive/40 text-destructive",
  Draft: "border-border text-muted-foreground",
};

function Dashboard() {
  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={
                kpi.label === "Outstanding Invoices" ? String(kpi.value) : currency(kpi.value)
              }
              delta={kpi.delta}
            />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold">Revenue vs Expenses</h2>
            <p className="text-xs text-muted-foreground">Fiscal year 2026 · base currency USD</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueVsExpenses}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" fill="url(#rev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="var(--chart-4)" fill="url(#exp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold">Expense Distribution</h2>
            <p className="text-xs text-muted-foreground">By category, year to date</p>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                    {expenseDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5">
              {expenseDistribution.map((entry, index) => (
                <li key={entry.name} className="flex items-center gap-2 text-xs">
                  <span className="size-2 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                  <span className="flex-1 text-muted-foreground">{entry.name}</span>
                  <span className="num">{currency(entry.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AgingCard title="AR Aging" subtitle="Receivables by bucket" data={arAging} color="var(--chart-2)" />
          <AgingCard title="AP Aging" subtitle="Payables by bucket" data={apAging} color="var(--chart-3)" />
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="text-sm font-semibold">Recent Invoices</h2>
              <p className="text-xs text-muted-foreground">Latest documents across all branches</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-y border-border bg-surface-1 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Number</th>
                  <th className="px-5 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-5 py-2.5 text-left font-medium">Date</th>
                  <th className="px-5 py-2.5 text-left font-medium">Due</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((row) => (
                  <tr key={row.number} className="border-b border-border/70 last:border-0 hover:bg-accent/40">
                    <td className="num px-5 py-3">{row.number}</td>
                    <td className="px-5 py-3">{row.customer}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.date}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.due}</td>
                    <td className="num px-5 py-3 text-right">{currencyPrecise(row.total)}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant="outline" className={statusTone[row.status]}>
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-5">
            <h2 className="text-sm font-semibold">Pending Approvals</h2>
            <ul className="mt-3 space-y-3">
              {pendingApprovals.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  <div>
                    <p className="text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="text-xs text-primary">{item.level}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold">Low Stock Alerts</h2>
            <ul className="mt-3 space-y-3">
              {lowStock.map((item) => (
                <li key={item.sku} className="flex items-center gap-3">
                  <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm">{item.name}</p>
                    <p className="num text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <p className="num text-sm">
                    {item.onHand}
                    <span className="text-muted-foreground"> / {item.reorder}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <ul className="mt-3 space-y-3">
              {recentTransactions.map((item) => (
                <li key={item.ref} className="flex items-center gap-3">
                  {item.kind === "in" ? (
                    <ArrowDownLeft className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <div className="flex-1">
                    <p className="text-sm">{item.desc}</p>
                    <p className="num text-xs text-muted-foreground">{item.ref}</p>
                  </div>
                  <p className="num text-sm">{currencyPrecise(item.amount)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold">Top Customers</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={150} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function AgingCard({
  title: cardTitle,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: { bucket: string; amount: number }[];
  color: string;
}) {
  return (
    <div className="panel p-5">
      <h2 className="text-sm font-semibold">{cardTitle}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={tooltipStyle} formatter={(v: number) => currency(v)} />
            <Bar dataKey="amount" fill={color} radius={[6, 6, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
