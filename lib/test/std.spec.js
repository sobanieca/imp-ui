import { expect, test } from 'imp/test'

const styleOf = (page, selector, property) =>
  page.$eval(selector, (node, name) => getComputedStyle(node)[name], property)

const settled = (page, selector) =>
  page.$eval(
    selector,
    async (node) => void await Promise.all(node.getAnimations().map(({ finished }) => finished)),
  )

const BUTTON = '#std imp-button >>> button'

test('a std component paints with the applied theme tokens', async ({ page }) => {
  expect(await styleOf(page, BUTTON, 'backgroundColor')).toEqual('rgb(37, 99, 235)')
  expect(await styleOf(page, '#std imp-heading >>> h2', 'fontWeight')).toEqual('700')
  expect(await styleOf(page, '#std imp-text >>> p', 'color'))
    .toEqual('rgb(100, 116, 139)')
})

test('swapping the theme re-skins std components without a re-render', async ({ page }) => {
  await page.click(BUTTON)
  await page.mouse.move(0, 0)
  await settled(page, BUTTON)
  expect(await styleOf(page, BUTTON, 'backgroundColor')).toEqual('rgb(124, 156, 255)')
  expect(await styleOf(page, '#std imp-text >>> p', 'color'))
    .toEqual('rgb(148, 163, 184)')
})

test('a std component keeps its styles out of the page', async ({ page }) => {
  expect(await page.$eval('#std imp-button', (node) => node.textContent)).toEqual('')
})

test('focusing a component host focuses the control inside it', async ({ page }) => {
  await page.$eval('#std imp-button', (node) => node.focus())
  expect(await page.$eval(BUTTON, (node) => node.matches(':focus'))).toEqual(true)
})

const MORE = '#std-menu imp-button >>> .more'

const MENU = '#std-menu imp-button >>> .menu'

const boxOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { top, bottom } = node.getBoundingClientRect()
    return { top, bottom }
  })

const pinTo = (page, edge) =>
  page.$eval('#std-menu', (node, side) => {
    node.style.position = 'fixed'
    node.style.insetInlineStart = '8px'
    node.style.insetBlockStart = side === 'top' ? '8px' : 'auto'
    node.style.insetBlockEnd = side === 'bottom' ? '8px' : 'auto'
  }, edge)

test('an anchored menu stays hidden until its trigger is clicked', async ({ page }) => {
  expect(await styleOf(page, MENU, 'display')).toEqual('none')
})

test('an anchored menu opens below a trigger at the top of the screen', async ({ page }) => {
  await pinTo(page, 'top')
  await page.click(MORE)
  expect(await page.$eval(MORE, (node) => node.getAttribute('aria-expanded'))).toEqual('true')
  const trigger = await boxOf(page, MORE)
  const menu = await boxOf(page, MENU)
  expect(menu.top >= trigger.bottom).toEqual(true)
  await page.keyboard.press('Escape')
})

test('the same menu flips above a trigger at the bottom of the screen', async ({ page }) => {
  await pinTo(page, 'bottom')
  await page.click(MORE)
  const trigger = await boxOf(page, MORE)
  const menu = await boxOf(page, MENU)
  expect(menu.bottom <= trigger.top).toEqual(true)
  await page.keyboard.press('Escape')
  expect(await page.$eval(MORE, (node) => node.getAttribute('aria-expanded'))).toEqual('false')
})

test('choosing an item shuts the anchored menu and runs its handler', async ({ page }) => {
  await pinTo(page, 'top')
  await page.click(MORE)
  await page.click(`${MENU} .item`)
  expect(await page.evaluate(() => globalThis.__impChose)).toEqual('copy')
  expect(await page.$eval(MORE, (node) => node.getAttribute('aria-expanded'))).toEqual('false')
  expect(await styleOf(page, MENU, 'display')).toEqual('none')
})

test('the triple-dot trigger sits flush against the button it belongs to', async ({ page }) => {
  const seam = await page.$eval('#std-menu imp-button', (node) => {
    const group = node.shadowRoot.querySelector('.group')
    const action = group.querySelector('.button:not(.more)').getBoundingClientRect()
    const more = group.querySelector('.more').getBoundingClientRect()
    return { gap: more.left - action.right, sameHeight: more.height === action.height }
  })
  expect(seam.gap <= 0).toEqual(true)
  expect(seam.sameHeight).toEqual(true)
})
