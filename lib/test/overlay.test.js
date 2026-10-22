import { component, mount } from 'imp'
import { div } from 'imp/html'
import { dialog, drawer } from 'imp/std/layout'
import { comboBox } from 'imp/std/inputs'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const stateHost = component('dialog-host', {
  setup: (self, render) => render(initState(self, 'dialog.open', false)),
})

const withOpenState = (build) => {
  let state = null
  let host = null
  mounted(
    stateHost((handle) => {
      state = handle
      host = build(handle)
      return host
    }),
  )
  return { state, host }
}

const panelOf = (host) => host.shadowRoot.querySelector('.panel')

const closeButtonOf = (host) => host.shadowRoot.querySelector('.close')

const barOf = (host) => host.shadowRoot.querySelector('.bar')

const outsideButton = () => document.body.appendChild(document.createElement('button'))

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const pointerDown = (node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

const press = (node, key) =>
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  )

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const closed = (host) =>
  new Promise((resolve) => panelOf(host).addEventListener('close', () => resolve(), { once: true }))

const takesFocus = (node) => {
  node.focus()
  return document.activeElement === node
}

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
  expect(takesFocus(outside)).toEqual(false)

  const shut = closed(host)
  state.set(false)
  await shut
  expect(panelOf(host).open).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(takesFocus(outside)).toEqual(true)
})

