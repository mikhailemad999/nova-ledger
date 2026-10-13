/**
 * End-to-end form tests: create, edit, post and delete records through the UI.
 * Requires E2E_EMAIL / E2E_PASSWORD (an owner/admin account); skipped otherwise.
 * Run: E2E_EMAIL=... E2E_PASSWORD=... bunx playwright test
 */
import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD not set");

const stamp = Date.now().toString().slice(-6);

async function signIn(page: Page) {
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

async function open(page: Page, path: string, ready: RegExp) {
  await page.goto(path);
  await expect(page.getByRole("button", { name: ready })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
}

test.beforeEach(async ({ page }) => signIn(page));

for (const kind of ["customer", "supplier"] as const) {
  test(`${kind}s: create, edit, delete`, async ({ page }) => {
    const name = `E2E ${kind} ${stamp}`;
    await open(page, `/${kind}s`, new RegExp(`new ${kind}`, "i"));
    await page.getByRole("button", { name: new RegExp(`new ${kind}`, "i") }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(`e2e${stamp}@example.com`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Edit ${name}` }).click();
    await page.getByLabel("Name").fill(`${name} edited`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name: `${name} edited`, exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Delete ${name} edited` }).click();
    await expect(page.getByRole("cell", { name: `${name} edited`, exact: true })).toHaveCount(0);
  });
}

test("products: create, edit, delete", async ({ page }) => {
  const name = `E2E Product ${stamp}`;
  await open(page, "/products", /new product/i);
  await page.getByRole("button", { name: /new product/i }).click();
  await page.getByLabel("SKU").fill(`E2E-${stamp}`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Sale price").fill("25");
  await page.getByLabel("Cost price").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByLabel("Sale price").fill("30");
  await page.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("$30.00");

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toHaveCount(0);
});

test("warehouses: create, edit, delete, record stock movement", async ({ page }) => {
  const name = `E2E Warehouse ${stamp}`;
  await open(page, "/warehouses", /new warehouse/i);
  await page.getByRole("button", { name: /new warehouse/i }).click();
  await page.locator("#wname").fill(name);
  await page.locator("#wcode").fill(`E2E${stamp}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.locator("#wname").fill(`${name} edited`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: `${name} edited`, exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Delete ${name} edited` }).click();
  await expect(page.getByRole("cell", { name: `${name} edited`, exact: true })).toHaveCount(0);

  // Record an inbound stock movement into an existing warehouse.
  await page.getByRole("button", { name: /record movement/i }).click();
  await page.locator("#mwh").selectOption({ index: 1 });
  await page.locator("#mprod").selectOption({ index: 1 });
  await page.locator("#mqty").fill("5");
  await page.locator("#mref").fill(`E2E-MOVE-${stamp}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /save|record/i })
    .click();
  await expect(page.getByText(`E2E-MOVE-${stamp}`)).toBeVisible();
});

const tradeKinds = [
  { path: "/quotations", single: "quotation", postable: false },
  { path: "/invoices", single: "invoice", postable: true },
  { path: "/purchase-orders", single: "purchase order", postable: true },
];

for (const t of tradeKinds) {
  test(`${t.path.slice(1)}: create draft, ${t.postable ? "post, " : ""}delete`, async ({
    page,
  }) => {
    await open(page, t.path, new RegExp(`new ${t.single}`, "i"));
    const docNos = async () =>
      (await page.locator("tbody tr td:first-child button").allInnerTexts()).map((s) => s.trim());
    const createDraft = async () => {
      const before = new Set(await docNos());
      await page.getByRole("button", { name: new RegExp(`new ${t.single}`, "i") }).click();
      await page.locator("#partner").selectOption({ index: 1 });
      await page.getByLabel("Description").first().fill(`E2E line ${stamp}`);
      await page.getByLabel("Quantity").first().fill("2");
      await page.getByLabel("Unit price").first().fill("50");
      await page.getByRole("button", { name: /save draft/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(async () => (await docNos()).filter((n) => !before.has(n)).length)
        .toBeGreaterThan(0);
      return (await docNos()).find((n) => !before.has(n))!;
    };

    // Create + delete a draft.
    const draft = await createDraft();
    const draftRow = page.getByRole("row").filter({ hasText: draft });
    await expect(draftRow).toContainText("draft");
    await expect(draftRow).toContainText("$100.00");
    await page.getByRole("button", { name: `Delete ${draft}` }).click();
    await expect(page.getByRole("row").filter({ hasText: draft })).toHaveCount(0);

    if (t.postable) {
      // Create + post: becomes "posted" and can no longer be deleted.
      const toPost = await createDraft();
      const row = page.getByRole("row").filter({ hasText: toPost });
      await row.getByRole("button", { name: /post/i }).click();
      await expect(row).toContainText("posted", { timeout: 20_000 });
      await expect(page.getByRole("button", { name: `Delete ${toPost}` })).toHaveCount(0);
    }
  });
}
