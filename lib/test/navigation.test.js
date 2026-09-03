import { component, mount } from 'imp'
import { tabs } from 'imp/std/navigation'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('navigation-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const items = () => [
  { id: 'overview', label: 'Overview', content: 'the overview' },
  { id: 'usage', label: 'Usage', content: 'the usage' },
  { id: 'billing', label: 'Billing', content: 'the billing' },
]

beforeEach(() => {
  document.body.replaceChildren()
})

test('tabs renders a tablist of native buttons over labelled panels', () => {
  const host = mounted(tabs({ label: 'Account', items: items() }))
  expect(host.localName).toEqual('imp-tabs')
  const tablist = shadow(host, '[role="tablist"]')
  expect(tablist.getAttribute('aria-label')).toEqual('Account')
  expect(tablist.getAttribute('aria-orientation')).toEqual('horizontal')
  const buttons = all(host, '[role="tab"]')
  expect(buttons.length).toEqual(3)
  expect(buttons[0].localName).toEqual('button')
  expect(renderedText(buttons[0])).toEqual('Overview')
  const panels = all(host, '[role="tabpanel"]')
  expect(panels.length).toEqual(3)
  for (const [index, panel] of panels.entries()) {
    expect(buttons[index].getAttribute('aria-controls')).toEqual(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toEqual(buttons[index].id)
  }
})

test('tabs selects the first item and hides every other panel', () => {
  const host = mounted(tabs({ items: items() }))
  const buttons = all(host, '[role="tab"]')
  const panels = all(host, '[role="tabpanel"]')
  expect(buttons.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
    'true',
    'false',
    'false',
  ])
  expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true])
})

test('tabs keeps exactly one tab in the tab order', () => {
  const host = mounted(tabs({ items: items() }))
  expect(all(host, '[role="tab"]').map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
})

test('tabs selects on click and reports it as a select event', () => {
  const chosen = []
  const host = mounted(
    tabs({ items: items(), events: { select: (event) => chosen.push(event.detail) } }),
  )
  click(all(host, '[role="tab"]')[2])
  expect(chosen).toEqual([{ id: 'billing', index: 2 }])
  expect(all(host, '[role="tabpanel"]').map((panel) => panel.hidden)).toEqual([true, true, false])
  expect(all(host, '[role="tab"]').map((tab) => tab.tabIndex)).toEqual([-1, -1, 0])
})

test('tabs moves selection with the arrow keys and wraps around', () => {
  const host = mounted(tabs({ items: items() }))
  const tablist = shadow(host, '[role="tablist"]')
  press(tablist, 'ArrowRight')
  expect(all(host, '[role="tab"]')[1].getAttribute('aria-selected')).toEqual('true')
  press(tablist, 'ArrowLeft')
  expect(all(host, '[role="tab"]')[0].getAttribute('aria-selected')).toEqual('true')
  press(tablist, 'ArrowLeft')
  expect(all(host, '[role="tab"]')[2].getAttribute('aria-selected')).toEqual('true')
})

test('tabs jumps to the first and last item with Home and End', () => {
  const host = mounted(tabs({ items: items() }))
  const tablist = shadow(host, '[role="tablist"]')
  press(tablist, 'End')
  expect(all(host, '[role="tab"]')[2].getAttribute('aria-selected')).toEqual('true')
  press(tablist, 'Home')
  expect(all(host, '[role="tab"]')[0].getAttribute('aria-selected')).toEqual('true')
})

test('tabs uses the vertical arrow keys when it is vertical', () => {
  const host = mounted(tabs({ orientation: 'vertical', items: items() }))
  const tablist = shadow(host, '[role="tablist"]')
  expect(tablist.getAttribute('aria-orientation')).toEqual('vertical')
  press(tablist, 'ArrowRight')
  expect(all(host, '[role="tab"]')[0].getAttribute('aria-selected')).toEqual('true')
  press(tablist, 'ArrowDown')
  expect(all(host, '[role="tab"]')[1].getAttribute('aria-selected')).toEqual('true')
  press(tablist, 'ArrowUp')
  expect(all(host, '[role="tab"]')[0].getAttribute('aria-selected')).toEqual('true')
})

test('tabs skips a disabled item with the keyboard and with a click', () => {
  const host = mounted(
    tabs({
      items: [
        { id: 'a', label: 'A', content: 'a' },
        { id: 'b', label: 'B', content: 'b', disabled: true },
        { id: 'c', label: 'C', content: 'c' },
      ],
    }),
  )
  const buttons = all(host, '[role="tab"]')
  expect(buttons[1].disabled).toBeTruthy()
  press(shadow(host, '[role="tablist"]'), 'ArrowRight')
  expect(buttons[2].getAttribute('aria-selected')).toEqual('true')
  click(buttons[1])
  expect(buttons[2].getAttribute('aria-selected')).toEqual('true')
})

test('tabs starts on the first item that is not disabled', () => {
  const host = mounted(
    tabs({
      items: [
        { id: 'a', label: 'A', content: 'a', disabled: true },
        { id: 'b', label: 'B', content: 'b' },
      ],
    }),
  )
  expect(all(host, '[role="tab"]')[1].getAttribute('aria-selected')).toEqual('true')
})

test('tabs opens on the item named by selected', () => {
  const host = mounted(tabs({ selected: 'billing', items: items() }))
  expect(all(host, '[role="tab"]')[2].getAttribute('aria-selected')).toEqual('true')
})

test('tabs follows a selected state without reporting it back', () => {
  const chosen = []
  let openTab
  const outer = mounted(stateHost((self) => {
    openTab = initState(self, 'test.tabs.open', 'overview')
    return tabs({
      selected: openTab,
      items: items(),
      events: { select: (event) => chosen.push(event.detail.id) },
    })
  }))
  const host = outer.shadowRoot.querySelector('imp-tabs')
  openTab.set('usage')
  expect(all(host, '[role="tab"]')[1].getAttribute('aria-selected')).toEqual('true')
  expect(chosen).toEqual([])
})

test('tabs warns about a selected id that matches no item', () => {
  const warn = warnings()
  const host = mounted(tabs({ selected: 'nowhere', items: items() }))
  expect(warned(warn, "'selected' is 'nowhere'")).toBeTruthy()
  expect(all(host, '[role="tab"]')[0].getAttribute('aria-selected')).toEqual('true')
})

test('tabs warns about unknown props, a bad orientation and an item without a label', () => {
  const warn = warnings()
  const host = mounted(
    tabs({ items: [{ id: 'a', label: 'A' }, { id: 'b' }], orientation: 'sideways', title: 'x' }),
  )
  expect(warned(warn, "unknown prop 'title'")).toBeTruthy()
  expect(warned(warn, "'orientation' must be one of")).toBeTruthy()
  expect(warned(warn, "an item is not an object with a 'label'")).toBeTruthy()
  expect(all(host, '[role="tab"]').length).toEqual(1)
})

test('tabs warns when content is passed as children instead of items', () => {
  const warn = warnings()
  mounted(tabs({ items: items() }, 'stray'))
  expect(warned(warn, 'takes no content')).toBeTruthy()
})
