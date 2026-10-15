import { component, mount } from 'imp'
import { tree } from 'imp/std/data'
import { beforeEach, expect, spy, test } from 'imp/test'
import { initState } from 'imp/state'
import { renderedText } from './shadow.js'

const stateHost = component('tree-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const click = (node) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const folders = () => [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'main', label: 'main.js' },
      { id: 'lib', label: 'lib', children: [{ id: 'util', label: 'util.js' }] },
    ],
  },
  { id: 'docs', label: 'docs', children: [{ id: 'guide', label: 'guide.md' }] },
  { id: 'readme', label: 'README.md' },
]

const item = (host, label) =>
  all(host, '[role="treeitem"]').find(
    (node) => renderedText(node.querySelector('.label')) === label,
  )

const focused = (host) => renderedText(host.shadowRoot.activeElement.querySelector('.label'))

const tabStops = (host) =>
  all(host, '[role="treeitem"]')
    .filter((node) => node.tabIndex === 0)
    .map((node) => renderedText(node.querySelector('.label')))

beforeEach(() => {
  document.body.replaceChildren()
})

test('tree renders the tree pattern with nested groups and names from the labels', () => {
  const host = mounted(tree({ label: 'Folders', items: folders() }))
  expect(host.localName).toEqual('imp-tree')
  const root = shadow(host, '[role="tree"]')
  expect(root.getAttribute('aria-label')).toEqual('Folders')
  expect(all(host, '[role="treeitem"]').length).toEqual(7)
  const source = item(host, 'src')
  expect(source.parentNode).toEqual(root)
  expect(source.querySelector('[role="group"]').contains(item(host, 'main.js'))).toEqual(true)
  const label = shadow(host, `#${source.getAttribute('aria-labelledby')}`)
  expect(renderedText(label)).toEqual('src')
})

test('tree starts collapsed and binds aria-expanded to the hidden group', () => {
  const host = mounted(tree({ label: 'Folders', items: folders() }))
  const source = item(host, 'src')
  expect(source.getAttribute('aria-expanded')).toEqual('false')
  expect(source.querySelector('[role="group"]').hidden).toEqual(true)
  expect(item(host, 'README.md').hasAttribute('aria-expanded')).toEqual(false)
})

test('tree expands every parent for the plain value all', () => {
  const host = mounted(tree({ label: 'Folders', items: folders(), expanded: 'all' }))
  expect(all(host, '[aria-expanded]').map((node) => node.getAttribute('aria-expanded'))).toEqual([
    'true',
    'true',
    'true',
  ])
})

test('tree keeps one item in the tab order and starts on the selected one', () => {
  const plain = mounted(tree({ label: 'Folders', items: folders() }))
  expect(tabStops(plain)).toEqual(['src'])
  const chosen = mounted(
    tree({ label: 'Folders', items: folders(), expanded: ['src'], selected: 'main' }),
  )
  expect(tabStops(chosen)).toEqual(['main.js'])
  expect(item(chosen, 'main.js').getAttribute('aria-selected')).toEqual('true')
})

test('tree moves through the visible items with the arrow keys, Home and End', () => {
  const host = mounted(tree({ label: 'Folders', items: folders(), expanded: ['src'] }))
  item(host, 'src').focus()
  press(item(host, 'src'), 'ArrowDown')
  expect(focused(host)).toEqual('main.js')
  press(item(host, 'main.js'), 'ArrowDown')
  expect(focused(host)).toEqual('lib')
  press(item(host, 'lib'), 'ArrowDown')
  expect(focused(host)).toEqual('docs')
  press(item(host, 'docs'), 'ArrowUp')
  expect(focused(host)).toEqual('lib')
  press(item(host, 'lib'), 'End')
  expect(focused(host)).toEqual('README.md')
  press(item(host, 'README.md'), 'Home')
  expect(focused(host)).toEqual('src')
  expect(tabStops(host)).toEqual(['src'])
})

test('tree expands, enters, collapses and leaves with Right and Left', () => {
  const host = mounted(tree({ label: 'Folders', items: folders() }))
  const source = item(host, 'src')
  source.focus()
  press(source, 'ArrowRight')
  expect(source.getAttribute('aria-expanded')).toEqual('true')
  expect(focused(host)).toEqual('src')
  press(source, 'ArrowRight')
  expect(focused(host)).toEqual('main.js')
  press(item(host, 'main.js'), 'ArrowLeft')
  expect(focused(host)).toEqual('src')
  press(source, 'ArrowLeft')
  expect(source.getAttribute('aria-expanded')).toEqual('false')
  expect(source.querySelector('[role="group"]').hidden).toEqual(true)
})

test('tree mirrors Left and Right in a right-to-left page', () => {
  const host = mounted(tree({ label: 'Folders', items: folders() }))
  host.style.direction = 'rtl'
  const source = item(host, 'src')
  source.focus()
  press(source, 'ArrowRight')
  expect(source.getAttribute('aria-expanded')).toEqual('false')
  press(source, 'ArrowLeft')
  expect(source.getAttribute('aria-expanded')).toEqual('true')
  press(source, 'ArrowLeft')
  expect(focused(host)).toEqual('main.js')
  press(item(host, 'main.js'), 'ArrowRight')
  expect(focused(host)).toEqual('src')
})

