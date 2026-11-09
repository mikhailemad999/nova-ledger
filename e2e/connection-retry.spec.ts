import { expect, test, type Page, type Route } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (process.env.CI && (!email || !password)) {
  throw new Error("Connection-recovery browser tests require E2E_EMAIL and E2E_PASSWORD in CI.");
}
test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD not set");

async function signIn(page: Page) {
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

test("sign-in outage replaces the spinner and retries successfully", async ({ page }) => {
  let failedOnce = false;
  const failOnce = async (route: Route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.abort("failed");
    } else {
      await route.continue();
    }
  };

  await page.route("**/auth/v1/token**", failOnce);
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  const retryPanel = page.getByRole("alert");
  await expect(retryPanel).toContainText("Can't reach the service");
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
  await expect(page.locator("#password")).toHaveCount(0);

  await page.unroute("**/auth/v1/token**", failOnce);
  await page.getByRole("button", { name: /try again/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("company loading outage shows retry and recovers with the signed-in session", async ({
  page,
  context,
}) => {
  await signIn(page);

  const failAllServerFunctions = async (route: Route) => route.abort("failed");
  await context.route("**/_serverFn**", failAllServerFunctions);
  await page.reload({ waitUntil: "domcontentloaded" });
  const retryPanel = page.getByRole("alert");
  await expect(retryPanel).toContainText("companies could not be loaded", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();

  await context.unroute("**/_serverFn**", failAllServerFunctions);
  await page.getByRole("button", { name: /try again/i }).click();
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 30_000 });
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
});
