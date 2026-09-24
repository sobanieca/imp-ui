import { expect, test } from 'imp/test'

const countOf = (page, selector) => page.$$eval(selector, (nodes) => nodes.length)

const worldReady = (page, id, selector) =>
  page.waitForFunction(
    ([hostId, inner]) => {
      const showcase = document.querySelector('map-showcase').shadowRoot
      const host = showcase.querySelector(`#${hostId} imp-map`)
      return host.shadowRoot.querySelectorAll(inner).length > 0
    },
    {},
    [id, selector],
  )

test('a low detail map loads the 1:110m world as its own chunk', async ({ page }) => {
  await worldReady(page, 'map-low', '.land')
  expect(await countOf(page, '#map-low imp-map >>> .land')).toEqual(177)
  expect(await countOf(page, '#map-low imp-map >>> .road')).toEqual(0)
})

test('a high detail map draws the 1:50m world and shows the highways at zoom 3', async ({ page }) => {
  await worldReady(page, 'map-high', '.road')
  expect(await countOf(page, '#map-high imp-map >>> .land')).toEqual(242)
  expect(await countOf(page, '#map-high imp-map >>> .place')).toEqual(1251)
  expect(await countOf(page, '#map-high imp-map >>> .road.major:not([hidden])')).toBeGreaterThan(0)
  const drawn = await page.$eval('#map-high imp-map >>> .road.major:not([hidden])', (node) => {
    const { width, height } = node.getBoundingClientRect()
    return width > 0 && height > 0 && getComputedStyle(node).strokeWidth !== '0px'
  })
  expect(drawn).toEqual(true)
})

test('the road chunks arrive from the app itself, not from another origin', async ({ page, baseUrl }) => {
  const origins = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => new URL(entry.name).origin)
  )
  expect(origins.length).toBeGreaterThan(0)
  expect(new Set(origins)).toEqual(new Set([new URL(baseUrl).origin]))
})
