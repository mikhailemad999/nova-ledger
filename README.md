# Pro Max Accounting ERP

A complete professional **Accounting & ERP SaaS application** built with a premium modern dark UI. Designed to match the scope of Odoo Accounting, QuickBooks, Zoho Books, and Xero.

> **Current Phase:** Dashboard & Shell  
> The foundation is live with a full navigation shell, KPI dashboard, and rich demo data. Backend accounting engine, authentication, multi-company support, and journal entries are coming in the next phases.

## Features

- **Premium Dark UI** — Modern black-themed interface with professional data visualization.
- **ERP Navigation** — Full sidebar navigation covering Sales, Purchases, Accounting, Banking, Inventory, Reporting, and Settings.
- **Command Palette** — `Ctrl+K` / `⌘+K` quick navigation and search.
- **Dashboard KPIs** — Revenue, profit, cash, outstanding receivables, payables, and overdue metrics.
- **Interactive Charts** — Revenue vs. expenses trends, expense distribution, AR/AP aging, and top customers.
- **Data Tables** — Recent invoices, pending approvals, low stock alerts, and recent transactions.
- **Company Switcher** — Built-in multi-company UI support.
- **Mobile Responsive** — Collapsible sidebar and mobile-friendly layout.

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) — full-stack React with SSR/SSG and server functions.
- **Language:** TypeScript
- **UI Library:** React 19
- **Styling:** Tailwind CSS v4 with `oklch` semantic tokens and custom dark theme.
- **Typography:** Space Grotesk (headings), DM Sans (body), JetBrains Mono (numbers/monospace).
- **Charts:** Recharts
- **Backend:** Lovable Cloud (PostgreSQL + Auth + Server Functions)
- **Icons:** Lucide React
- **Build Tool:** Vite 7

## Getting Started

### Prerequisites

- Node.js (preferably installed via [nvm](https://github.com/nvm-sh/nvm))
- A package manager: `npm`, `yarn`, `pnpm`, or `bun`

### Installation

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

The app will be available at `http://localhost:8080` by default.

### Build for Production

```sh
npm run build
```

## Project Structure

```
src/
├── components/erp/     # ERP-specific UI components (shell, sidebar, charts, etc.)
├── lib/                # Utilities, demo data, and shared helpers
├── routes/             # TanStack Start file-based routes
│   ├── __root.tsx      # Root layout
│   └── index.tsx       # Dashboard home
├── styles.css          # Global theme, design tokens, and Tailwind imports
├── router.tsx          # Router configuration
└── start.ts            # App start configuration
```

## Roadmap

1. **Phase 1 — Shell & Dashboard** ✅  
   Premium dark design system, navigation, command palette, KPI dashboard, and demo data.

2. **Phase 2 — Authentication & RBAC**  
   User login, roles, permissions, and multi-company support.

3. **Phase 3 — Accounting Engine**  
   Chart of accounts, journal entries, general ledger, and financial reports.

4. **Phase 4 — Operational Modules**  
   Sales, purchases, inventory, banking, and payroll integrations.

5. **Phase 5 — Advanced Reporting & Integrations**  
   Custom reports, tax compliance, payment gateways, and third-party APIs.

## Design System

- **Primary:** `#3B82F6` (blue accent)
- **Background:** `#0B0F17` / `#0F172A` (deep dark)
- **Surface:** `#151B25` / `#1A1F29` (elevated panels)
- **Text:** `#F8FAFC` (primary), `#94A3B8` (muted)
- **Border:** `#2A3441` / `#334155`
- **Success:** `#10B981`, **Warning:** `#F59E0B`, **Danger:** `#EF4444`

All colors are defined as semantic tokens in `src/styles.css` and used consistently across components.

## License

This project is proprietary and owned by the project creator. See the repository license file for details.

---

Built with [Lovable](https://lovable.dev).
