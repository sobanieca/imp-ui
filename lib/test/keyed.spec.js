import { expect, test } from 'imp/test'

const noteTitles = (page) =>
  page.$$eval('#notes li span', (nodes) => nodes.map((node) => node.textContent))

test('renders the keyed notes', async ({ page }) => {
  expect(await noteTitles(page)).toEqual(['first note', 'second note'])
})

test('toggling one note keeps the text typed into another', async ({ page }) => {
  await page.type('#note-one .note-draft', 'draft in progress')
  await page.click('#note-two .note-toggle')
  expect(await page.$eval('#note-two', (node) => node.className)).toEqual('done')
  expect(await page.$eval('#note-one .note-draft', (node) => node.value)).toEqual(
    'draft in progress',
  )
})

test('toggling a note keeps its own siblings in place', async ({ page }) => {
  await page.click('#note-two .note-toggle')
  expect(await page.$eval('#note-two', (node) => node.className)).toEqual('')
  expect(await noteTitles(page)).toEqual(['first note', 'second note'])
  expect(await page.$eval('#note-one .note-draft', (node) => node.value)).toEqual(
    'draft in progress',
  )
})
