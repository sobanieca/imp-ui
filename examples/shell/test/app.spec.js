import { expect, test } from 'imp/test'

const title = (page) => page.$eval('h1', (node) => node.textContent)

const rowTitles = (page) =>
  page.$$eval(
    'todo-row',
    (rows) => rows.map((row) => row.shadowRoot.querySelector('.title').textContent),
  )

const sidebarCount = (page, href) =>
  page.$eval(
    `nav[aria-label="Sections"] a[href="${href}"] imp-tag`,
    (node) => node.shadowRoot.textContent.trim(),
  )

const openSection = async (page, href) => {
  await page.click(`nav[aria-label="Sections"] a[href="${href}"]`)
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

test('the bottom bar carries the same sections for small screens', async ({ page }) => {
  const compact = await page.$$eval(
    'nav[aria-label="Sections, compact"] a',
    (links) => links.map((anchor) => anchor.getAttribute('href')),
  )
  expect(compact).toEqual(['/', '/active', '/done', '/settings'])
})
