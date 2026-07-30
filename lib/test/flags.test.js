import { flag } from 'imp'
import { afterEach, expect, test } from 'imp/test'

afterEach(() => {
  delete globalThis.__IMP_FLAGS__
})

test('flag reads the declared flag injected for this environment', () => {
  globalThis.__IMP_FLAGS__ = { CHECKOUT_V2: true, NEW_NAV: false }
  expect(flag('CHECKOUT_V2')).toEqual(true)
  expect(flag('NEW_NAV')).toEqual(false)
})

test('a declared flag the environment leaves out is off, never undefined', () => {
  globalThis.__IMP_FLAGS__ = { NEW_NAV: false }
  expect(flag('NEW_NAV')).toEqual(false)
})

test('an undeclared flag throws, naming the flags that are declared', () => {
  globalThis.__IMP_FLAGS__ = { CHECKOUT_V2: true }
  expect(() => flag('CHEKOUT_V2')).toThrow("unknown flag 'CHEKOUT_V2'")
  expect(() => flag('CHEKOUT_V2')).toThrow('declared flags: CHECKOUT_V2')
})

test('a project with no flags declared says so', () => {
  expect(() => flag('CHECKOUT_V2')).toThrow("no flags are declared in imp.json's 'flags'")
})
