import { expect, test } from 'imp/test'

test('setTimeout fires on virtual time', async ({ clock }) => {
  let fired = false
  setTimeout(() => fired = true, 1000)
  await clock.tick(999)
  expect(fired).toEqual(false)
  await clock.tick(1)
  expect(fired).toEqual(true)
}, { fakeTimers: true })

test('setInterval and Date advance from a fixed start', async ({ clock }) => {
  const stamps = []
  setInterval(() => stamps.push(Date.now()), 100)
  await clock.tick(300)
  expect(stamps).toEqual([100, 200, 300])
  expect(Date.now()).toEqual(300)
}, { fakeTimers: { now: 0 } })

test('tick flushes awaited work between timers', async ({ clock }) => {
  const log = []
  const flow = async () => {
    setTimeout(() => log.push('later'), 100)
    await new Promise((resolve) => setTimeout(resolve, 50))
    log.push('sooner')
  }
  flow()
  await clock.tick(100)
  expect(log).toEqual(['sooner', 'later'])
}, { fakeTimers: true })

test('runAll drains every pending timer', async ({ clock }) => {
  const log = []
  setTimeout(() => log.push('a'), 10)
  setTimeout(() => log.push('b'), 5000)
  await clock.runAll()
  expect(log).toEqual(['a', 'b'])
}, { fakeTimers: true })

test('a plain test keeps real timers and no clock', (context) => {
  expect(context.clock).toEqual(undefined)
})
