import { expect, test } from 'imp/test'
import { add, greet } from './lib.js'

test('adds numbers', () => {
  expect(add(2, 3)).toBe(5)
})

test('greets by name', () => {
  expect(greet('imp')).toBe('hello imp')
  expect(greet('imp')).toMatch(/^hello/)
  expect(['a', 'b']).toContain('a')
  expect({ deep: { value: 1 } }).toEqual({ deep: { value: 1 } })
  expect(() => greet()).toThrow('name required')
  expect(add(0.1, 0.2)).toBeCloseTo(0.3)
  expect(greet('x')).not.toBe('hello y')
})
