import { expect, test } from 'imp/test'

const title = (page) => page.$eval('h1', (node) => node.textContent)

const rowTitles = (page) =>
  page.$$eval(
    'todo-row',
    (rows) => rows.map((row) => row.shadowRoot.querySelector('.title').textContent),
  )

const filterLink = (href) => `imp-shell >>> nav[aria-label="Filters"] a[href="${href}"]`

const sidebarCount = (page, href) =>
  page.$eval(`${filterLink(href)} imp-tag`, (node) => node.shadowRoot.textContent.trim())

const openSection = async (page, href) => {
  await page.click(filterLink(href))
  await page.waitForSelector('#add-task >>> input')
}

test('opens on the full list, framed by the shell', async ({ page }) => {
  expect(await title(page)).toEqual('All tasks')
  expect(await page.$eval('imp-app-logo', (node) => node.shadowRoot.textContent))
    .toContain('imp tasks')
  expect((await rowTitles(page)).length).toEqual(4)
})

test('the sidebar navigates without reloading the page', async ({ page }) => {
  await openSection(page, '/active')
  expect(await title(page)).toEqual('Active')
  expect(page.url()).toContain('/active')
  expect(await rowTitles(page)).not.toContain('Sketch the three shell regions')
})

test('a new task shows up on the list and in the sidebar count', async ({ page }) => {
  await openSection(page, '/')
  await page.type('#add-task >>> input', 'Ship the example')
  await page.click('#add-task >>> imp-button >>> button')
  expect(await rowTitles(page)).toContain('Ship the example')
  expect(await sidebarCount(page, '/')).toEqual('5')
})

test('the sidebar becomes the bottom bar and the navbar a drawer', async ({ page }) => {
  const top = await page.$$eval(
    'imp-shell >>> nav[aria-label="Sections"] a',
    (links) => links.map((anchor) => anchor.getAttribute('href')),
  )
  expect(top).toEqual(['/', '/settings'])

  const topOf = (selector) => page.$eval(selector, (node) => node.getBoundingClientRect().top)
  const visible = (selector) => page.$eval(selector, (node) => node.checkVisibility())
  const sidebar = 'imp-shell >>> .sidebar'
  const bottomBar = 'imp-shell >>> .bottombar'
  const main = 'imp-shell >>> .main'

  await page.setViewport({ width: 800, height: 600 })
  expect(await visible(sidebar)).toEqual(true)
  expect(await visible(bottomBar)).toEqual(false)

  await page.setViewport({ width: 420, height: 720 })
  await page.waitForSelector('imp-shell >>> .bottombar .link')
  expect(await visible(sidebar)).toEqual(false)
  expect(await topOf(bottomBar) > await topOf(main)).toBeTruthy()

  await page.click('imp-shell >>> .hamburger')
  expect(await page.$eval('imp-shell >>> .bar-nav', (node) => node.parentElement.className))
    .toEqual('drawer-nav')
  expect(await page.$eval('imp-shell >>> .tools', (node) => node.parentElement.className))
    .toEqual('drawer-tools')

  await page.keyboard.press('Escape')
  await page.setViewport({ width: 800, height: 600 })
})

test('the shell fills the viewport, so the page itself never scrolls', async ({ page }) => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollHeight - root.clientHeight
  })
  expect(overflow).toEqual(0)
})
