import { mount } from 'imp'
import {
  appShell,
  container,
  divider,
  grid,
  item,
  row,
  scrollArea,
  spacer,
  stack,
  toolbar,
} from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const root = (host) => inner(host, '.root')

const variable = (element, name) => element.style.getPropertyValue(name)

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('stack renders a root div carrying its children', () => {
  const host = mounted(stack('First', 'Second'))
  expect(host.localName).toEqual('imp-stack')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('FirstSecond')
})

test('stack and row are the same component with opposite default directions', () => {
  expect(mounted(stack()).localName).toEqual('imp-stack')
  expect(mounted(row()).localName).toEqual('imp-row')
  expect(variable(root(mounted(stack())), '--direction-xs')).toEqual('')
  expect(variable(root(mounted(row())), '--direction-xs')).toEqual('')
})

test('a plain prop value is written to the xs breakpoint and inherited upward', () => {
  const element = root(mounted(stack({ direction: 'row' })))
  expect(variable(element, '--direction-xs')).toEqual('row')
  expect(variable(element, '--direction-sm')).toEqual('row')
  expect(variable(element, '--direction-xl')).toEqual('row')
})

test('a per-breakpoint object fills forward from each breakpoint it names', () => {
  const element = root(mounted(stack({ direction: { xs: 'column', md: 'row' } })))
  expect(variable(element, '--direction-xs')).toEqual('column')
  expect(variable(element, '--direction-sm')).toEqual('column')
  expect(variable(element, '--direction-md')).toEqual('row')
  expect(variable(element, '--direction-lg')).toEqual('row')
  expect(variable(element, '--direction-xl')).toEqual('row')
})

test('a breakpoint object that skips xs leaves the narrow end unset', () => {
  const element = root(mounted(stack({ direction: { md: 'row' } })))
  expect(variable(element, '--direction-xs')).toEqual('')
  expect(variable(element, '--direction-sm')).toEqual('')
  expect(variable(element, '--direction-md')).toEqual('row')
})

test('gap resolves to a spacing token from the theme scale', () => {
  const element = root(mounted(stack({ gap: 5 })))
  expect(variable(element, '--gap-xs')).toEqual('var(--imp-space-5, 24px)')
})

test('a gap of zero resolves to no space rather than a token', () => {
  expect(variable(root(mounted(stack({ gap: 0 }))), '--gap-xs')).toEqual('0px')
})

test('a gap given in pixels is logged and falls back to the default step', () => {
  const warn = warnings()
  const element = root(mounted(stack({ gap: '16px' })))
  expect(warned(warn, "'gap'")).toBeTruthy()
  expect(variable(element, '--gap-xs')).toEqual('var(--imp-space-3, 12px)')
})

test('justify and align map friendly names onto flex values', () => {
  const element = root(mounted(row({ justify: 'between', align: 'center' })))
  expect(variable(element, '--justify-xs')).toEqual('space-between')
  expect(variable(element, '--align-xs')).toEqual('center')
})

test('an invalid value at one breakpoint is ignored and the one below it carries on', () => {
  const warn = warnings()
  const element = root(mounted(stack({ direction: { xs: 'row', md: 'sideways' } })))
  expect(warned(warn, "'direction'")).toBeTruthy()
  expect(variable(element, '--direction-md')).toEqual('row')
})

test('an unknown breakpoint key is logged', () => {
  const warn = warnings()
  mounted(stack({ gap: { xs: 2, tablet: 4 } }))
  expect(warned(warn, "no breakpoint 'tablet'")).toBeTruthy()
})

test('hideBelow hides the narrow breakpoints and leaves the rest to the default', () => {
  const element = root(mounted(stack({ hideBelow: 'md' })))
  expect(variable(element, '--display-xs')).toEqual('none')
  expect(variable(element, '--display-sm')).toEqual('none')
  expect(variable(element, '--display-md')).toEqual('')
  expect(variable(element, '--display-xl')).toEqual('')
})

test('hideAbove hides from its breakpoint upward', () => {
  const element = root(mounted(stack({ hideAbove: 'lg' })))
  expect(variable(element, '--display-md')).toEqual('')
  expect(variable(element, '--display-lg')).toEqual('none')
  expect(variable(element, '--display-xl')).toEqual('none')
})

test('a hide range that can never show anything is logged', () => {
  const warn = warnings()
  mounted(stack({ hideBelow: 'lg', hideAbove: 'sm' }))
  expect(warned(warn, 'nothing will ever show')).toBeTruthy()
})

