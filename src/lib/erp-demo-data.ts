// Phase 1 demo dataset. Replaced by Lovable Cloud queries in the accounting phase.

export const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const currencyPrecise = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export type Kpi = {
  label: string;
  value: number;
  delta: number;
  tone: "default" | "positive" | "negative";
};

export const kpis: Kpi[] = [
  { label: "Total Revenue", value: 1284500, delta: 12.4, tone: "positive" },
  { label: "Total Expenses", value: 743210, delta: 6.1, tone: "negative" },
  { label: "Net Profit", value: 541290, delta: 18.9, tone: "positive" },
  { label: "Cash Balance", value: 386740, delta: 3.2, tone: "default" },
  { label: "Receivables", value: 219480, delta: -4.8, tone: "default" },
  { label: "Payables", value: 154920, delta: 2.7, tone: "default" },
  { label: "Inventory Value", value: 472310, delta: 1.4, tone: "default" },
  { label: "Outstanding Invoices", value: 84, delta: -9.3, tone: "default" },
];

export const revenueVsExpenses = [
  { month: "Jan", revenue: 82000, expenses: 51000, profit: 31000 },
  { month: "Feb", revenue: 91500, expenses: 55400, profit: 36100 },
  { month: "Mar", revenue: 104200, expenses: 61200, profit: 43000 },
  { month: "Apr", revenue: 98800, expenses: 59800, profit: 39000 },
  { month: "May", revenue: 116400, expenses: 64500, profit: 51900 },
  { month: "Jun", revenue: 121900, expenses: 68100, profit: 53800 },
  { month: "Jul", revenue: 118300, expenses: 70200, profit: 48100 },
  { month: "Aug", revenue: 132700, expenses: 71800, profit: 60900 },
  { month: "Sep", revenue: 128400, expenses: 73400, profit: 55000 },
  { month: "Oct", revenue: 139600, expenses: 76900, profit: 62700 },
  { month: "Nov", revenue: 147200, expenses: 79100, profit: 68100 },
  { month: "Dec", revenue: 153500, expenses: 81810, profit: 71690 },
];

export const expenseDistribution = [
  { name: "Salaries", value: 312000 },
  { name: "Rent", value: 96000 },
  { name: "Utilities", value: 48200 },
  { name: "Marketing", value: 132400 },
  { name: "Logistics", value: 87600 },
  { name: "Other", value: 67010 },
];

export const arAging = [
  { bucket: "Current", amount: 96400 },
  { bucket: "1-30", amount: 58200 },
  { bucket: "31-60", amount: 34100 },
  { bucket: "61-90", amount: 18300 },
  { bucket: "90+", amount: 12480 },
];

export const apAging = [
  { bucket: "Current", amount: 71200 },
  { bucket: "1-30", amount: 39800 },
  { bucket: "31-60", amount: 24100 },
  { bucket: "61-90", amount: 12300 },
  { bucket: "90+", amount: 7520 },
];

export type InvoiceRow = {
  number: string;
  customer: string;
  date: string;
  due: string;
  total: number;
  status: "Paid" | "Posted" | "Partially Paid" | "Overdue" | "Draft";
};

export const recentInvoices: InvoiceRow[] = [
  { number: "INV-2026-000184", customer: "Nord Systems LLC", date: "Aug 09", due: "Sep 08", total: 18400, status: "Posted" },
  { number: "INV-2026-000183", customer: "Alkindi Trading", date: "Aug 08", due: "Aug 23", total: 7250, status: "Partially Paid" },
  { number: "INV-2026-000182", customer: "Vertex Manufacturing", date: "Aug 07", due: "Jul 30", total: 32900, status: "Overdue" },
  { number: "INV-2026-000181", customer: "Bluepeak Retail", date: "Aug 06", due: "Sep 05", total: 12100, status: "Paid" },
  { number: "INV-2026-000180", customer: "Cedar Logistics", date: "Aug 05", due: "Sep 04", total: 5480, status: "Draft" },
];

export const pendingApprovals = [
  { title: "Purchase Order PO-2026-000212", detail: "Vertex Manufacturing · $12,400", level: "Finance Approval" },
  { title: "Expense EXP-2026-000341", detail: "M. Haddad · Travel · $1,860", level: "Manager Approval" },
  { title: "Journal Entry JE-2026-000098", detail: "Depreciation run · August", level: "Finance Manager" },
];

export const lowStock = [
  { sku: "SKU-1043", name: "Thermal Printer TX-2", onHand: 4, reorder: 15 },
  { sku: "SKU-2210", name: "Barcode Scanner Lite", onHand: 7, reorder: 20 },
  { sku: "SKU-3391", name: "A4 Paper 80gsm", onHand: 22, reorder: 60 },
];

export const topCustomers = [
  { name: "Vertex Manufacturing", revenue: 214800 },
  { name: "Nord Systems LLC", revenue: 168300 },
  { name: "Bluepeak Retail", revenue: 141200 },
  { name: "Alkindi Trading", revenue: 98600 },
  { name: "Cedar Logistics", revenue: 76400 },
];

export const recentTransactions = [
  { ref: "PAY-2026-000512", desc: "Customer payment · Bluepeak Retail", amount: 12100, kind: "in" as const },
  { ref: "PAY-2026-000511", desc: "Supplier payment · Orion Supplies", amount: 8400, kind: "out" as const },
  { ref: "JE-2026-000097", desc: "Payroll accrual · August", amount: 41200, kind: "out" as const },
  { ref: "PAY-2026-000510", desc: "Customer payment · Nord Systems", amount: 18400, kind: "in" as const },
];