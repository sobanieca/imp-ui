import { expect, test } from 'imp/test'

const textOf = (page, selector) => page.$eval(selector, (node) => node.textContent)

const documentLanguage = (page) => page.$eval('html', (node) => node.lang)

const settled = (page) =>
  page.$eval('html', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

test('translated text renders in the starting language', async ({ page }) => {
  expect(await textOf(page, '>>> #i18n-title')).toEqual('Translations')
  expect(await textOf(page, '>>> #i18n-notes')).toEqual('Notes: 3')
  expect(await documentLanguage(page)).toEqual('en')
})

test('setLang re-localizes text in place, without a re-render', async ({ page }) => {
  const before = await page.$eval('>>> #i18n-title', (node) => {
    node.dataset.kept = 'yes'
    return node.dataset.kept
  })
  await page.click('>>> #to-polish')
  await settled(page)
  expect(await textOf(page, '>>> #i18n-title')).toEqual('Tłumaczenia')
  expect(await textOf(page, '>>> #i18n-notes')).toEqual('Notatki: 3')
  expect(await documentLanguage(page)).toEqual('pl')
  expect(await page.$eval('>>> #i18n-title', (node) => node.dataset.kept)).toEqual(before)
})

test('writing <html lang> from the page loads that language too', async ({ page }) => {
  await page.$eval('html', (node) => {
    node.lang = 'en'
  })
  await settled(page)
  expect(await textOf(page, '>>> #i18n-title')).toEqual('Translations')
  expect(await textOf(page, '>>> #i18n-notes')).toEqual('Notes: 3')
})
