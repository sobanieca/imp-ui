import { afterEach, beforeEach, expect, test } from 'imp/test'
import { claimScreen, releaseScreen, transitionScreen } from '../src/screen.js'

const BACK_ATTRIBUTE = 'data-imp-screen-back'

const root = document.documentElement
const nativeStartViewTransition = document.startViewTransition
let main = null

const controlledTransition = (update) => {
  let finish = null
  const finished = new Promise((resolve) => (finish = resolve))
  const updateCallbackDone = Promise.resolve().then(update)
  return { ready: Promise.resolve(), updateCallbackDone, finished, finish }
}

beforeEach(() => {
  main = document.createElement('main')
  document.body.append(main)
  claimScreen(main, 'slide')
  document.startViewTransition = controlledTransition
})

afterEach(() => {
  document.startViewTransition = nativeStartViewTransition
  releaseScreen(main)
  main.remove()
  root.removeAttribute(BACK_ATTRIBUTE)
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a back navigation that interrupts a forward one keeps the back direction', async () => {
  const forward = transitionScreen(() => {}, { back: false })
  const back = transitionScreen(() => {}, { back: true })
  forward.finish()
  await settle()
  expect(root.hasAttribute(BACK_ATTRIBUTE)).toEqual(true)
  back.finish()
  await settle()
  expect(root.hasAttribute(BACK_ATTRIBUTE)).toEqual(false)
})

test('a forward navigation that interrupts a back one clears the back direction', async () => {
  const back = transitionScreen(() => {}, { back: true })
  const forward = transitionScreen(() => {}, { back: false })
  expect(root.hasAttribute(BACK_ATTRIBUTE)).toEqual(false)
  back.finish()
  await settle()
  expect(root.hasAttribute(BACK_ATTRIBUTE)).toEqual(false)
  forward.finish()
  await settle()
  expect(root.hasAttribute(BACK_ATTRIBUTE)).toEqual(false)
})
