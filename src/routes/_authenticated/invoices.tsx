import { createFileRoute } from "@tanstack/react-router";
import { TradeDocsPage } from "@/components/erp/TradeDocsPage";

const title = "Invoices · Pro Max Accounting ERP";
const description = "Create customer invoices and post them to the ledger with matching stock movements.";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <TradeDocsPage kind="invoice" />,
});
