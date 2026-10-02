import { createFileRoute } from "@tanstack/react-router";
import { TradeDocsPage } from "@/components/erp/TradeDocsPage";

const title = "Purchase Orders · Pro Max Accounting ERP";
const description = "Raise supplier purchase orders and post them to inventory and payables.";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <TradeDocsPage kind="purchase_order" />,
});
