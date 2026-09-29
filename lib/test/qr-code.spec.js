import { expect, test } from 'imp/test'

const HOST = '#qr imp-qr-code'

const SVG = `${HOST} >>> svg`

const images = async (page) => {
  const root = await page.$('#qr')
  const tree = await page.accessibility.snapshot({ root, interestingOnly: false })
  const found = []
  const walk = (node) => {
    if (!node) return
    if (node.role === 'img' || node.role === 'image') found.push(node.name)
    for (const child of node.children ?? []) walk(child)
  }
  walk(tree)
  return found
}

const displayOf = (page) => page.$eval(SVG, (node) => getComputedStyle(node).display)

const sizeOf = (page) =>
  page.$eval(HOST, (node) => {
    const { width, height } = node.getBoundingClientRect()
    return { width, height }
  })

const fills = (page) =>
  page.$eval(HOST, (host) => {
    const fillOf = (selector) => getComputedStyle(host.shadowRoot.querySelector(selector)).fill
    return { ground: fillOf('.ground'), modules: fillOf('.modules') }
  })

const forcedColors = (page, forced, scheme) =>
  page._client().send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'forced-colors', value: forced },
      { name: 'prefers-color-scheme', value: scheme },
    ],
  })

test('a QR code with a value is one named image', async ({ page }) => {
  await page.click('#qr-link')
  expect(await displayOf(page)).toEqual('block')
  expect((await sizeOf(page)).width > 0).toEqual(true)
  expect(await images(page)).toEqual(['Link to the demo'])
})

test('an empty value removes the image from the page and from the accessibility tree', async ({ page }) => {
  await page.click('#qr-empty')
  expect(await displayOf(page)).toEqual('none')
  expect(await sizeOf(page)).toEqual({ width: 0, height: 0 })
  expect(await images(page)).toEqual([])
  await page.click('#qr-link')
  expect(await displayOf(page)).toEqual('block')
  expect(await images(page)).toEqual(['Link to the demo'])
})

test('a value that is too long removes the image too', async ({ page }) => {
  await page.click('#qr-long')
  expect(await displayOf(page)).toEqual('none')
  expect(await images(page)).toEqual([])
  await page.click('#qr-link')
})

test('forced colours in a dark scheme keep dark modules on a light ground', async ({ page }) => {
  await page.click('#qr-link')
  const normal = await fills(page)
  await forcedColors(page, 'active', 'dark')
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toEqual(true)
  expect(await fills(page)).toEqual(normal)
  expect(normal).toEqual({ ground: 'rgb(255, 255, 255)', modules: 'rgb(17, 17, 17)' })
  await forcedColors(page, 'none', 'light')
})
