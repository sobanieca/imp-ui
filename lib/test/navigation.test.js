import { component, mount } from 'imp'
import { initState } from 'imp/state'
import { commandPalette, navMenu, tabs } from 'imp/std/navigation'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('navigation-state-host', { onMount: (_instance, render) => render() })

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
  const outer = mounted(stateHost(() => {
    openTab = initState('test.tabs.open', 'overview')
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

const paletteItems = () => [
  { id: 'button', group: 'general', label: 'button', href: '/general/button' },
  { id: 'text_field', group: 'inputs', label: 'text_field', href: '/inputs/text_field' },
  { id: 'select', group: 'inputs', label: 'select', description: 'a picker' },
]

const field = (host) => shadow(host, 'input')

const options = (host) => all(host, '[role="option"]')

const type = (host, value) => {
  const control = field(host)
  control.value = value
  control.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
  return options(host)
}

const pathOf = (option) => option.querySelector('.path').textContent

test('commandPalette renders a combobox over a labelled listbox', () => {
  const host = mounted(commandPalette({ label: 'Search components', items: paletteItems() }))
  expect(host.localName).toEqual('imp-command-palette')
  const control = field(host)
  expect(control.getAttribute('role')).toEqual('combobox')
  expect(control.getAttribute('aria-label')).toEqual('Search components')
  expect(control.getAttribute('aria-autocomplete')).toEqual('list')
  expect(control.getAttribute('aria-expanded')).toEqual('false')
  const listbox = shadow(host, '[role="listbox"]')
  expect(control.getAttribute('aria-controls')).toEqual(listbox.id)
  expect(listbox.getAttribute('aria-label')).toEqual('Search components')
})

test('commandPalette shows every item until a query narrows it', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  expect(options(host).map(pathOf)).toEqual([
    'general/button',
    'inputs/text_field',
    'inputs/select',
  ])
  expect(type(host, 'inp').map(pathOf)).toEqual(['inputs/text_field', 'inputs/select'])
})

test('commandPalette matches loosely and marks the characters it matched', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  const [first] = type(host, 'tf')
  expect(pathOf(first)).toEqual('inputs/text_field')
  expect([...first.querySelectorAll('mark')].map((node) => node.textContent)).toEqual(['t', 'f'])
})

test('commandPalette ranks a match on the label above one on the group', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  expect(type(host, 'sel').map(pathOf)[0]).toEqual('inputs/select')
  expect(type(host, 'ge').map(pathOf)[0]).toEqual('general/button')
})

test('commandPalette reports how many matches it is showing', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  const status = shadow(host, '[role="status"]')
  expect(status.textContent).toEqual('3 results')
  type(host, 'inp')
  expect(status.textContent).toEqual('2 results')
})

test('commandPalette says so when nothing matches', () => {
  const host = mounted(commandPalette({ items: paletteItems(), emptyMessage: 'Nothing here' }))
  expect(type(host, 'zzz').length).toEqual(0)
  expect(renderedText(shadow(host, '.empty'))).toEqual('Nothing here')
})

test('commandPalette highlights the first match and moves with the arrow keys', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  const control = field(host)
  const active = () =>
    options(host).findIndex((option) => option.getAttribute('aria-selected') === 'true')
  expect(active()).toEqual(0)
  expect(control.getAttribute('aria-activedescendant')).toEqual(options(host)[0].id)
  press(control, 'ArrowDown')
  expect(active()).toEqual(1)
  press(control, 'ArrowUp')
  press(control, 'ArrowUp')
  expect(active()).toEqual(2)
})

test('commandPalette opens the highlighted item on Enter', () => {
  const chosen = []
  const host = mounted(
    commandPalette({
      items: paletteItems(),
      events: { select: (event) => chosen.push(event.detail.id) && event.preventDefault() },
    }),
  )
  const control = field(host)
  control.dispatchEvent(new Event('focus'))
  press(control, 'ArrowDown')
  press(control, 'Enter')
  expect(chosen).toEqual(['text_field'])
  expect(control.getAttribute('aria-expanded')).toEqual('false')
})

test('commandPalette clears the query on Escape before it closes', () => {
  const host = mounted(commandPalette({ items: paletteItems() }))
  const control = field(host)
  control.dispatchEvent(new Event('focus'))
  type(host, 'inp')
  press(control, 'Escape')
  expect(control.value).toEqual('')
  expect(control.getAttribute('aria-expanded')).toEqual('true')
  press(control, 'Escape')
  expect(control.getAttribute('aria-expanded')).toEqual('false')
})

