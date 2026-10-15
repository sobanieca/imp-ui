import { component, mount } from 'imp'
import { splitPane } from 'imp/std/layout'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const stateHost = component('split-pane-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const handleOf = (host) => host.shadowRoot.querySelector('[role="separator"]')

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const nowOf = (host) => Number(handleOf(host).getAttribute('aria-valuenow'))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('splitPane renders two panes around a focusable separator with a value', () => {
  const host = mounted(splitPane('start', 'end'))
  expect(host.localName).toEqual('imp-split-pane')
  const panes = host.shadowRoot.querySelectorAll('.pane')
  expect(panes.length).toEqual(2)
  expect(panes[0].textContent).toEqual('start')
  expect(panes[1].textContent).toEqual('end')
  const handle = handleOf(host)
  expect(handle.getAttribute('tabindex')).toEqual('0')
  expect(handle.getAttribute('aria-orientation')).toEqual('vertical')
  expect(handle.getAttribute('aria-controls')).toEqual(panes[0].id)
  expect(handle.getAttribute('aria-valuenow')).toEqual('50')
  expect(handle.getAttribute('aria-valuemin')).toEqual('10')
  expect(handle.getAttribute('aria-valuemax')).toEqual('90')
})

test('the separator has a translated name, and label replaces it', () => {
  expect(handleOf(mounted(splitPane('a', 'b'))).getAttribute('aria-label')).toEqual(
    'Resize the panes',
  )
  expect(
    handleOf(mounted(splitPane({ label: 'Resize the list' }, 'a', 'b'))).getAttribute('aria-label'),
  ).toEqual('Resize the list')
})

test('a vertical split names a horizontal separator', () => {
  const host = mounted(splitPane({ orientation: 'vertical' }, 'a', 'b'))
  expect(handleOf(host).getAttribute('aria-orientation')).toEqual('horizontal')
  expect(host.shadowRoot.querySelector('.root').classList.contains('vertical')).toBeTruthy()
})

test('size sets the share of the start pane as grid tracks', () => {
  const host = mounted(splitPane({ size: 30 }, 'a', 'b'))
  const root = host.shadowRoot.querySelector('.root')
  expect(root.style.getPropertyValue('--split-start')).toEqual('30fr')
  expect(root.style.getPropertyValue('--split-end')).toEqual('70fr')
  expect(nowOf(host)).toEqual(30)
})

test('the arrow keys move the handle, and Home and End jump to the limits', () => {
  const host = mounted(splitPane({ min: 20, max: 80 }, 'a', 'b'))
  const handle = handleOf(host)
  press(handle, 'ArrowRight')
  expect(nowOf(host)).toEqual(55)
  press(handle, 'ArrowLeft')
  press(handle, 'ArrowLeft')
  expect(nowOf(host)).toEqual(45)
  press(handle, 'PageDown')
  expect(nowOf(host)).toEqual(70)
  press(handle, 'End')
  expect(nowOf(host)).toEqual(80)
  press(handle, 'ArrowRight')
  expect(nowOf(host)).toEqual(80)
  press(handle, 'Home')
  expect(nowOf(host)).toEqual(20)
  press(handle, 'PageUp')
  expect(nowOf(host)).toEqual(20)
})

test('a vertical split moves with ArrowUp and ArrowDown, and ignores the side keys', () => {
  const host = mounted(splitPane({ orientation: 'vertical' }, 'a', 'b'))
  const handle = handleOf(host)
  press(handle, 'ArrowDown')
  expect(nowOf(host)).toEqual(55)
  press(handle, 'ArrowUp')
  press(handle, 'ArrowUp')
  expect(nowOf(host)).toEqual(45)
  press(handle, 'ArrowRight')
  expect(nowOf(host)).toEqual(45)
})

test('in a right-to-left page the side keys mirror, so each key moves the handle toward its side', () => {
  const host = mounted(splitPane('a', 'b'))
  host.style.direction = 'rtl'
  const handle = handleOf(host)
  press(handle, 'ArrowLeft')
  expect(nowOf(host)).toEqual(55)
  press(handle, 'ArrowRight')
  press(handle, 'ArrowRight')
  expect(nowOf(host)).toEqual(45)
})

test('a key writes a writable size state back, and fires resize on the host', () => {
  let share
  const sizes = []
  const host = mounted(
    stateHost((self) => {
      share = initState(self, 'test.split', 40)
      return splitPane(
        {
          size: share,
          events: { resize: (event) => sizes.push(event.detail.size) },
        },
        'a',
        'b',
      )
    }),
  )
  const inner = host.shadowRoot.querySelector('imp-split-pane')
  press(handleOf(inner), 'ArrowRight')
  expect(share.get()).toEqual(45)
  expect(sizes).toEqual([45])
  share.set(20)
  expect(nowOf(inner)).toEqual(20)
  expect(sizes).toEqual([45])
})

test('splitPane warns about a bad child count, a bad percent and a min above max', () => {
  const warn = warnings()
  mounted(splitPane('only one'))
  expect(warned(warn, 'takes exactly two children')).toBeTruthy()
  mounted(splitPane({ size: 140 }, 'a', 'b'))
  expect(warned(warn, "'size' must be a percent from 0 to 100")).toBeTruthy()
  const host = mounted(splitPane({ min: 70, max: 30 }, 'a', 'b'))
  expect(warned(warn, "'min' 70 is above 'max' 30")).toBeTruthy()
  expect(nowOf(host)).toEqual(30)
})
