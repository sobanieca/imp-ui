import { expect, test } from 'imp/test'

const open = async (page, baseUrl, dir = 'ltr') => {
  await page.goto(`${baseUrl}analytics.html?dir=${dir}`, { waitUntil: 'load' })
  await page.waitForFunction(() =>
    globalThis.analyticsRecords?.some((record) => record.type === 'page')
  )
}

const recordsOf = (page, type) =>
  page.evaluate(
    (type) => globalThis.analyticsRecords.filter((record) => record.type === type),
    type,
  )

const nextFrame = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))

const seenZones = async (page) => (await recordsOf(page, 'seen')).map((record) => record.zone)

test('the entry page is recorded with its route pattern', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  const [entry] = await recordsOf(page, 'page')
  expect(Object.keys(entry)).toEqual(['type', 'visit', 'at', 'page'])
  expect(entry.page).toEqual('/analytics')
  expect(typeof entry.at).toEqual('number')
  expect(typeof entry.visit).toEqual('string')
})

test('a zone in the viewport is seen once, a Tab through it is no use, and a key in it is', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await nextFrame(page)
  await nextFrame(page)
  expect((await seenZones(page)).filter((zone) => zone === 'demo.due-date')).toEqual([
    'demo.due-date',
  ])
  await page.focus('#before')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  expect(await recordsOf(page, 'used')).toEqual([])
  await page.focus('#before')
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowDown')
  const used = await recordsOf(page, 'used')
  expect(used.map((record) => record.zone)).toEqual([null, 'demo.due-date'])
  expect(used[1].page).toEqual('/analytics')
})

test('a wheel turn over a zone is no use', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.hover('#after')
  await page.mouse.wheel({ deltaY: 200 })
  await nextFrame(page)
  expect(await recordsOf(page, 'used')).toEqual([])
})

test('a pick in the open panel of a datePicker counts for the zone around it', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.$eval('imp-date-picker >>> .panel', (panel) => panel.showPopover())
  await page.waitForSelector('imp-date-picker >>> .panel:popover-open button.day', {
    visible: true,
  })
  await page.click('imp-date-picker >>> .panel:popover-open button.day[aria-selected="false"]')
  const used = await recordsOf(page, 'used')
  expect(used.map((record) => record.zone)).toEqual([null, 'demo.due-date'])
})

test('a click outside every zone is a use of the page, once per page view', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.click('#after')
  await page.click('#before')
  const used = await recordsOf(page, 'used')
  expect(used.map((record) => record.zone)).toEqual([null])
})

test('a zone below the fold is not seen until the page scrolls to it', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await nextFrame(page)
  await nextFrame(page)
  expect((await seenZones(page)).includes('demo.payment-options')).toEqual(false)
  await page.$eval('#payment', (node) => node.scrollIntoView())
  await nextFrame(page)
  await nextFrame(page)
  expect((await seenZones(page)).includes('demo.payment-options')).toEqual(true)
})

for (const dir of ['ltr', 'rtl']) {
  test(`a zone in an inactive tab panel is not seen (${dir})`, async ({ page, baseUrl }) => {
    await open(page, baseUrl, dir)
    await nextFrame(page)
    await nextFrame(page)
    const zones = await seenZones(page)
    expect(zones.includes('demo.invoice-details')).toEqual(true)
    expect(zones.includes('demo.invoice-history')).toEqual(false)
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
  expect(await recordsOf(page, 'error')).toEqual([])
  await page.evaluate(() =>
    new Promise((resolve) => {
      addEventListener('error', () => setTimeout(resolve), { once: true })
      globalThis.failLater('real failure')
    })
  )
  const errors = await recordsOf(page, 'error')
  expect(errors.map((record) => Object.keys(record))).toEqual([['type', 'visit', 'at', 'page']])
  expect(errors[0].page).toEqual('/analytics')
})

test('a screen that is never ready sends no page record', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  await page.evaluate(() => {
    globalThis.analyticsRecords.length = 0
    globalThis.navigate('/analytics/slow')
  })
  await nextFrame(page)
  await nextFrame(page)
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')))
  expect(await recordsOf(page, 'page')).toEqual([])
  await page.evaluate(() => globalThis.navigate('/analytics/done'))
  await page.waitForFunction(() =>
    globalThis.analyticsRecords.some((record) => record.type === 'page')
  )
  const pages = await recordsOf(page, 'page')
  expect(pages.map((record) => record.page)).toEqual(['/analytics/done'])
})

test('a sink that registers late gets the page record of the current screen', async ({ page, baseUrl }) => {
  await open(page, baseUrl)
  const [late, first] = await page.evaluate(() => {
    const records = []
    globalThis.onAnalytics((record) => void records.push(record))
    return [records, globalThis.analyticsRecords.find((record) => record.type === 'page')]
  })
  expect(late).toEqual([first])
})
