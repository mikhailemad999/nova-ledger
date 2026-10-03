import { describe, expect, it } from "vitest";
import { buildPostingPlan, onHandByProduct, type PostingDoc } from "./posting";

const accounts = new Map(
  ["1100", "1200", "2000", "2100", "4000", "5000"].map((c) => [c, `acc-${c}`]),
);
const widget = { track_inventory: true, cost_price: 300 };
const gadget = { track_inventory: true, cost_price: 200 };
const service = { track_inventory: false, cost_price: 0 };

const sum = (lines: { debit: number; credit: number }[], k: "debit" | "credit") =>
  lines.reduce((s, l) => s + l[k], 0);
const byAccount = (lines: { account_id: string; debit: number; credit: number }[]) =>
  Object.fromEntries(lines.map((l) => [l.account_id, l.debit - l.credit]));

const invoice: PostingDoc = {
  kind: "invoice",
  doc_no: "INV-2001",
  subtotal: 84000,
  tax_total: 12600,
  total: 96600,
  trade_document_lines: [
    { product_id: "p-w", quantity: 90, unit_price: 600, line_total: 54000, products: widget },
    { product_id: "p-g", quantity: 120, unit_price: 250, line_total: 30000, products: gadget },
  ],
};

const purchase: PostingDoc = {
  kind: "purchase_order",
  doc_no: "PO-1002",
  subtotal: 62000,
  tax_total: 0,
  total: 62000,
  trade_document_lines: [
    { product_id: "p-w", quantity: 100, unit_price: 300, line_total: 30000, products: widget },
    { product_id: "p-g", quantity: 160, unit_price: 200, line_total: 32000, products: gadget },
  ],
};

describe("posting an invoice", () => {
  it("creates a balanced entry: receivable, sales, VAT, cost of goods and inventory", () => {
    const { lines } = buildPostingPlan(invoice, accounts, false);
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(byAccount(lines)).toEqual({
      "acc-1100": 96600,
      "acc-4000": -84000,
      "acc-2100": -12600,
      "acc-5000": 51000,
      "acc-1200": -51000,
    });
  });

  it("takes stock out of the warehouse at cost when a warehouse is chosen", () => {
    const { moves } = buildPostingPlan(invoice, accounts, true);
    expect(moves).toEqual([
      { product_id: "p-w", kind: "out", quantity: 90, unit_cost: 300 },
      { product_id: "p-g", kind: "out", quantity: 120, unit_cost: 200 },
    ]);
  });

  it("does not move stock without a warehouse or for untracked services", () => {
    expect(buildPostingPlan(invoice, accounts, false).moves).toHaveLength(0);
    const svc: PostingDoc = {
      ...invoice,
      subtotal: 1900,
      tax_total: 0,
      total: 1900,
      trade_document_lines: [
        { product_id: "p-s", quantity: 10, unit_price: 190, line_total: 1900, products: service },
      ],
    };
    const plan = buildPostingPlan(svc, accounts, true);
    expect(plan.moves).toHaveLength(0);
    expect(sum(plan.lines, "debit")).toBe(sum(plan.lines, "credit"));
  });
});

describe("posting a purchase order", () => {
  it("creates a balanced entry: inventory against payables", () => {
    const { lines } = buildPostingPlan(purchase, accounts, false);
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(byAccount(lines)).toEqual({ "acc-1200": 62000, "acc-2000": -62000 });
  });

  it("books input VAT and non-stock items correctly and stays balanced", () => {
    const po: PostingDoc = {
      ...purchase,
      subtotal: 63900,
      tax_total: 9585,
      total: 73485,
      trade_document_lines: [
        ...purchase.trade_document_lines,
        { product_id: null, quantity: 1, unit_price: 1900, line_total: 1900, products: null },
      ],
    };
    const { lines } = buildPostingPlan(po, accounts, false);
    expect(sum(lines, "debit")).toBeCloseTo(sum(lines, "credit"), 2);
    expect(byAccount(lines)).toEqual({
      "acc-1200": 62000,
      "acc-5000": 1900,
      "acc-2100": 9585,
      "acc-2000": -73485,
    });
  });

  it("adds received stock at purchase price", () => {
    const { moves } = buildPostingPlan(purchase, accounts, true);
    expect(moves).toEqual([
      { product_id: "p-w", kind: "in", quantity: 100, unit_cost: 300 },
      { product_id: "p-g", kind: "in", quantity: 160, unit_cost: 200 },
    ]);
  });
});

describe("stock quantities", () => {
  it("purchase then invoice leaves the right quantity on hand", () => {
    const moves = [
      ...buildPostingPlan(purchase, accounts, true).moves,
      ...buildPostingPlan(invoice, accounts, true).moves,
    ];
    const onHand = onHandByProduct(moves);
    expect(onHand.get("p-w")).toBe(10);
    expect(onHand.get("p-g")).toBe(40);
  });
});

describe("safety checks", () => {
  it("refuses to post quotations", () => {
    expect(() => buildPostingPlan({ ...invoice, kind: "quotation" }, accounts, false)).toThrow(
      /Quotations/,
    );
  });

  it("refuses to post when a required account is missing", () => {
    const partial = new Map(accounts);
    partial.delete("2100");
    expect(() => buildPostingPlan(invoice, partial, false)).toThrow(/2100/);
  });

  it("refuses to post a document whose totals do not add up", () => {
    expect(() => buildPostingPlan({ ...invoice, total: 90000 }, accounts, false)).toThrow(
      /out of balance/,
    );
  });
});
