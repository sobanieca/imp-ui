import { expect, test } from 'imp/test'

const edgesOf = (page, selector) =>
  page.$eval(selector, (node) => {
    const { left, right } = node.getBoundingClientRect()
    return { left, right }
  })

test('a flex row keeps its children in source order under dir="rtl"', async ({ page }) => {
  const ltrFirst = await edgesOf(page, '#ltr-row imp-flex >>> #ltr-first')
  const ltrSecond = await edgesOf(page, '#ltr-row imp-flex >>> #ltr-second')
  expect(ltrFirst.left < ltrSecond.left).toBeTruthy()

  const rtlFirst = await edgesOf(page, '#rtl-row imp-flex >>> #rtl-first')
  const rtlSecond = await edgesOf(page, '#rtl-row imp-flex >>> #rtl-second')
  expect(rtlFirst.left < rtlSecond.left).toBeTruthy()
})

test('a column aligned left stays on the left under dir="rtl"', async ({ page }) => {
  const container = await edgesOf(page, '#rtl-column')
  const stacked = await edgesOf(page, '#rtl-column imp-column >>> #rtl-stacked')
  expect(stacked.left - container.left < 1).toBeTruthy()
  expect(container.right - stacked.right > 1).toBeTruthy()
})
