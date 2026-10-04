import type { Page } from 'playwright-core'

export async function setDisplayPreferences(
  page: Page,
  values: Partial<
    Record<'Dark mode' | 'Commander art and colours' | 'Motion and finishes', boolean>
  >,
) {
  await page.getByRole('button', { name: 'Display', exact: true }).click()
  for (const [name, checked] of Object.entries(values))
    await page.getByRole('checkbox', { name, exact: true }).setChecked(checked!)
  await page.keyboard.press('Escape')
}
