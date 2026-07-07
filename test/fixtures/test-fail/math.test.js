import { expect, test } from 'imp/test'

test('passes', () => {
  expect(1 + 1).toEqual(2)
})

test('wrong sum', () => {
  expect(2 + 2).toEqual(5)
})

test('throws unexpectedly', () => {
  JSON.parse('{oops')
})

test('times out', () => new Promise(() => {}), { timeout: 50 })

test.skip('not ready yet', () => {})
