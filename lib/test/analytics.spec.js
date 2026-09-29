import { expect, test } from 'imp/test'

const open = async (page, baseUrl, dir = 'ltr') => {
  await page.goto(`${baseUrl}analytics.html?dir=${dir}`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.analyticsRecords?.some((record) => record.type === 'view')
  )
}

const viewCount = (page) =>
  page.evaluate(() => globalThis.analyticsRecords.filter((record) => record.type === 'view').length)

const leave = async (page) => {
  const views = await viewCount(page)
  await page.click('#leave')
  await page.waitForFunction(
    (before) =>
      location.pathname === '/analytics/done' &&
      globalThis.analyticsRecords.filter((record) => record.type === 'view').length > before,
    {},
    views,
  )
}

const zonesOfFirstView = (page) =>
  page.evaluate(() => {
    const records = globalThis.analyticsRecords
    const first = records.find((record) => record.type === 'view').view
    return Object.fromEntries(
      records
        .filter((record) => record.type === 'zone' && record.view === first)
        .map((record) => [record.name, { seen: record.seen, activeMs: record.activeMs }]),
    )
  })

const nextFrame = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))

test('the entry view is recorded with its route pattern and a ready time', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  const view = await page.evaluate(() =>
    globalThis.analyticsRecords.find((record) => record.type === 'view')
  )
  expect(view.page).toEqual('/analytics')
  expect(view.from).toEqual(null)
  expect(typeof view.readyMs).toEqual('number')
})

test('a Tab through a zone is no use of it', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.focus('#before')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await leave(page)
  const zones = await zonesOfFirstView(page)
  expect(zones['due-date']).toEqual({ seen: true, activeMs: 0 })
})

test('a pick in the open panel of a datePicker counts for the zone around it', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.$eval('imp-date-picker >>> .panel', (panel) => panel.showPopover())
  await page.waitForSelector('imp-date-picker >>> .panel:popover-open button.day', {
    visible: true,
  })
  await page.click('imp-date-picker >>> .panel:popover-open button.day[aria-selected="false"]')
  await leave(page)
  const zones = await zonesOfFirstView(page)
  expect(zones['due-date'].activeMs > 0).toEqual(true)
})

test('a zone below the fold is not seen until the page scrolls to it', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await leave(page)
  expect((await zonesOfFirstView(page))['payment-options']).toEqual(undefined)
  await page.click('#back')
  await page.waitForSelector('#payment')
  await page.$eval('#payment', (node) => node.scrollIntoView())
  await nextFrame(page)
  await nextFrame(page)
  await leave(page)
  const seen = await page.evaluate(() =>
    globalThis.analyticsRecords.some((record) =>
      record.type === 'zone' && record.name === 'payment-options' && record.seen
    )
  )
  expect(seen).toEqual(true)
})

for (const dir of ['ltr', 'rtl']) {
  test(`a zone in an inactive tab panel is not seen (${dir})`, async ({ page, baseUrl }) => {
    await open(page, baseUrl, dir)
    await leave(page)
    const zones = await zonesOfFirstView(page)
    expect(zones['invoice-details']).toEqual({ seen: true, activeMs: 0 })
    expect(zones['invoice-history']).toEqual(undefined)
  })
}

test('a ResizeObserver loop is no error record, and an error of the app is one', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.evaluate(() =>
    new Promise((resolve) => {
      const box = document.createElement('div')
      document.body.append(box)
      let size = 10
      const observer = new ResizeObserver(() => {
        size += 10
        box.style.inlineSize = `${size}px`
      })
      addEventListener('error', () => {
        observer.disconnect()
        resolve()
      }, { once: true })
      observer.observe(box)
    })
  )
  await page.evaluate(() =>
    new Promise((resolve) => {
      addEventListener('error', () => setTimeout(resolve), { once: true })
      globalThis.failLater('real failure')
    })
  )
  const errors = await page.evaluate(() =>
    globalThis.analyticsRecords.filter((record) => record.type === 'error')
      .map((record) => record.message)
  )
  expect(errors).toEqual(['Error: real failure'])
})

test('pagehide sends the view of a screen that is not ready yet', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.evaluate(() => {
    globalThis.analyticsRecords.length = 0
    globalThis.navigate('/analytics/slow')
  })
  await nextFrame(page)
  await nextFrame(page)
  const view = await page.evaluate(() => {
    const before = globalThis.analyticsRecords.some((record) => record.type === 'view')
    dispatchEvent(new PageTransitionEvent('pagehide'))
    const views = globalThis.analyticsRecords.filter((record) => record.type === 'view')
    return before ? null : views.at(-1)
  })
  expect(view.page).toEqual('/analytics/slow')
  expect(view.readyMs).toEqual(null)
  expect(typeof view.waitedMs).toEqual('number')
})

test('a sink that registers late gets the view record of the current screen', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  const [late, first] = await page.evaluate(() => {
    const records = []
    globalThis.onAnalytics((record) => void records.push(record))
    return [records, globalThis.analyticsRecords.find((record) => record.type === 'view')]
  })
  expect(late).toEqual([first])
})
