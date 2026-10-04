/** Pure accounting/stock logic shared by the server and the automated tests. */

export type PostingDocLine = {
  product_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  products: { track_inventory: boolean; cost_price: number } | null;
};

export type PostingDoc = {
  kind: "invoice" | "purchase_order" | "quotation";
  doc_no: string;
  subtotal: number;
  tax_total: number;
  total: number;
  trade_document_lines: PostingDocLine[];
};

export type PlanLine = { account_id: string; debit: number; credit: number };
export type PlanMove = {
  product_id: string;
  kind: "in" | "out";
  quantity: number;
  unit_cost: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildPostingPlan(
  doc: PostingDoc,
  accountsByCode: Map<string, string>,
  withStock: boolean,
): { lines: PlanLine[]; moves: PlanMove[] } {
  if (doc.kind === "quotation") throw new Error("Quotations cannot be posted to the ledger");
  const need = (code: string, label: string) => {
    const id = accountsByCode.get(code);
    if (!id) throw new Error(`Missing account ${code} (${label}) in the chart of accounts`);
    return id;
  };
  const subtotal = Number(doc.subtotal);
  const tax = Number(doc.tax_total);
  const total = Number(doc.total);
  const docLines = doc.trade_document_lines ?? [];
  const tracked = docLines.filter((l) => l.product_id && l.products?.track_inventory);
  const lines: PlanLine[] = [];
  const moves: PlanMove[] = [];

  if (doc.kind === "invoice") {
    lines.push({ account_id: need("1100", "Accounts Receivable"), debit: total, credit: 0 });
    lines.push({ account_id: need("4000", "Product Sales"), debit: 0, credit: subtotal });
    if (tax > 0) lines.push({ account_id: need("2100", "VAT Payable"), debit: 0, credit: tax });
    const cogs = r2(
      tracked.reduce((s, l) => s + Number(l.quantity) * Number(l.products!.cost_price), 0),
    );
    if (cogs > 0) {
      lines.push({ account_id: need("5000", "Cost of Goods Sold"), debit: cogs, credit: 0 });
      lines.push({ account_id: need("1200", "Inventory"), debit: 0, credit: cogs });
    }
    if (withStock)
      tracked.forEach((l) =>
        moves.push({
          product_id: l.product_id!,
          kind: "out",
          quantity: Number(l.quantity),
          unit_cost: Number(l.products!.cost_price),
        }),
      );
  } else {
    const stocked = r2(tracked.reduce((s, l) => s + Number(l.line_total), 0));
    const expensed = r2(subtotal - stocked);
    if (stocked > 0)
      lines.push({ account_id: need("1200", "Inventory"), debit: stocked, credit: 0 });
    if (expensed > 0)
      lines.push({ account_id: need("5000", "Cost of Goods Sold"), debit: expensed, credit: 0 });
    if (tax > 0) lines.push({ account_id: need("2100", "VAT Payable"), debit: tax, credit: 0 });
    lines.push({ account_id: need("2000", "Accounts Payable"), debit: 0, credit: total });
    if (withStock)
      tracked.forEach((l) =>
        moves.push({
          product_id: l.product_id!,
          kind: "in",
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_price),
        }),
      );
  }

  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.round(debit * 100) !== Math.round(credit * 100)) {
    throw new Error(`Entry is out of balance: debits ${debit} vs credits ${credit}`);
  }
  return { lines, moves };
}

/** On-hand quantity per product from a list of stock movements. */
export function onHandByProduct(
  moves: { product_id: string; kind: string; quantity: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of moves) {
    const sign = m.kind === "out" ? -1 : 1;
    out.set(m.product_id, (out.get(m.product_id) ?? 0) + sign * Number(m.quantity));
  }
  return out;
}
