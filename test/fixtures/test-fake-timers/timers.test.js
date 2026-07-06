import { expect, test } from 'imp/test'

test('setTimeout fires on virtual time', ({ clock }) => {
  let fired = false
  setTimeout(() => fired = true, 1000)
  clock.tick(999)
  expect(fired).toBe(false)
  clock.tick(1)
  expect(fired).toBe(true)
}, { fakeTimers: true })

test('setInterval and Date advance from a fixed start', ({ clock }) => {
  const stamps = []
  setInterval(() => stamps.push(Date.now()), 100)
  clock.tick(300)
  expect(stamps).toEqual([100, 200, 300])
  expect(Date.now()).toBe(300)
}, { fakeTimers: { now: 0 } })

test('tickAsync flushes awaited work between timers', async ({ clock }) => {
  const log = []
  const flow = async () => {
    setTimeout(() => log.push('later'), 100)
    await new Promise((resolve) => setTimeout(resolve, 50))
    log.push('sooner')
  }
  flow()
  await clock.tickAsync(100)
  expect(log).toEqual(['sooner', 'later'])
}, { fakeTimers: true })

test('a plain test keeps real timers and no clock', (context) => {
  expect(context.clock).toBeUndefined()
})