test('the close button shuts the dialog, writes the state back and reports the change', async () => {
  const changes = []
  const { state, host } = withOpenState((open) =>
    dialog({
      title: 'Edit user',
      open,
      events: { openToggle: (event) => changes.push(event.detail.open) },
    }),
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
  const shut = closed(host)
  press(panelOf(host), 'Escape')
  expect(panelOf(host).open).toEqual(true)
  await shut
  expect(panelOf(host).open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('a click on the backdrop dismisses a modal dialog', async () => {
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }))
  state.set(true)
  const panel = panelOf(host)
  const shut = closed(host)
  pointerDown(panel)
  click(panel)
  await shut
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
    dialog({ title: 'Inspector', modal: false, open }),
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
    dialog({ title: 'Inspector', modal: false, open }),
  )
  const invoker = outsideButton()
  invoker.focus()
  const bar = barOf(host)
  expect(bar.getAttribute('tabindex')).toEqual('0')
  expect(bar.getAttribute('aria-label')).toEqual('Move this window with the arrow keys')

  state.set(true)
  expect(panelOf(host).getAttribute('tabindex')).toEqual('-1')
  expect(host.shadowRoot.activeElement).toEqual(panelOf(host))
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

test('a non-modal dialog with an anchor names that element while it is open', async () => {
  const anchor = document.createElement('button')
  let host = null
  const { state } = withOpenState((open) => {
    host = dialog({ title: 'Inspector', modal: false, open, anchor })
    return div(anchor, host)
  })
  const panel = panelOf(host)
  const anchorName = () => anchor.style.getPropertyValue('anchor-name')
  const sheets = () => host.getRootNode().adoptedStyleSheets.length
  const resting = sheets()
  expect(panel.hasAttribute('data-anchored')).toEqual(true)
  expect(panel.getAttribute('part')).toEqual('panel')
  expect(anchorName()).toEqual('')

  state.set(true)
  expect(anchorName().startsWith('--imp-dialog-')).toEqual(true)
  expect(host.getAttribute('data-imp-dialog')).toEqual(anchorName().replace('--imp-dialog-', ''))
  expect(sheets()).toEqual(resting + 1)

  state.set(false)
  await settled()
  expect(anchorName()).toEqual('')
})

test('a modal dialog ignores an anchor', () => {
  const { host } = withOpenState((open) =>
    dialog({ title: 'Edit user', open, anchor: outsideButton() }),
  )
  expect(panelOf(host).hasAttribute('data-anchored')).toEqual(false)
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

test('drawer renders a titled panel with a close button, modal, and shut', () => {
  const host = mounted(drawer({ title: 'Filters' }, div('form')))
  expect(host.localName).toEqual('imp-drawer')
  const panel = panelOf(host)
  expect(panel.localName).toEqual('dialog')
  expect(panel.open).toEqual(false)
  expect(panel.getAttribute('aria-labelledby')).toEqual('title')
  expect(host.shadowRoot.querySelector('.title').textContent).toEqual('Filters')
  expect(closeButtonOf(host).getAttribute('aria-label')).toEqual('Close')
  expect(host.shadowRoot.querySelector('.pin')).toEqual(null)
  expect(panel.hasAttribute('data-modal')).toEqual(true)
  expect(panel.hasAttribute('popover')).toEqual(false)
})

test('drawer paints a background node under its bar and body, hidden from assistive technology', () => {
  const host = mounted(drawer({ title: 'Filters', background: div({ id: 'sky' }) }, div('form')))
  const backdrop = panelOf(host).firstElementChild
  expect(backdrop.classList.contains('backdrop')).toBeTruthy()
  expect(backdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(backdrop.querySelector('#sky')).toBeTruthy()
  expect(panelOf(mounted(drawer({ title: 'Filters' }))).querySelector('.backdrop')).toEqual(null)
})

test('an open modal drawer holds the page scroll and inerts the page behind it', async () => {
  const { state, host } = withOpenState((open) => drawer({ title: 'Filters', open }))
  const outside = outsideButton()

  state.set(true)
  expect(panelOf(host).open).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('hidden')
  expect(takesFocus(outside)).toEqual(false)

  const shut = closed(host)
  state.set(false)
  await shut
  expect(panelOf(host).open).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(takesFocus(outside)).toEqual(true)
})

test('the drawer close button writes the state back and reports the change', async () => {
  const changes = []
  const { state, host } = withOpenState((open) =>
    drawer({
      title: 'Filters',
      open,
      events: { openToggle: (event) => changes.push(event.detail.open) },
    }),
  )
  state.set(true)
  click(closeButtonOf(host))
  expect(state.get()).toEqual(false)
  expect(changes).toEqual([false])
  await settled()
  expect(panelOf(host).open).toEqual(false)
})

test('escape and a backdrop click dismiss a modal drawer through the closing slide', async () => {
  const { state, host } = withOpenState((open) => drawer({ title: 'Filters', open }))
  state.set(true)
  const escaped = closed(host)
  press(panelOf(host), 'Escape')
  expect(panelOf(host).open).toEqual(true)
  await escaped
  expect(panelOf(host).open).toEqual(false)
  expect(state.get()).toEqual(false)

  state.set(true)
  const dismissed = closed(host)
  pointerDown(panelOf(host))
  click(panelOf(host))
  await dismissed
  expect(panelOf(host).open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('a non-modal drawer is a manual popover that hands focus back when it closes', async () => {
  const { state, host } = withOpenState((open) =>
    drawer({ title: 'Inspector', modal: false, open }),
  )
  const invoker = outsideButton()
  invoker.focus()

  state.set(true)
  const panel = panelOf(host)
  expect(panel.getAttribute('popover')).toEqual('manual')
  expect(panel.hasAttribute('data-modal')).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(invoker.inert).toEqual(false)
  expect(host.shadowRoot.activeElement).toEqual(panel)

  state.set(false)
  await settled()
  expect(document.activeElement).toEqual(invoker)
})

test('a drawer told to open at mount waits until it is in the document', async () => {
  const host = mounted(drawer({ title: 'Filters', open: true }))
  expect(panelOf(host).open).toEqual(false)
  await nextFrame()
  expect(panelOf(host).open).toEqual(true)
})

test('a drawer without a title is reported, and an unknown prop with it', () => {
  const warn = warnings()
  mounted(drawer({ heading: 'Filters' }))
  expect(warned(warn, "drawer: pass a 'title'")).toBeTruthy()
  expect(warned(warn, "drawer: unknown prop 'heading'")).toBeTruthy()
})

const refusals = () => {
  const asked = []
  return { asked, beforeClose: () => asked.push('asked') && false }
}

test('beforeClose returning false keeps a modal dialog open on every dismissal', async () => {
  const { asked, beforeClose } = refusals()
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open, beforeClose }))
  state.set(true)
  const panel = panelOf(host)

  press(panel, 'Escape')
  await settled()
  pointerDown(panel)
  click(panel)
  await settled()
  click(closeButtonOf(host))
  await settled()

  expect(asked).toEqual(['asked', 'asked', 'asked'])
  expect(panel.open).toEqual(true)
  expect(state.get()).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('hidden')
})

test('a cancel event that the browser forces closes the dialog and gives the page back', async () => {
  const { asked, beforeClose } = refusals()
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open, beforeClose }))
  state.set(true)
  const panel = panelOf(host)
  panel.dispatchEvent(new Event('cancel', { cancelable: true }))
  await settled()
  expect(panel.open).toEqual(true)

  const shut = closed(host)
  if (panel.dispatchEvent(new Event('cancel', { cancelable: false }))) panel.close()
  await shut
  expect(asked).toEqual(['asked'])
  expect(panel.open).toEqual(false)
  expect(state.get()).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
})

test('beforeClose can answer later, and the dialog closes when it allows', async () => {
  let answer = null
  const beforeClose = spy(() => new Promise((resolve) => (answer = resolve)))
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open, beforeClose }))
  state.set(true)
  const panel = panelOf(host)

  press(panel, 'Escape')
  press(panel, 'Escape')
  click(closeButtonOf(host))
  await settled()
  expect(beforeClose.calls.length).toEqual(1)
  expect(panel.open).toEqual(true)

  const shut = closed(host)
  answer(true)
  await shut
  expect(panel.open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('the app closing the dialog through open never asks beforeClose', async () => {
  const { asked, beforeClose } = refusals()
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open, beforeClose }))
  state.set(true)
  state.set(false)
  await settled()
  expect(asked).toEqual([])
  expect(panelOf(host).open).toEqual(false)
})

