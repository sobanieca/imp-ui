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
  expect(await styleOf(page, '#std imp-heading >>> h2', 'fontWeight')).toEqual('600')
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

const MORE = '#std-menu imp-button-group >>> .trigger'

const MORE_CONTROL = `${MORE} >>> .button`

const MENU = '#std-menu imp-button-group >>> .panel'

const boxOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { top, bottom, left, right } = node.getBoundingClientRect()
    return { top, bottom, left, right }
  })

const pinTo = (page, corner) =>
  page.$eval('#std-menu', (node, [block, inline]) => {
    node.style.position = 'fixed'
    node.style.insetBlockStart = block === 'start' ? '8px' : 'auto'
    node.style.insetBlockEnd = block === 'end' ? '8px' : 'auto'
    node.style.insetInlineStart = inline === 'start' ? '8px' : 'auto'
    node.style.insetInlineEnd = inline === 'end' ? '8px' : 'auto'
  }, [corner.block, corner.inline])

const onScreen = async (page, selector) => {
  const { left, right } = await boxOf(page, selector)
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  return left >= 0 && right <= width
}

test('an anchored menu stays hidden until its trigger is clicked', async ({ page }) => {
  expect(await styleOf(page, MENU, 'display')).toEqual('none')
})

test('an anchored menu opens below a trigger at the top of the screen', async ({ page }) => {
  await pinTo(page, { block: 'start', inline: 'start' })
  await page.click(MORE_CONTROL)
  await settled(page, MENU)
  expect(await page.$eval(MORE_CONTROL, (node) => node.getAttribute('aria-expanded')))
    .toEqual('true')
  const trigger = await boxOf(page, MORE_CONTROL)
  const menu = await boxOf(page, MENU)
  expect(menu.top >= trigger.bottom).toEqual(true)
  await page.keyboard.press('Escape')
})

test('the same menu flips above a trigger at the bottom of the screen', async ({ page }) => {
  await pinTo(page, { block: 'end', inline: 'start' })
  await page.click(MORE_CONTROL)
  await settled(page, MENU)
  const trigger = await boxOf(page, MORE_CONTROL)
  const menu = await boxOf(page, MENU)
  expect(menu.bottom <= trigger.top).toEqual(true)
  await page.keyboard.press('Escape')
  expect(await page.$eval(MORE_CONTROL, (node) => node.getAttribute('aria-expanded')))
    .toEqual('false')
})

test('the menu opens inwards from a trigger at the inline start edge', async ({ page }) => {
  await pinTo(page, { block: 'start', inline: 'start' })
  await page.click(MORE_CONTROL)
  await settled(page, MENU)
  const trigger = await boxOf(page, MORE_CONTROL)
  const menu = await boxOf(page, MENU)
  expect(menu.right > trigger.right).toEqual(true)
  expect(await onScreen(page, MENU)).toEqual(true)
  await page.keyboard.press('Escape')
})

test('and inwards the other way from a trigger at the inline end edge', async ({ page }) => {
  await pinTo(page, { block: 'start', inline: 'end' })
  await page.click(MORE_CONTROL)
  await settled(page, MENU)
  const trigger = await boxOf(page, MORE_CONTROL)
  const menu = await boxOf(page, MENU)
  expect(menu.left < trigger.left).toEqual(true)
  expect(await onScreen(page, MENU)).toEqual(true)
  await page.keyboard.press('Escape')
})

test('a trigger in the far corner flips on both axes at once', async ({ page }) => {
  await pinTo(page, { block: 'end', inline: 'start' })
  await page.click(MORE_CONTROL)
  await settled(page, MENU)
  const trigger = await boxOf(page, MORE_CONTROL)
  const menu = await boxOf(page, MENU)
  expect(menu.bottom <= trigger.top).toEqual(true)
  expect(menu.right > trigger.right).toEqual(true)
  expect(await onScreen(page, MENU)).toEqual(true)
  await page.keyboard.press('Escape')
})

test('choosing an item shuts the anchored menu and runs its handler', async ({ page }) => {
  await pinTo(page, { block: 'start', inline: 'start' })
  await page.click(MORE_CONTROL)
  await page.click(`${MENU} .option`)
  expect(await page.evaluate(() => globalThis.__impChose)).toEqual('copy')
  expect(await page.$eval(MORE_CONTROL, (node) => node.getAttribute('aria-expanded')))
    .toEqual('false')
  expect(await styleOf(page, MENU, 'display')).toEqual('none')
})

test('the triple-dot trigger draws a visible icon', async ({ page }) => {
  const drawing = await page.$eval('#std-menu imp-button-group', (node) => {
    const svg = node.shadowRoot.querySelector('.trigger').shadowRoot.querySelector('.label svg')
    const { width, height } = svg.getBoundingClientRect()
    return { width, height, marks: svg.children.length }
  })
  expect(drawing.width > 0).toEqual(true)
  expect(drawing.height > 0).toEqual(true)
  expect(drawing.marks).toEqual(3)
})

test('the triple-dot trigger sits flush against the button it belongs to', async ({ page }) => {
  const seam = await page.$eval('#std-menu imp-button-group', (node) => {
    const controlOf = (selector) =>
      node.shadowRoot.querySelector(selector).shadowRoot.querySelector('.button')
        .getBoundingClientRect()
    const action = controlOf('.row > imp-button:first-child')
    const more = controlOf('.trigger')
    return {
      overlap: action.right - more.left,
      sameHeight: more.height === action.height,
      narrower: more.width < action.width,
    }
  })
  expect(seam.overlap > 0).toEqual(true)
  expect(seam.sameHeight).toEqual(true)
  expect(seam.narrower).toEqual(true)
})

test('the seam squares the corners that face a neighbour, in both directions', async ({ page }) => {
  const radii = (direction) =>
    page.$eval('#std-menu imp-button-group', (node, [dir]) => {
      node.ownerDocument.documentElement.setAttribute('dir', dir)
      const cornersOf = (selector) => {
        const control = node.shadowRoot.querySelector(selector).shadowRoot.querySelector('.button')
        const style = getComputedStyle(control)
        return [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ]
      }
      return { primary: cornersOf('.row > imp-button:first-child'), trigger: cornersOf('.trigger') }
    }, [direction])

  const ltr = await radii('ltr')
  expect(ltr.primary[1]).toEqual('0px')
  expect(ltr.primary[2]).toEqual('0px')
  expect(ltr.primary[0]).not.toEqual('0px')
  expect(ltr.trigger[0]).toEqual('0px')
  expect(ltr.trigger[3]).toEqual('0px')
  expect(ltr.trigger[1]).not.toEqual('0px')

  const rtl = await radii('rtl')
  expect(rtl.primary[0]).toEqual('0px')
  expect(rtl.primary[3]).toEqual('0px')
  expect(rtl.primary[1]).not.toEqual('0px')
  expect(rtl.trigger[1]).toEqual('0px')
  expect(rtl.trigger[2]).toEqual('0px')
  expect(rtl.trigger[0]).not.toEqual('0px')
  await page.$eval('html', (node) => node.setAttribute('dir', 'ltr'))
})
