import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Building2, Gauge, Lock, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const title = "Pro Max Accounting ERP — Multi-company accounting platform";
const description =
  "Double-entry accounting, multi-company and branch management, role-based access control and financial reporting in one premium dark ERP workspace.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Super Admin down to Viewer, enforced on every server endpoint — not just in the UI.",
  },
  {
    icon: Building2,
    title: "Multi-company & branches",
    body: "Switch tenants instantly. Every query is isolated by company membership in the database.",
  },
  {
    icon: Lock,
    title: "Secure sessions",
    body: "Email/password and Google sign-in with short-lived access tokens, silent refresh and clean logout.",
  },
  {
    icon: BarChart3,
    title: "Financial insight",
    body: "Revenue, cash, receivables, payables and aging analysis on one premium dashboard.",
  },
  {
    icon: Users,
    title: "Team management",
    body: "Invite teammates per company and change their role with a full server-side permission check.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gauge className="size-5" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold">Pro Max ERP</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="num text-xs uppercase tracking-[0.2em] text-primary">Accounting · ERP · Multi-tenant</p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          Run every company's books from one secure workspace
        </h1>
        <p className="mt-5 text-base text-muted-foreground">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Create your account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="rounded-xl border border-border bg-card p-6">
            <f.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-4 font-display text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