test('a beforeClose that throws keeps the dialog open and logs the error', async () => {
  const error = spy(console, 'error', () => {})
  const { state, host } = withOpenState((open) =>
    dialog({
      title: 'Edit user',
      open,
      beforeClose: () => {
        throw new Error('no draft store')
      },
    }),
  )
  state.set(true)
  press(panelOf(host), 'Escape')
  await settled()
  expect(panelOf(host).open).toEqual(true)
  expect(
    error.calls.some((call) => call.join(' ').includes('dialog: beforeClose failed')),
  ).toBeTruthy()
})

test('an escape that the content handles first does not dismiss the dialog', async () => {
  const field = document.createElement('input')
  field.addEventListener('keydown', (event) => event.preventDefault())
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }, field))
  state.set(true)
  press(field, 'Escape')
  await settled()
  expect(panelOf(host).open).toEqual(true)
  expect(state.get()).toEqual(true)
})

test('beforeClose guards the close button of a non-modal dialog', async () => {
  let allow = false
  const { state, host } = withOpenState((open) =>
    dialog({ title: 'Inspector', modal: false, open, beforeClose: () => allow }),
  )
  state.set(true)
  click(closeButtonOf(host))
  await settled()
  expect(state.get()).toEqual(true)

  allow = true
  click(closeButtonOf(host))
  await settled()
  expect(state.get()).toEqual(false)
})

test('beforeClose guards a modal drawer the same way', async () => {
  const { asked, beforeClose } = refusals()
  const { state, host } = withOpenState((open) => drawer({ title: 'Filters', open, beforeClose }))
  state.set(true)
  press(panelOf(host), 'Escape')
  await settled()
  click(closeButtonOf(host))
  await settled()
  expect(asked).toEqual(['asked', 'asked'])
  expect(panelOf(host).open).toEqual(true)
  expect(state.get()).toEqual(true)
})

test('a beforeClose that is not a function is reported and ignored', async () => {
  const warn = warnings()
  const { state, host } = withOpenState((open) =>
    dialog({ title: 'Edit user', open, beforeClose: true }),
  )
  expect(warned(warn, "dialog: 'beforeClose' must be a function")).toBeTruthy()
  state.set(true)
  click(closeButtonOf(host))
  expect(state.get()).toEqual(false)
  await settled()
})

test('escape in an open comboBox list closes the list and leaves the dialog open', async () => {
  const picker = comboBox({ ariaLabel: 'Country', options: 'Poland,Portugal' })
  const { state, host } = withOpenState((open) => dialog({ title: 'Edit user', open }, picker))
  state.set(true)
  const control = picker.shadowRoot.querySelector('#control')
  press(control, 'ArrowDown')
  expect(control.getAttribute('aria-expanded')).toEqual('true')

  press(control, 'Escape')
  await settled()
  expect(control.getAttribute('aria-expanded')).toEqual('false')
  expect(panelOf(host).open).toEqual(true)

  const shut = closed(host)
  press(control, 'Escape')
  await shut
  expect(panelOf(host).open).toEqual(false)
  expect(state.get()).toEqual(false)
})

test('a dialog with content builds it on each open and drops it once it closed', async () => {
  let builds = 0
  const { state, host } = withOpenState((open) =>
    dialog({
      title: 'Add people',
      open,
      content: () => {
        builds += 1
        return div({ class: 'fresh' }, `build ${builds}`)
      },
    }),
  )
  const body = () => host.shadowRoot.querySelector('.body')
  expect(builds).toEqual(0)
  expect(body().textContent).toEqual('')
  state.set(true)
  expect(body().textContent).toEqual('build 1')
  state.set(false)
  for (let wait = 0; wait < 50 && body().textContent !== ''; wait += 1) await nextFrame()
  expect(body().textContent).toEqual('')
  state.set(true)
  expect(body().textContent).toEqual('build 2')
})

test('a dialog with content and children warns and uses content', () => {
  const warn = warnings()
  const { host } = withOpenState((open) =>
    dialog({ title: 'Both', open, content: () => div('fresh') }, div('stale')),
  )
  expect(warned(warn, "not both - using 'content'")).toBeTruthy()
  expect(host.shadowRoot.querySelector('.body').textContent).toEqual('')
})
