import { test, expect } from "@playwright/test";

test.describe("ZERVIX End-to-End Flow", () => {
  test("redirects unauthenticated user from /dashboard to /login and signs in with demo account", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole("button", { name: /Use Demo Analyst/i }).click();
    await page.getByRole("button", { name: /^Sign In$/i }).click();

    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByText(/Welcome to ZERVIX/i)).toBeVisible();
    await page.getByRole("link", { name: /Continue to Dashboard/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Security Command Center/i)).toBeVisible();

    // Navigate to Workspace and test local sanitization
    await page.getByRole("link", { name: /Sanitization Workspace/i }).click();
    await expect(page).toHaveURL(/\/workspace/);
    await page.getByRole("button", { name: /Synthetic KYC Audit Log/i }).click();
    await page.getByRole("button", { name: /Process Document/i }).click();
    await expect(page.getByText(/Sanitized Document/i)).toBeVisible();
  });
});
