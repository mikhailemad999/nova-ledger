import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  BookOpen,
  Landmark,
  Boxes,
  Receipt,
  Building2,
  Users,
  FolderKanban,
  Target,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; to?: string };
export type NavGroup = { label: string; icon: LucideIcon; to?: string; items?: NavItem[] };

export const navGroups: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { label: "Quotations" },
      { label: "Sales Orders" },
      { label: "Invoices" },
      { label: "Credit Notes" },
      { label: "Customers" },
    ],
  },
  {
    label: "Purchases",
    icon: Truck,
    items: [
      { label: "Purchase Orders" },
      { label: "Bills" },
      { label: "Debit Notes" },
      { label: "Suppliers" },
    ],
  },
  {
    label: "Accounting",
    icon: BookOpen,
    items: [
      { label: "Chart of Accounts" },
      { label: "Journal Entries" },
      { label: "General Ledger" },
      { label: "Trial Balance" },
    ],
  },
  {
    label: "Banking",
    icon: Landmark,
    items: [{ label: "Bank Accounts" }, { label: "Transactions" }, { label: "Reconciliation" }],
  },
  {
    label: "Inventory",
    icon: Boxes,
    items: [
      { label: "Products" },
      { label: "Warehouses" },
      { label: "Stock" },
      { label: "Transfers" },
      { label: "Adjustments" },
    ],
  },
  { label: "Expenses", icon: Receipt },
  { label: "Assets", icon: Building2 },
  { label: "Payroll", icon: Users },
  { label: "Projects", icon: FolderKanban },
  { label: "Budgets", icon: Target },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];