import { expect, mockModule, spy, test } from 'imp/test'
import { loadProfile } from './widgets/profile.js'
import { get } from './http.js'
import { add, mul } from './mathx.js'
import newEmitter from 'mitt'

mockModule('./http.js', ({ spy }) => ({
  get: spy(() => Promise.resolve({ name: 'imp' })),
}))

mockModule('mitt', ({ spy }) => ({
  default: () => ({ on: spy(), emit: spy() }),
}))

mockModule('./mathx.js', ({ spy, orig }) => ({
  ...orig(),
  mul: spy(() => 0),
}))

test('mocks a module transitively, across import depths', async () => {
  expect(await loadProfile()).toEqual('USER: IMP')
  expect(get.calls).toEqual([['/me']])
})

test('mocks the default export of an npm dependency', () => {
  const emitter = newEmitter()
  emitter.emit('hi')
  expect(emitter.emit.calls).toContain(['hi'])
})

test('orig() keeps some exports real while mocking others', () => {
  expect(add(2, 3)).toEqual(5)
  expect(mul(2, 3)).toEqual(0)
})

test('spy records calls and wraps an existing method', () => {
  const callback = spy()
  callback(1)
  callback(2)
  expect(callback.calls).toEqual([[1], [2]])

  const service = { greet: (name) => `hi ${name}` }
  const greet = spy(service, 'greet')
  expect(service.greet('imp')).toEqual('hi imp')
  expect(greet.calls).toEqual([['imp']])
})