test('an unknown layout prop is logged and the component still renders', () => {
  const warn = warnings()
  const host = mounted(stack({ grow: true }, 'Content'))
  expect(warned(warn, "unknown prop 'grow'")).toBeTruthy()
  expect(renderedText(host)).toEqual('Content')
})

test('the resolved variables actually drive the rendered layout', () => {
  const styled = getComputedStyle(root(mounted(stack({ direction: 'row', gap: 5 }))))
  expect(styled.display).toEqual('flex')
  expect(styled.flexDirection).toEqual('row')
  expect(styled.gap).toEqual('24px')
})

test('an untouched stack falls back to a column with the default gap', () => {
  const styled = getComputedStyle(root(mounted(stack())))
  expect(styled.flexDirection).toEqual('column')
  expect(styled.gap).toEqual('12px')
})

test('a layout host generates no box of its own, so its root is the flex item', () => {
  expect(getComputedStyle(mounted(stack())).display).toEqual('contents')
})

test('grid turns a column count into equal tracks', () => {
  expect(variable(root(mounted(grid({ columns: 3 }))), '--columns-xs')).toEqual(
    'repeat(3, minmax(0, 1fr))',
  )
})

test('grid columns change per breakpoint', () => {
  const element = root(mounted(grid({ columns: { xs: 1, lg: 4 } })))
  expect(variable(element, '--columns-xs')).toEqual('repeat(1, minmax(0, 1fr))')
  expect(variable(element, '--columns-lg')).toEqual('repeat(4, minmax(0, 1fr))')
})

test('minItemWidth builds an auto-fitting track list', () => {
  expect(variable(root(mounted(grid({ minItemWidth: '16rem' }))), '--columns-xs')).toEqual(
    'repeat(auto-fit, minmax(min(16rem, 100%), 1fr))',
  )
})

test('minItemWidth wins over columns and says so', () => {
  const warn = warnings()
  const element = root(mounted(grid({ columns: 3, minItemWidth: '16rem' })))
  expect(warned(warn, "'minItemWidth' and 'columns'")).toBeTruthy()
  expect(variable(element, '--columns-xs')).toContain('auto-fit')
})

test('a column count outside the grid is logged and falls back to one column', () => {
  const warn = warnings()
  const element = root(mounted(grid({ columns: 40 })))
  expect(warned(warn, "'columns'")).toBeTruthy()
  expect(variable(element, '--columns-xs')).toEqual('repeat(1, minmax(0, 1fr))')
})

test('item spans grid columns and can span the full row', () => {
  expect(variable(root(mounted(item({ span: 8 }))), '--span-xs')).toEqual('span 8')
  expect(variable(root(mounted(item({ span: 'full' }))), '--span-xs')).toEqual('1 / -1')
})

test('item grow becomes a flex shorthand, weighted when a number is given', () => {
  expect(variable(root(mounted(item({ grow: true }))), '--flex-xs')).toEqual('1 1 0')
  expect(variable(root(mounted(item({ grow: 3 }))), '--flex-xs')).toEqual('3 1 0')
  expect(variable(root(mounted(item({ grow: false }))), '--flex-xs')).toEqual('0 1 auto')
})

test('item start pins a column and order accepts negatives', () => {
  expect(variable(root(mounted(item({ start: 3 }))), '--start-xs')).toEqual('3')
  expect(variable(root(mounted(item({ order: -1 }))), '--order-xs')).toEqual('-1')
})

test('item order can differ per breakpoint', () => {
  const element = root(mounted(item({ order: { xs: 1, md: 0 } })))
  expect(variable(element, '--order-xs')).toEqual('1')
  expect(variable(element, '--order-md')).toEqual('0')
})

test('container caps its width with a theme token', () => {
  expect(variable(root(mounted(container())), '--size-xs')).toEqual('')
  expect(variable(root(mounted(container({ size: 'sm' }))), '--size-xs')).toEqual(
    'var(--imp-container-sm, 40rem)',
  )
  expect(variable(root(mounted(container({ size: 'full' }))), '--size-xs')).toEqual('none')
})

test('a container size given as a width is logged and falls back', () => {
  const warn = warnings()
  const element = root(mounted(container({ size: '900px' })))
  expect(warned(warn, "'size'")).toBeTruthy()
  expect(variable(element, '--size-xs')).toEqual('var(--imp-container-lg, 64rem)')
})

test('spacer absorbs the leftover space until it is given a size', () => {
  expect(variable(root(mounted(spacer())), '--flex-xs')).toEqual('')
  expect(variable(root(mounted(spacer({ size: 6 }))), '--flex-xs')).toEqual(
    '0 0 var(--imp-space-6, 32px)',
  )
})

