import { expect, test } from 'imp/test'

test('adds numbers', () => {
  expect(1 + 1).toEqual(2)
})

test('reports a failure', () => {
  expect(1 + 1).toEqual(3)
})

test.skip('is skipped for now', () => {})