test('commandPalette skips an item that is disabled', () => {
  const chosen = []
  const host = mounted(
    commandPalette({
      items: [
        { id: 'save', label: 'Save' },
        { id: 'publish', label: 'Publish', disabled: true },
        { id: 'undo', label: 'Undo' },
      ],
      events: { select: (event) => chosen.push(event.detail.id) },
    }),
  )
  const control = field(host)
  expect(options(host)[1].getAttribute('aria-disabled')).toEqual('true')
  control.dispatchEvent(new Event('focus'))
  press(control, 'ArrowDown')
  press(control, 'Enter')
  expect(chosen).toEqual(['undo'])
})

test('commandPalette focuses itself on its shortcut and shows it as a hint', () => {
  const host = mounted(commandPalette({ items: paletteItems(), shortcut: 'ctrl+p' }))
  expect(renderedText(shadow(host, 'kbd'))).toEqual('Ctrl P')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
  expect(host.shadowRoot.activeElement).toEqual(field(host))
  expect(field(host).getAttribute('aria-expanded')).toEqual('true')
})

test('commandPalette warns about unknown props, a bad shortcut and an item without a label', () => {
  const warn = warnings()
  const host = mounted(
    commandPalette({
      items: [{ id: 'a', label: 'A' }, { id: 'b' }],
      shortcut: 'super+p',
      title: 'x',
    }),
  )
  expect(warned(warn, "unknown prop 'title'")).toBeTruthy()
  expect(warned(warn, "'shortcut' has no modifier 'super'")).toBeTruthy()
  expect(warned(warn, "an item is not an object with a 'label'")).toBeTruthy()
  expect(options(host).length).toEqual(1)
})

const menuItems = () => [
  { id: 'reports', group: 'work', label: 'Reports', href: '/reports', badge: 4 },
  { id: 'tasks', group: 'work', label: 'Tasks', href: '/tasks' },
  { id: 'settings', label: 'Settings', href: '/settings' },
]

const links = (host) => all(host, '.link')

test('navMenu renders a named nav landmark of links', () => {
  const host = mounted(navMenu({ label: 'Sections', items: menuItems() }))
  expect(host.localName).toEqual('imp-nav-menu')
  const root = shadow(host, 'nav')
  expect(root.getAttribute('aria-label')).toEqual('Sections')
  expect(links(host).map((link) => link.localName)).toEqual(['a', 'a', 'a'])
  expect(links(host).map((link) => link.getAttribute('href'))).toEqual([
    '/reports',
    '/tasks',
    '/settings',
  ])
  expect(renderedText(links(host)[0])).toEqual('Reports4')
})

test('navMenu labels each group through the list it names', () => {
  const host = mounted(
    navMenu({ groups: [{ id: 'work', label: 'Work', badge: 2 }], items: menuItems() }),
  )
  const title = shadow(host, '.group-title')
  expect(renderedText(title)).toEqual('Work2')
  expect(all(host, 'ul')[0].getAttribute('aria-labelledby')).toEqual(title.id)
  expect(all(host, 'ul')[1].getAttribute('aria-labelledby')).toEqual(null)
})

test('navMenu marks the selected item as the current page', () => {
  let openSection
  const outer = mounted(stateHost(() => {
    openSection = initState('test.menu.open', 'tasks')
    return navMenu({ selected: openSection, items: menuItems() })
  }))
  const host = outer.shadowRoot.querySelector('imp-nav-menu')
  expect(links(host).map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null])
  openSection.set('settings')
  expect(links(host).map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'page'])
})

test('navMenu reports a click as a cancelable select event', () => {
  const chosen = []
  const host = mounted(
    navMenu({
      items: menuItems(),
      events: {
        select: (event) => {
          event.preventDefault()
          chosen.push(event.detail.id)
        },
      },
    }),
  )
  click(links(host)[1])
  expect(chosen).toEqual(['tasks'])
})

test('navMenu renders a disabled item as an inert link', () => {
  const host = mounted(
    navMenu({ items: [{ id: 'audit', label: 'Audit', href: '/audit', disabled: true }] }),
  )
  const link = links(host)[0]
  expect(link.localName).toEqual('span')
  expect(link.getAttribute('role')).toEqual('link')
  expect(link.getAttribute('aria-disabled')).toEqual('true')
})

test('navMenu warns about unknown props, a bad group and an item without a label', () => {
  const warn = warnings()
  const host = mounted(navMenu({ items: [{ label: 'A' }, { id: 'b' }], groups: [{}], title: 'x' }))
  expect(warned(warn, "unknown prop 'title'")).toBeTruthy()
  expect(warned(warn, "a group is not an object with an 'id'")).toBeTruthy()
  expect(warned(warn, "an item is not an object with a 'label'")).toBeTruthy()
  expect(links(host).length).toEqual(1)
})
