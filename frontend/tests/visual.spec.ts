// The building must look right — at any window size, on every commit.
//
// Golden screenshots live in tests/visual.spec.ts-snapshots/. When a change
// is INTENTIONAL, regenerate with `npm run visual:update` and commit the
// new goldens alongside the change that caused them.
import { expect, test } from '@playwright/test'

// Matches TERRARIUM_DEMO_AT in playwright.config.ts, in ms.
const FIXED_MS = 1788000105000

const VIEWPORTS = [
  { name: 'wide', width: 1512, height: 809 },
  { name: 'laptop', width: 1200, height: 800 },
  { name: 'square', width: 980, height: 760 },
]

for (const vp of VIEWPORTS) {
  test(`the building at market open — ${vp.name}`, async ({ page }) => {
    await page.clock.setFixedTime(FIXED_MS)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(`/?intro=0&freeze=${FIXED_MS}`)
    // one status push + one canvas frame
    await page.waitForTimeout(2500)
    await expect(page).toHaveScreenshot(`building-${vp.name}.png`, { fullPage: false })
  })
}

test('the home page — wide', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_MS)
  await page.setViewportSize({ width: 1512, height: 809 })
  await page.goto('/?view=home&intro=0')
  await page.waitForTimeout(2000)
  await expect(page).toHaveScreenshot('home-wide.png', { fullPage: false })
})
