import { test, expect } from "@playwright/test";
import { createCatalogFixture, type CatalogFixture } from "./catalog-fixture";

let fixture: CatalogFixture;

test.describe.serial("Room AR catalog editing", () => {
  test.beforeAll(async () => {
    fixture = await createCatalogFixture();
  });

  test.afterAll(async () => {
    await fixture?.cleanup();
  });

  async function loginAsApprovedEditor(page: Parameters<typeof test>[0]["page"]) {
    await page.goto("/auth");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard");
  }

  test("editing an item updates it in place without creating a duplicate", async ({ page }) => {
    await loginAsApprovedEditor(page);
    await page.goto("/dashboard/catalogs");
    await page.getByRole("button", { name: new RegExp(fixture.catalogName) }).click();

    const rows = page.getByTestId("catalog-item-row");
    const before = await rows.count();
    const activeRow = page.locator('[data-testid="catalog-item-row"][data-active="true"]').first();
    await activeRow.getByTestId(/edit-item-/).click();
    await page.getByTestId("item-name").fill("Updated E2E Sofa");
    await page.getByTestId("save-item").click();

    await expect(rows).toHaveCount(before);
    await expect(rows).toContainText("Updated E2E Sofa");
  });

  test("owner can see and reactivate an inactive item", async ({ page }) => {
    await loginAsApprovedEditor(page);
    await page.goto("/dashboard/catalogs");
    await page.getByRole("button", { name: new RegExp(fixture.catalogName) }).click();

    const inactiveRow = page.locator('[data-testid="catalog-item-row"][data-active="false"]');
    await expect(inactiveRow).toBeVisible();
    await inactiveRow.getByTestId("toggle-active-inactive-item").click();
    await expect(inactiveRow).toHaveAttribute("data-active", "true");
  });
});
