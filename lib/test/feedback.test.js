import { mount } from 'imp'
import { bugReport } from 'imp/std/feedback'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const control = (host, selector) => inner(host, selector).shadowRoot.querySelector('button')

const trigger = (host) => control(host, '.trigger')

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const pointAt = (node) =>
  node.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))

const press = (node, key, options = {}) =>
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...options }),
  )

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const target = () => {
  const node = document.createElement('p')
  node.id = 'subject'
  node.textContent = 'the broken bit'
  document.body.append(node)
  return node
}

beforeEach(() => {
  document.body.replaceChildren()
})

test('bugReport renders its trigger as a std button with the default wording', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  expect(host.localName).toEqual('imp-bug-report')
  expect(inner(host, '.trigger').localName).toEqual('imp-button')
  expect(trigger(host).localName).toEqual('button')
  expect(renderedText(host)).toContain('Report a problem')
})

test('bugReport renders a link-looking button when asked', () => {
  const host = mounted(bugReport({ as: 'link', onSubmit: () => {} }, 'Something looks wrong'))
  const link = trigger(host)
  expect(link.localName).toEqual('button')
  expect(link.classList.contains('variant-link')).toBeTruthy()
  expect(renderedText(link)).toEqual('Something looks wrong')
})

test('bugReport names a trigger with its own content through label', () => {
  const host = mounted(
    bugReport({ label: 'Report a problem', onSubmit: () => {} }, 'Something looks wrong'),
  )
  expect(trigger(host).getAttribute('aria-label')).toEqual('Report a problem')
  expect(renderedText(host)).toContain('Something looks wrong')
})

test('bugReport warns without an onSubmit and falls back for an unknown mode', () => {
  const warn = warnings()
  mounted(bugReport({ as: 'banner' }))
  expect(warned(warn, "needs an 'onSubmit'")).toBeTruthy()
  expect(warned(warn, "'as' must be one of")).toBeTruthy()
})

test('bugReport hides the picking hint and the panel until the trigger is pressed', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  expect(inner(host, '.hint').hidden).toBeTruthy()
  expect(inner(host, '.panel').open).not.toBeTruthy()
  expect(inner(host, '.outline').hidden).toBeTruthy()
})

test('bugReport outlines the element under the pointer while picking', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  expect(inner(host, '.hint').hidden).not.toBeTruthy()
  pointAt(subject)
  expect(inner(host, '.outline').hidden).not.toBeTruthy()
})

test('bugReport never shows the element path to the person reporting', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  click(subject)
  expect(renderedText(host)).not.toContain('>')
  expect(renderedText(host)).not.toContain('#subject')
})

test('bugReport opens the comment panel on the picked element and keeps it outlined', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  pointAt(subject)
  click(subject)
  expect(inner(host, '.panel').open).toBeTruthy()
  expect(inner(host, '.hint').hidden).toBeTruthy()
  expect(inner(host, '.outline').hidden).not.toBeTruthy()
})

test('bugReport refuses to send an empty comment', () => {
  const sent = []
  const host = mounted(bugReport({ onSubmit: (report) => sent.push(report) }))
  const subject = target()
  click(trigger(host))
  click(subject)
  click(control(host, '.send'))
  expect(sent).toEqual([])
  expect(inner(host, '.error').hidden).not.toBeTruthy()
  expect(inner(host, 'textarea').getAttribute('aria-invalid')).toEqual('true')
})

test('bugReport hands onSubmit the comment and what was on the screen', async () => {
  const sent = []
  const host = mounted(bugReport({ onSubmit: (report) => sent.push(report) }))
  const subject = target()
  click(trigger(host))
  click(subject)
  inner(host, 'textarea').value = 'this paragraph is unreadable'
  click(control(host, '.send'))
  await settle()
  expect(sent.length).toEqual(1)
  const [report] = sent
  expect(report.comment).toEqual('this paragraph is unreadable')
  expect(report.page).toEqual(location.href)
  expect(report.element.path).toContain('p#subject')
  expect(report.element.text).toEqual('the broken bit')
  expect(Array.isArray(report.state)).toBeTruthy()
  expect(Array.isArray(report.controls)).toBeTruthy()
})

test('bugReport closes and thanks the person once the report is stored', async () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  click(subject)
  inner(host, 'textarea').value = 'unreadable'
  click(control(host, '.send'))
  await settle()
  expect(inner(host, '.panel').open).not.toBeTruthy()
  expect(inner(host, '.outline').hidden).toBeTruthy()
  expect(inner(host, '.status').textContent).toContain('your report was sent')
})

test('bugReport keeps the comment when onSubmit fails', async () => {
  const errors = spy(console, 'error', () => {})
  const host = mounted(bugReport({ onSubmit: () => Promise.reject(new Error('offline')) }))
  const subject = target()
  click(trigger(host))
  click(subject)
  inner(host, 'textarea').value = 'unreadable'
  click(control(host, '.send'))
  await settle()
  expect(inner(host, '.panel').open).toBeTruthy()
  expect(inner(host, 'textarea').value).toEqual('unreadable')
  expect(inner(host, '.error').hidden).not.toBeTruthy()
  expect(errors.calls.length).toBeGreaterThan(0)
})

test('bugReport cancels picking on Escape', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  pointAt(subject)
  press(subject, 'Escape')
  expect(inner(host, '.hint').hidden).toBeTruthy()
  expect(inner(host, '.outline').hidden).toBeTruthy()
})

test('bugReport takes the highlighted element on Enter', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  const subject = target()
  click(trigger(host))
  pointAt(subject)
  press(subject, 'Enter')
  expect(inner(host, '.panel').open).toBeTruthy()
})

test('bugReport never picks its own chrome', () => {
  const host = mounted(bugReport({ onSubmit: () => {} }))
  click(trigger(host))
  pointAt(inner(host, '.hint'))
  expect(inner(host, '.outline').hidden).toBeTruthy()
})

test('bugReport labels its panel and marks it busy while sending', async () => {
  let release = null
  const host = mounted(bugReport({ onSubmit: () => new Promise((resolve) => (release = resolve)) }))
  const subject = target()
  click(trigger(host))
  click(subject)
  const panel = inner(host, '.panel')
  expect(panel.getAttribute('aria-label')).toEqual('Report a problem')
  inner(host, 'textarea').value = 'unreadable'
  click(control(host, '.send'))
  await settle()
  expect(control(host, '.send').disabled).toBeTruthy()
  expect(panel.getAttribute('aria-busy')).toEqual('true')
  release()
  await settle()
  expect(control(host, '.send').disabled).not.toBeTruthy()
})