test('spacer is hidden from assistive technology and ignores content', () => {
  const warn = warnings()
  const host = mounted(spacer('Oops'))
  expect(root(host).getAttribute('aria-hidden')).toEqual('true')
  expect(warned(warn, 'takes no content')).toBeTruthy()
  expect(renderedText(host)).toEqual('')
})

test('a plain divider renders a real hr', () => {
  const host = mounted(divider())
  const rule = inner(host, 'hr')
  expect(rule.localName).toEqual('hr')
  expect(rule.getAttribute('aria-orientation')).toEqual('horizontal')
})

test('a vertical divider marks its orientation', () => {
  const rule = inner(mounted(divider({ orientation: 'vertical' })), 'hr')
  expect(rule.getAttribute('class')).toContain('vertical')
  expect(rule.getAttribute('aria-orientation')).toEqual('vertical')
})

test('a labelled divider is a separator carrying its label', () => {
  const host = mounted(divider('or'))
  const separator = inner(host, '[role="separator"]')
  expect(separator.getAttribute('aria-orientation')).toEqual('horizontal')
  expect(renderedText(host)).toEqual('or')
})

test('a vertical divider drops a label it cannot show', () => {
  const warn = warnings()
  const host = mounted(divider({ orientation: 'vertical' }, 'or'))
  expect(warned(warn, 'carries no label')).toBeTruthy()
  expect(renderedText(host)).toEqual('')
})

test('divider spacing runs along the block axis when horizontal', () => {
  expect(variable(inner(mounted(divider({ spacing: 2 })), 'hr'), '--spacing-xs')).toEqual(
    'var(--imp-space-2, 8px)',
  )
})

test('scrollArea is keyboard focusable and scrolls down the block axis by default', () => {
  const element = root(mounted(scrollArea('Content')))
  expect(element.getAttribute('tabindex')).toEqual('0')
  expect(element.getAttribute('class')).toContain('vertical')
})

test('a labelled scrollArea is a named region', () => {
  const element = root(mounted(scrollArea({ label: 'Activity' }, 'Content')))
  expect(element.getAttribute('role')).toEqual('region')
  expect(element.getAttribute('aria-label')).toEqual('Activity')
})

test('an unlabelled scrollArea claims no region role', () => {
  expect(root(mounted(scrollArea('Content'))).getAttribute('role')).toEqual(null)
})

test('scrollArea bounds take CSS lengths, per breakpoint', () => {
  const element = root(mounted(scrollArea({ maxHeight: { xs: '8rem', lg: '20rem' } })))
  expect(variable(element, '--maxblock-xs')).toEqual('8rem')
  expect(variable(element, '--maxblock-lg')).toEqual('20rem')
})

test('a scrollArea bound given as a number is logged and ignored', () => {
  const warn = warnings()
  const element = root(mounted(scrollArea({ maxHeight: 24 })))
  expect(warned(warn, "'maxHeight'")).toBeTruthy()
  expect(variable(element, '--maxblock-xs')).toEqual('')
})

test('an out-of-range scroll axis is logged and falls back to vertical', () => {
  const warn = warnings()
  const element = root(mounted(scrollArea({ axis: 'diagonal' })))
  expect(warned(warn, "'axis'")).toBeTruthy()
  expect(element.getAttribute('class')).toContain('vertical')
})

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

test('toolbar renders a named toolbar landmark carrying its controls', () => {
  const host = mounted(toolbar({ label: 'Document actions' }, 'Undo', 'Redo'))
  expect(host.localName).toEqual('imp-toolbar')
  const element = root(host)
  expect(element.getAttribute('role')).toEqual('toolbar')
  expect(element.getAttribute('aria-label')).toEqual('Document actions')
  expect(element.getAttribute('aria-orientation')).toEqual('horizontal')
  expect(renderedText(host)).toEqual('UndoRedo')
})

test('toolbar reports its orientation to assistive technology', () => {
  const host = mounted(toolbar({ label: 'Tools', orientation: 'vertical' }))
  expect(root(host).getAttribute('aria-orientation')).toEqual('vertical')
  expect(root(host).classList.contains('vertical')).toBeTruthy()
})

test('toolbar warns when it has no accessible name', () => {
  const warn = warnings()
  mounted(toolbar('Undo'))
  expect(warned(warn, "needs a 'label'")).toBeTruthy()
})

const shellSidebar = () =>
  navMenu({ label: 'Sections', items: [{ id: 'a', label: 'A', href: '/a' }] })

const region = (host, selector) => inner(host, selector)

