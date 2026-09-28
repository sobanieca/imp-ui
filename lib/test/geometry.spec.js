import { expect, test } from 'imp/test'

const boxes = (page, host, selector) =>
  page.$eval(host, (node, inner) =>
    [...node.shadowRoot.querySelectorAll(inner)].map((element) => {
      const { left, right, width } = element.getBoundingClientRect()
      return { left, right, width }
    }), selector)

const hostIn = (direction, part, name) => `#geometry-${direction} .${part} ${name}`

const settled = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))

test('a column chart puts the first category and the value axis at the inline start', async ({ page }) => {
  await page.setViewport({ width: 1000, height: 900 })
  await settled(page)
  const ltr = hostIn('ltr', 'geometry-chart', 'imp-chart')
  const rtl = hostIn('rtl', 'geometry-chart', 'imp-chart')
  const [ltrFirst, , ltrLast] = await boxes(page, ltr, '.category')
  const [rtlFirst, , rtlLast] = await boxes(page, rtl, '.category')
  expect(ltrFirst.left < ltrLast.left).toBeTruthy()
  expect(rtlFirst.left > rtlLast.left).toBeTruthy()
  const [ltrValues] = await boxes(page, ltr, '.values')
  const [ltrPlot] = await boxes(page, ltr, '.plot')
  const [rtlValues] = await boxes(page, rtl, '.values')
  const [rtlPlot] = await boxes(page, rtl, '.plot')
  expect(ltrValues.right <= ltrPlot.left + 1).toBeTruthy()
  expect(rtlValues.left >= rtlPlot.right - 1).toBeTruthy()
})

test('a gantt puts the labels at the inline start, and time runs toward the inline end', async ({ page }) => {
  const ltr = hostIn('ltr', 'geometry-gantt', 'imp-gantt')
  const rtl = hostIn('rtl', 'geometry-gantt', 'imp-gantt')
  const [ltrDesign, ltrBuild] = await boxes(page, ltr, '.bar')
  const [rtlDesign, rtlBuild] = await boxes(page, rtl, '.bar')
  expect(ltrDesign.left < ltrBuild.left).toBeTruthy()
  expect(rtlDesign.right > rtlBuild.right).toBeTruthy()
  expect(Math.abs(ltrDesign.width - rtlDesign.width) < 1).toBeTruthy()
  const [ltrLabel] = await boxes(page, ltr, '.task .label-cell')
  const [ltrTrack] = await boxes(page, ltr, '.task .track')
  const [rtlLabel] = await boxes(page, rtl, '.task .label-cell')
  const [rtlTrack] = await boxes(page, rtl, '.task .track')
  expect(ltrLabel.right <= ltrTrack.left + 1).toBeTruthy()
  expect(rtlLabel.left >= rtlTrack.right - 1).toBeTruthy()
})

test('a calendar month runs the week and a multi-day bar toward the inline end', async ({ page }) => {
  const ltr = hostIn('ltr', 'geometry-calendar', 'imp-calendar')
  const rtl = hostIn('rtl', 'geometry-calendar', 'imp-calendar')
  const ltrDays = await boxes(page, ltr, '.weekday')
  const rtlDays = await boxes(page, rtl, '.weekday')
  expect(ltrDays[0].left < ltrDays[6].left).toBeTruthy()
  expect(rtlDays[0].left > rtlDays[6].left).toBeTruthy()
  const [ltrBar] = await boxes(page, ltr, '.week > .bar')
  const [rtlBar] = await boxes(page, rtl, '.week > .bar')
  const [ltrCall] = await boxes(page, ltr, '.week > .chip')
  const [rtlCall] = await boxes(page, rtl, '.week > .chip')
  expect(ltrBar.left > ltrCall.right).toBeTruthy()
  expect(rtlBar.right < rtlCall.left).toBeTruthy()
  const cell = ltrDays[1].width
  expect(ltrBar.width > cell * 2.5 && ltrBar.width < cell * 3).toBeTruthy()
  expect(Math.abs(ltrBar.width - rtlBar.width) < 1).toBeTruthy()
})

test('the toast region sits in the inline end corner, and mirrors under dir="rtl"', async ({ page }) => {
  const popupBox = () =>
    page.$eval('#a11y-toast imp-toast', (node) => {
      const { left, right } = node.shadowRoot.querySelector('.region').getBoundingClientRect()
      return { left, right, width: document.documentElement.clientWidth }
    })
  const show = async () => {
    await page.click('#a11y-toast #a11y-notify')
    await page.waitForSelector('#a11y-toast imp-toast >>> .region:popover-open')
  }
  await show()
  const ltr = await popupBox()
  expect(Math.abs(ltr.right - ltr.width) < 1).toBeTruthy()
  expect(ltr.left > 0).toBeTruthy()
  await page.$eval('html', (node) => node.setAttribute('dir', 'rtl'))
  await settled(page)
  const rtl = await popupBox()
  expect(Math.abs(rtl.left) < 1).toBeTruthy()
  expect(rtl.right < rtl.width).toBeTruthy()
  await page.$eval('html', (node) => node.removeAttribute('dir'))
})
