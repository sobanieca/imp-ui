import { expect, test } from 'imp/test'

const textOf = (page, selector) => page.$eval(selector, (node) => node.textContent)

const documentLanguage = (page) => page.$eval('html', (node) => node.lang)

const documentDirection = (page) => page.$eval('html', (node) => node.dir)

const writeLanguage = (page, code) =>
  page.$eval('html', (node, value) => {
    node.lang = value
  }, code)

const settled = (page) =>
  page.$eval('html', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

test('translated text renders in the starting language', async ({ page }) => {
  expect(await textOf(page, '#i18n-title')).toEqual('Translations')
  expect(await textOf(page, '#i18n-notes')).toEqual('Notes: 3')
  expect(await documentLanguage(page)).toEqual('en')
})

test('setLang re-localizes text in place, without a re-render', async ({ page }) => {
  const before = await page.$eval('#i18n-title', (node) => {
    node.dataset.kept = 'yes'
    return node.dataset.kept
  })
  await page.click('#to-polish')
  await settled(page)
  expect(await textOf(page, '#i18n-title')).toEqual('Tłumaczenia')
  expect(await textOf(page, '#i18n-notes')).toEqual('Notatki: 3')
  expect(await documentLanguage(page)).toEqual('pl')
  expect(await page.$eval('#i18n-title', (node) => node.dataset.kept)).toEqual(before)
})

test('writing <html lang> from the page loads that language too', async ({ page }) => {
  await writeLanguage(page, 'en')
  await settled(page)
  expect(await textOf(page, '#i18n-title')).toEqual('Translations')
  expect(await textOf(page, '#i18n-notes')).toEqual('Notes: 3')
})

test('a component reads in its own wording when the app has not translated its key', async ({ page }) => {
  expect(await textOf(page, 'imp-empty-state >>> .title')).toEqual('Nothing here yet')
})

test("an app's translation replaces a component's wording on a language switch", async ({ page }) => {
  await page.click('#to-polish')
  await settled(page)
  expect(await textOf(page, 'imp-empty-state >>> .title')).toEqual('Nic tu jeszcze nie ma')
  await page.click('#to-english')
  await settled(page)
  expect(await textOf(page, 'imp-empty-state >>> .title')).toEqual('Nothing here yet')
})

test('the text direction follows the language onto <html dir>', async ({ page }) => {
  expect(await documentDirection(page)).toEqual('ltr')
  await writeLanguage(page, 'ar')
  await settled(page)
  expect(await documentDirection(page)).toEqual('rtl')
  await writeLanguage(page, 'en')
  await settled(page)
  expect(await documentDirection(page)).toEqual('ltr')
})
