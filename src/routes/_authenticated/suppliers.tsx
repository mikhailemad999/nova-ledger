import { createFileRoute } from "@tanstack/react-router";
import { PartnersPage } from "@/components/erp/PartnersPage";

const title = "Suppliers · Pro Max Accounting ERP";
const description = "Manage supplier records, contact details and tax IDs for your company.";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <PartnersPage kind="supplier" />,
});