test('tree selects with Enter and Space and reports select', () => {
  const chosen = []
  const host = mounted(
    tree({
      label: 'Folders',
      items: folders(),
      events: { select: (event) => chosen.push(event.detail.id) },
    }),
  )
  const readme = item(host, 'README.md')
  readme.focus()
  press(readme, 'Enter')
  expect(readme.getAttribute('aria-selected')).toEqual('true')
  const docs = item(host, 'docs')
  docs.focus()
  press(docs, ' ')
  expect(chosen).toEqual(['readme', 'docs'])
  expect(readme.getAttribute('aria-selected')).toEqual('false')
  expect(docs.getAttribute('aria-selected')).toEqual('true')
  expect(docs.getAttribute('aria-expanded')).toEqual('true')
})

test('tree moves to the next item that starts with a typed letter', () => {
  const host = mounted(tree({ label: 'Folders', items: folders(), expanded: ['src'] }))
  item(host, 'src').focus()
  press(item(host, 'src'), 'l')
  expect(focused(host)).toEqual('lib')
  press(item(host, 'lib'), 'R')
  expect(focused(host)).toEqual('README.md')
  press(item(host, 'README.md'), 'u')
  expect(focused(host)).toEqual('README.md')
})

test('tree selects on a click of the row and only folds on a click of the chevron', () => {
  const chosen = []
  const host = mounted(
    tree({
      label: 'Folders',
      items: folders(),
      events: { select: (event) => chosen.push(event.detail) },
    }),
  )
  const source = item(host, 'src')
  click(source.querySelector('.chevron-box'))
  expect(source.getAttribute('aria-expanded')).toEqual('true')
  expect(chosen).toEqual([])
  click(item(host, 'main.js').querySelector('.label'))
  expect(chosen).toEqual([{ id: 'main', item: folders()[0].children[0] }])
  expect(item(host, 'main.js').getAttribute('aria-selected')).toEqual('true')
  expect(source.getAttribute('aria-selected')).toEqual('false')
})

test('tree follows the selected and expanded states and writes them back', () => {
  let current
  let open
  const outer = mounted(
    stateHost((self) => {
      current = initState(self, 'test.tree.current', 'readme')
      open = initState(self, 'test.tree.open', [])
      return tree({ label: 'Folders', items: folders(), selected: current, expanded: open })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-tree')
  expect(item(host, 'README.md').getAttribute('aria-selected')).toEqual('true')
  open.set(['docs'])
  expect(item(host, 'docs').getAttribute('aria-expanded')).toEqual('true')
  const source = item(host, 'src')
  source.focus()
  press(source, 'ArrowRight')
  expect(open.get()).toEqual(['docs', 'src'])
  press(source, 'Enter')
  expect(current.get()).toEqual('src')
  current.set('guide')
  expect(item(host, 'guide.md').getAttribute('aria-selected')).toEqual('true')
  expect(source.getAttribute('aria-selected')).toEqual('false')
})

test('tree moves the focus to a parent that folds over it', () => {
  let open
  const outer = mounted(
    stateHost((self) => {
      open = initState(self, 'test.tree.fold', ['src'])
      return tree({ label: 'Folders', items: folders(), expanded: open })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-tree')
  item(host, 'main.js').focus()
  expect(tabStops(host)).toEqual(['main.js'])
  open.set([])
  expect(tabStops(host)).toEqual(['src'])
})

test('tree keeps the focus on the same id after a live update of the items', () => {
  let items
  const outer = mounted(
    stateHost((self) => {
      items = initState(self, 'test.tree.items', folders())
      return tree({ label: 'Folders', items, expanded: ['src'] })
    }),
  )
  const host = outer.shadowRoot.querySelector('imp-tree')
  item(host, 'main.js').focus()
  items.set((loaded) => [...loaded, { id: 'license', label: 'LICENSE' }])
  expect(all(host, '[role="treeitem"]').length).toEqual(8)
  expect(focused(host)).toEqual('main.js')
  expect(item(host, 'src').getAttribute('aria-expanded')).toEqual('true')
})

test('tree warns about a missing label, a bad item and a duplicate id', () => {
  const warn = warnings()
  const host = mounted(
    tree({
      items: [{ id: 'a', label: 'A' }, { label: 'no id' }, { id: 'a', label: 'Again' }],
      expanded: 'everything',
    }),
  )
  expect(warned(warn, `pass a 'label'`)).toEqual(true)
  expect(warned(warn, `not an object with an 'id' and a 'label'`)).toEqual(true)
  expect(warned(warn, `share the id 'a'`)).toEqual(true)
  expect(warned(warn, `'expanded' must be an array of ids, or 'all'`)).toEqual(true)
  expect(all(host, '[role="treeitem"]').length).toEqual(1)
})
