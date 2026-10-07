// Fixtures live in the top-left DEV disclosure; keep browser QA on the human path.
export async function selectDevFixture(page, role) {
  if (!await page.locator('.tuning-panel').evaluate(panel => panel.open))
    await page.locator('.tuning-panel > summary').click();
  await page.locator(`.dev-review-controls [data-role="${role}"]`).click();
}
