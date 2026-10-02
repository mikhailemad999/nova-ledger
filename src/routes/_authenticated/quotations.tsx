import { createFileRoute } from "@tanstack/react-router";
import { TradeDocsPage } from "@/components/erp/TradeDocsPage";

const title = "Quotations · Pro Max Accounting ERP";
const description = "Prepare and track customer quotations before they become invoices.";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <TradeDocsPage kind="quotation" />,
});
