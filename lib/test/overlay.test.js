import { component, mount } from 'imp'
import { div } from 'imp/html'
import { dialog } from 'imp/std/layout'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const stateHost = component('dialog-host', {
  build: (_instance, build) => build(initState('dialog.open', false)),
})

const withOpenState = (build) => {
  let state = null
  let host = null
  mounted(stateHost((handle) => {
    state = handle
    host = build(handle)
    return host
  }))
  return { state, host }
}

const panelOf = (host) => host.shadowRoot.querySelector('.panel')

const closeButtonOf = (host) => host.shadowRoot.querySelector('.close')

const barOf = (host) => host.shadowRoot.querySelector('.bar')

const outsideButton = () => document.body.appendChild(document.createElement('button'))

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const pointerDown = (node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const settled = async () => {
  for (let tick = 0; tick < 3; tick += 1) await Promise.resolve()
}

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.style.overflow = ''
})

test('dialog renders a titled panel with a close button, and stays shut until asked', () => {
  const host = mounted(dialog({ title: 'Edit user' }, div('form')))
  expect(host.localName).toEqual('imp-dialog')
  const panel = panelOf(host)
  expect(panel.localName).toEqual('dialog')
  expect(panel.open).toEqual(false)
  expect(panel.getAttribute('aria-labelledby')).toEqual('title')
  expect(host.shadowRoot.querySelector('.title').id).toEqual('title')
  expect(host.shadowRoot.querySelector('.title').textContent).toEqual('Edit user')
  expect(closeButtonOf(host).getAttribute('aria-label')).toEqual('Close')
})

test('a dialog is modal by default and paints a backdrop rather than a popover', () => {
  const host = mounted(dialog({ title: 'Edit user' }))
  expect(panelOf(host).hasAttribute('data-modal')).toEqual(true)
  expect(panelOf(host).hasAttribute('popover')).toEqual(false)
  expect(barOf(host).hasAttribute('tabindex')).toEqual(false)
  expect(panelOf(host).hasAttribute('data-movable')).toEqual(false)
})

test('an open modal dialog holds the page scroll and inerts the page behind it', async () => {
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }))
  const outside = outsideButton()

  state.set(true)
  expect(panelOf(host).open).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('hidden')
  expect(outside.inert).toEqual(true)

  state.set(false)
  await settled()
  expect(panelOf(host).open).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(outside.inert).toEqual(false)
})

test('the close button shuts the dialog, writes the state back and reports the change', async () => {
  const changes = []
  const { state, host } = withOpenState((open) =>
    dialog({
      title: 'Edit user',
      open,
      events: { openToggle: (event) => changes.push(event.detail.open) },
    })
  )

  state.set(true)
  click(closeButtonOf(host))
  expect(state.get()).toEqual(false)
  expect(changes).toEqual([false])
  await settled()
  expect(panelOf(host).open).toEqual(false)
})

test('escape dismisses a modal dialog through the closing slide', async () => {
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }))
  state.set(true)
  press(panelOf(host), 'Escape')
  expect(panelOf(host).open).toEqual(true)
  await settled()
  expect(panelOf(host).open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('a click on the backdrop dismisses a modal dialog', async () => {
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }))
  state.set(true)
  const panel = panelOf(host)
  pointerDown(panel)
  click(panel)
  await settled()
  expect(panel.open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('a drag that starts inside the panel leaves a modal dialog open', async () => {
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }))
  state.set(true)
  const panel = panelOf(host)
  pointerDown(barOf(host))
  click(panel)
  await settled()
  expect(panel.open).toEqual(true)
  expect(state.get()).toEqual(true)

  state.set(false)
  await settled()
})

test('a non-modal dialog is a manual popover that leaves the page alone', () => {
  const { state, host } = withOpenState((open) =>
    dialog({ title: 'Inspector', modal: false, open })
  )
  const outside = outsideButton()

  state.set(true)
  const panel = panelOf(host)
  expect(panel.getAttribute('popover')).toEqual('manual')
  expect(panel.hasAttribute('data-modal')).toEqual(false)
  expect(panel.open).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(outside.inert).toEqual(false)
})

test('a non-modal dialog moves by its title bar and hands focus back when it closes', async () => {
  const { state, host } = withOpenState((open) =>
    dialog({ title: 'Inspector', modal: false, open })
  )
  const invoker = outsideButton()
  invoker.focus()
  const bar = barOf(host)
  expect(bar.getAttribute('tabindex')).toEqual('0')
  expect(bar.getAttribute('aria-label')).toEqual('Move this window with the arrow keys')

  state.set(true)
  press(bar, 'ArrowRight')
  press(bar, 'ArrowDown')
  press(bar, 'ArrowDown')
  expect(panelOf(host).style.getPropertyValue('--drag-x')).toEqual('16px')
  expect(panelOf(host).style.getPropertyValue('--drag-y')).toEqual('32px')

  state.set(false)
  await settled()
  expect(document.activeElement).toEqual(invoker)

  state.set(true)
  expect(panelOf(host).style.getPropertyValue('--drag-x')).toEqual('0px')
})

test('a dialog told to open at mount waits until it is in the document', async () => {
  const host = mounted(dialog({ title: 'Edit user', open: true }))
  expect(panelOf(host).open).toEqual(false)
  await nextFrame()
  expect(panelOf(host).open).toEqual(true)
})

test('several non-modal dialogs are open at once, none of them holding the page', async () => {
  const first = mounted(dialog({ title: 'One', modal: false, open: true }))
  const second = document.body.appendChild(dialog({ title: 'Two', modal: false, open: true }))
  await nextFrame()
  expect(panelOf(first).matches('[popover]')).toEqual(true)
  expect(panelOf(second).matches('[popover]')).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('')
})

test('a dialog without a title is reported, and an unknown prop with it', () => {
  const warn = warnings()
  mounted(dialog({ heading: 'Edit user' }))
  expect(warned(warn, "dialog: pass a 'title'")).toBeTruthy()
  expect(warned(warn, "dialog: unknown prop 'heading'")).toBeTruthy()
})