test('appShell renders its regions as landmarks with the children in main', () => {
  const host = mounted(
    appShell(
      { header: 'the header', sidebar: 'the sidebar', footer: 'the footer', bottomBar: 'the bar' },
      'the page',
    ),
  )
  expect(host.localName).toEqual('imp-app-shell')
  expect(region(host, 'header').localName).toEqual('header')
  expect(region(host, 'aside').localName).toEqual('aside')
  expect(region(host, 'footer').localName).toEqual('footer')
  expect(renderedText(region(host, 'main'))).toEqual('the page')
  expect(renderedText(region(host, '.bottom'))).toEqual('the bar')
})

test('appShell leaves out every region it was not given', () => {
  const host = mounted(appShell('only the page'))
  expect(region(host, 'header')).toEqual(null)
  expect(region(host, 'aside')).toEqual(null)
  expect(region(host, 'footer')).toEqual(null)
  expect(region(host, '.menu')).toEqual(null)
  expect(renderedText(region(host, 'main'))).toEqual('only the page')
})

test('appShell renders a named menu button wired to the sidebar it opens', () => {
  const host = mounted(appShell({ sidebar: shellSidebar() }, 'the page'))
  const menu = region(host, '.menu')
  expect(menu.localName).toEqual('button')
  expect(menu.getAttribute('aria-label')).toEqual('Menu')
  expect(menu.getAttribute('aria-expanded')).toEqual('false')
  expect(menu.getAttribute('aria-controls')).toEqual(region(host, 'aside').id)
})

test('appShell opens the sidebar over the page and takes the rest out of the tree', () => {
  const host = mounted(appShell({ sidebar: shellSidebar(), menuLabel: 'Sections' }, 'the page'))
  const menu = region(host, '.menu')
  expect(menu.getAttribute('aria-label')).toEqual('Sections')
  menu.click()
  expect(menu.getAttribute('aria-expanded')).toEqual('true')
  expect(root(host).classList.contains('is-open')).toBeTruthy()
  expect(region(host, 'main').inert).toBeTruthy()
  expect(host.shadowRoot.activeElement).toEqual(region(host, 'aside'))
  press(region(host, 'aside'), 'Escape')
  expect(menu.getAttribute('aria-expanded')).toEqual('false')
  expect(region(host, 'main').inert).toEqual(false)
  expect(host.shadowRoot.activeElement).toEqual(menu)
})

test('appShell closes the open sidebar when something inside it is chosen', () => {
  const host = mounted(appShell({ sidebar: shellSidebar() }, 'the page'))
  region(host, '.menu').click()
  region(host, 'aside').dispatchEvent(
    new CustomEvent('select', { bubbles: true, composed: true, detail: { id: 'a' } }),
  )
  expect(root(host).classList.contains('is-open')).toEqual(false)
})

test('appShell keeps the sidebar docked when the collapse is turned off', () => {
  const host = mounted(appShell({ sidebar: shellSidebar(), collapseBelow: null }, 'the page'))
  expect(region(host, '.menu')).toEqual(null)
  expect(region(host, '.backdrop')).toEqual(null)
  expect(variable(root(host), '--sidebardisplay-xs')).toEqual('')
})

test('appShell hides the sidebar below the breakpoint it collapses at', () => {
  const host = mounted(appShell({ sidebar: shellSidebar(), collapseBelow: 'lg' }, 'the page'))
  const element = root(host)
  expect(variable(element, '--sidebardisplay-sm')).toEqual('none')
  expect(variable(element, '--sidebardisplay-lg')).toEqual('block')
  expect(variable(element, '--sidebarposition-sm')).toEqual('fixed')
  expect(variable(element, '--sidebarposition-lg')).toEqual('static')
  expect(variable(element, '--menudisplay-md')).toEqual('inline-flex')
  expect(variable(element, '--menudisplay-lg')).toEqual('none')
})

test('appShell takes its sidebar width from the theme', () => {
  const host = mounted(appShell({ sidebar: shellSidebar(), sidebarWidth: 'lg' }, 'the page'))
  expect(variable(region(host, 'aside'), '--sidebar-inline-size'))
    .toEqual('var(--imp-sidebar-lg, 20rem)')
})

test('appShell warns about unknown props, a bad width and a collapse with no sidebar', () => {
  const warn = warnings()
  mounted(appShell({ sidebarWidth: 'huge', collapseBelow: 'md', title: 'x' }, 'the page'))
  expect(warned(warn, "unknown prop 'title'")).toBeTruthy()
  expect(warned(warn, "'sidebarWidth' must be one of")).toBeTruthy()
  expect(warned(warn, "'collapseBelow' only does something together with a 'sidebar'")).toBeTruthy()
})
