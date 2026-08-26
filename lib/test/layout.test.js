import { mount } from 'imp'
import { app, footer, grid, navbar, page, section, sidebar, stack } from 'imp/std/layout'
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

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

beforeEach(() => {
  document.body.replaceChildren()
})

test('stack renders a root div carrying its children', () => {
  const host = mounted(stack('First', 'Second'))
  expect(host.localName).toEqual('imp-stack')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('FirstSecond')
})

test('stack renders its own element and lays its children down the block axis', () => {
  const host = mounted(stack('First', 'Second'))
  expect(host.localName).toEqual('imp-stack')
  expect(getComputedStyle(root(host)).flexDirection).toEqual('column')
})

test('direction turns a stack into a row', () => {
  const element = root(mounted(stack({ direction: 'row' })))
  expect(variable(element, '--direction-mobile')).toEqual('row')
  expect(variable(element, '--direction-desktop')).toEqual('row')
})

test('a direction given per stop is a column on mobile and a row on desktop', () => {
  const element = root(mounted(stack({ direction: { mobile: 'column', desktop: 'row' } })))
  expect(variable(element, '--direction-mobile')).toEqual('column')
  expect(variable(element, '--direction-desktop')).toEqual('row')
})

test('a reversed direction is logged and ignored', () => {
  const warn = warnings()
  const element = root(mounted(stack({ direction: 'row-reverse' })))
  expect(warned(warn, "'direction'")).toBeTruthy()
  expect(variable(element, '--direction-mobile')).toEqual('')
})

test('a plain prop value is written to the mobile stop and inherited upward', () => {
  const element = root(mounted(stack({ direction: 'row', justify: 'center' })))
  expect(variable(element, '--justify-mobile')).toEqual('center')
  expect(variable(element, '--justify-desktop')).toEqual('center')
})

test('a per-stop object fills forward from each stop it names', () => {
  const element = root(
    mounted(stack({ direction: 'row', justify: { mobile: 'center', desktop: 'between' } })),
  )
  expect(variable(element, '--justify-mobile')).toEqual('center')
  expect(variable(element, '--justify-desktop')).toEqual('space-between')
})

test('a stop object that skips mobile leaves the mobile end unset', () => {
  const element = root(mounted(stack({ direction: 'row', justify: { desktop: 'center' } })))
  expect(variable(element, '--justify-mobile')).toEqual('')
  expect(variable(element, '--justify-desktop')).toEqual('center')
})

test('gap resolves to a spacing token from the theme scale', () => {
  const element = root(mounted(stack({ direction: 'row', gap: 5 })))
  expect(variable(element, '--gap-mobile')).toContain('var(--imp-space-5,')
})

test('a gap of zero resolves to no space rather than a token', () => {
  expect(variable(root(mounted(stack({ direction: 'row', gap: 0 }))), '--gap-mobile')).toEqual(
    '0px',
  )
})

test('a gap given in pixels is logged and falls back to the default step', () => {
  const warn = warnings()
  const element = root(mounted(stack({ direction: 'row', gap: '16px' })))
  expect(warned(warn, "'gap'")).toBeTruthy()
  expect(variable(element, '--gap-mobile')).toContain('var(--imp-space-4,')
})

test('justify and align map friendly names onto flex values', () => {
  const element = root(mounted(stack({ direction: 'row', justify: 'between', align: 'center' })))
  expect(variable(element, '--justify-mobile')).toEqual('space-between')
  expect(variable(element, '--align-mobile')).toEqual('center')
})

test('grow becomes a flex shorthand, weighted when a number is given', () => {
  expect(variable(root(mounted(stack({ direction: 'row', grow: true }))), '--grow-mobile')).toEqual(
    '1 1 0',
  )
  expect(variable(root(mounted(stack({ direction: 'row', grow: 3 }))), '--grow-mobile')).toEqual(
    '3 1 0',
  )
  expect(variable(root(mounted(stack({ direction: 'row', grow: false }))), '--grow-mobile'))
    .toEqual('0 1 auto')
})

test('a grow that is not a number is logged and ignored', () => {
  const warn = warnings()
  const element = root(mounted(stack({ direction: 'row', grow: 'yes' })))
  expect(warned(warn, "'grow'")).toBeTruthy()
  expect(variable(element, '--grow-mobile')).toEqual('')
})

test('scroll turns the box into its own scroll container', () => {
  expect(root(mounted(stack({ direction: 'row', scroll: true }))).classList.contains('scroll'))
    .toBeTruthy()
  expect(root(mounted(stack({ direction: 'row' }))).classList.contains('scroll')).toEqual(false)
})

test('an invalid value at one stop is ignored and the one below it carries on', () => {
  const warn = warnings()
  const element = root(
    mounted(stack({ direction: 'row', maxWidth: { mobile: '20rem', desktop: 4 } })),
  )
  expect(warned(warn, "'maxWidth'")).toBeTruthy()
  expect(variable(element, '--max-width-desktop')).toEqual('20rem')
})

test('an unknown stop key is logged', () => {
  const warn = warnings()
  mounted(stack({ direction: 'row', gap: { mobile: 2, tablet: 4 } }))
  expect(warned(warn, "no breakpoint 'tablet'")).toBeTruthy()
})

test('hideOnMobile hides the narrow stop and leaves the wide one to the default', () => {
  const element = root(mounted(stack({ direction: 'row', hideOnMobile: true })))
  expect(variable(element, '--display-mobile')).toEqual('none')
  expect(variable(element, '--display-desktop')).toEqual('')
})

test('hideOnDesktop hides the wide stop only', () => {
  const element = root(mounted(stack({ direction: 'row', hideOnDesktop: true })))
  expect(variable(element, '--display-mobile')).toEqual('')
  expect(variable(element, '--display-desktop')).toEqual('none')
})

test('hiding at both stops is logged as never showing', () => {
  const warn = warnings()
  mounted(stack({ direction: 'row', hideOnMobile: true, hideOnDesktop: true }))
  expect(warned(warn, 'it will never show')).toBeTruthy()
})

test('an unknown layout prop is logged and the component still renders', () => {
  const warn = warnings()
  const host = mounted(stack({ direction: 'row', span: 4 }, 'Content'))
  expect(warned(warn, "unknown prop 'span'")).toBeTruthy()
  expect(renderedText(host)).toEqual('Content')
})

test('the resolved variables actually drive the rendered layout', () => {
  const element = root(mounted(stack({ gap: 0, align: 'center' })))
  expect(getComputedStyle(element).display).toEqual('flex')
  expect(getComputedStyle(element).flexDirection).toEqual('column')
  expect(variable(element, '--gap-mobile')).toEqual('0px')
  expect(variable(element, '--align-mobile')).toEqual('center')
})

test('an untouched stack is a wrapping column with the theme gap', () => {
  const styled = getComputedStyle(root(mounted(stack())))
  expect(styled.flexDirection).toEqual('column')
  expect(styled.flexWrap).toEqual('wrap')
  expect(styled.alignItems).toEqual('stretch')
})

test("a nested layout keeps its own defaults instead of inheriting its parent's", () => {
  const child = stack({ direction: 'row' })
  mounted(stack({ gap: 0, align: 'center' }, child))
  const styled = getComputedStyle(root(child))
  expect(styled.flexDirection).toEqual('row')
  expect(styled.alignItems).toEqual('stretch')
  expect(styled.gap).not.toEqual('0px')
})

test('a layout host generates no box of its own, so its root is the flex item', () => {
  expect(getComputedStyle(mounted(stack({ direction: 'row' }))).display).toEqual('contents')
})

test('grid turns a column count into equal tracks', () => {
  expect(variable(root(mounted(grid({ columns: 3 }))), '--columns-mobile')).toEqual(
    'repeat(3, minmax(0, 1fr))',
  )
})

test('grid columns change per breakpoint', () => {
  const element = root(mounted(grid({ columns: { mobile: 1, desktop: 4 } })))
  expect(variable(element, '--columns-mobile')).toEqual('repeat(1, minmax(0, 1fr))')
  expect(variable(element, '--columns-desktop')).toEqual('repeat(4, minmax(0, 1fr))')
})

test('minItemWidth builds an auto-fitting track list', () => {
  expect(variable(root(mounted(grid({ minItemWidth: '16rem' }))), '--columns-mobile')).toEqual(
    'repeat(auto-fit, minmax(min(16rem, 100%), 1fr))',
  )
})

test('minItemWidth wins over columns and says so', () => {
  const warn = warnings()
  const element = root(mounted(grid({ columns: 3, minItemWidth: '16rem' })))
  expect(warned(warn, "'minItemWidth' and 'columns'")).toBeTruthy()
  expect(variable(element, '--columns-mobile')).toContain('auto-fit')
})

test('a column count outside the grid is logged and falls back to one column', () => {
  const warn = warnings()
  const element = root(mounted(grid({ columns: 40 })))
  expect(warned(warn, "'columns'")).toBeTruthy()
  expect(variable(element, '--columns-mobile')).toEqual('repeat(1, minmax(0, 1fr))')
})

test('navbar is a banner landmark laid out as a row', () => {
  const host = mounted(navbar({ label: 'Top bar' }, 'Brand'))
  expect(host.localName).toEqual('imp-navbar')
  expect(root(host).localName).toEqual('header')
  expect(root(host).getAttribute('aria-label')).toEqual('Top bar')
  expect(renderedText(host)).toEqual('Brand')
})

test('footer is a contentinfo landmark laid out as a row', () => {
  const host = mounted(footer({ label: 'Page footer' }, 'Acme'))
  expect(host.localName).toEqual('imp-footer')
  expect(root(host).localName).toEqual('footer')
  expect(root(host).getAttribute('aria-label')).toEqual('Page footer')
})

test('the bars take the same responsive layout props as flex', () => {
  const element = root(
    mounted(navbar({ label: 'Top bar', justify: 'between', gap: { desktop: 5 } })),
  )
  expect(variable(element, '--justify-mobile')).toEqual('space-between')
  expect(variable(element, '--gap-desktop')).toContain('var(--imp-space-5,')
})

const sections = () => navMenu({ label: 'Sections', items: [{ id: 'a', label: 'A', href: '/a' }] })

test('app renders every region it is given and puts the rest in main', () => {
  const host = mounted(
    app(
      navbar({ label: 'Top bar' }, 'the header'),
      sidebar({ side: 'left', label: 'Sections' }, 'the sidebar'),
      footer({ label: 'Page footer' }, 'the footer'),
      'the page',
    ),
  )
  expect(host.localName).toEqual('imp-app')
  expect(inner(host, 'imp-navbar')).toBeTruthy()
  expect(inner(host, 'imp-sidebar')).toBeTruthy()
  expect(inner(host, 'imp-footer')).toBeTruthy()
  expect(renderedText(inner(host, 'main'))).toEqual('the page')
})

test('app with nothing but content renders only the main region', () => {
  const host = mounted(app('only the page'))
  expect(inner(host, 'imp-navbar')).toEqual(null)
  expect(inner(host, 'imp-sidebar')).toEqual(null)
  expect(inner(host, 'imp-footer')).toEqual(null)
  expect(renderedText(inner(host, 'main'))).toEqual('only the page')
})

test('app orders the sidebars outward from the main region on each side', () => {
  const host = mounted(
    app(
      sidebar({ side: 'right', label: 'Activity' }, 'right one'),
      sidebar({ side: 'left', label: 'Sections' }, 'left one'),
      sidebar({ side: 'left', label: 'Filters' }, 'left two'),
      'the page',
    ),
  )
  const body = [...inner(host, '.body').children].map((child) => child.localName)
  expect(body).toEqual(['imp-sidebar', 'imp-sidebar', 'main', 'imp-sidebar'])
  const sidebars = [...host.shadowRoot.querySelectorAll('imp-sidebar')]
  expect(sidebars.map((bar) => bar.getAttribute('side'))).toEqual(['left', 'left', 'right'])
  expect(sidebars.map((bar) => bar.style.getPropertyValue('--sidebar-tab'))).toEqual([
    '0',
    '1',
    '0',
  ])
})

test('a sidebar that is not a direct child of app stays in the main region', () => {
  const host = mounted(app(stack(sidebar({ label: 'Sections' }, 'nested')), 'the page'))
  expect(inner(host, '.body > imp-sidebar')).toEqual(null)
  const wrapper = inner(host, 'main imp-stack')
  expect(wrapper).toBeTruthy()
  expect(inner(wrapper, 'imp-sidebar')).toBeTruthy()
})

test('app caps and centres the main region when it is given a maxWidth', () => {
  const host = mounted(app({ maxWidth: 'sm', padding: 5 }, 'the page'))
  const content = inner(host, '.content')
  expect(variable(content, '--maxwidth-mobile')).toEqual('var(--imp-content-sm, 40rem)')
  expect(variable(content, '--padding-mobile')).toContain('var(--imp-space-5,')
})

test('an app maxWidth given as a length is logged and falls back to full width', () => {
  const warn = warnings()
  const host = mounted(app({ maxWidth: '900px' }, 'the page'))
  expect(warned(warn, "'maxWidth'")).toBeTruthy()
  expect(variable(inner(host, '.content'), '--maxwidth-mobile')).toEqual('none')
})

test('app warns about an unknown prop and still renders', () => {
  const warn = warnings()
  const host = mounted(app({ sidebar: 'nope' }, 'the page'))
  expect(warned(warn, "unknown prop 'sidebar'")).toBeTruthy()
  expect(renderedText(inner(host, 'main'))).toEqual('the page')
})

test('sidebar is a named complementary landmark with a toggle wired to it', () => {
  const host = mounted(sidebar({ side: 'left', label: 'Sections' }, sections()))
  expect(host.localName).toEqual('imp-sidebar')
  expect(host.getAttribute('side')).toEqual('left')
  const panel = inner(host, '.panel')
  const toggle = inner(host, '.toggle')
  expect(panel.localName).toEqual('aside')
  expect(panel.getAttribute('aria-label')).toEqual('Sections')
  expect(toggle.getAttribute('aria-label')).toEqual('Sections')
  expect(toggle.getAttribute('aria-controls')).toEqual(panel.id)
  expect(toggle.getAttribute('aria-expanded')).toEqual('true')
})

test('an unlabelled sidebar warns and falls back to a translated name', () => {
  const warn = warnings()
  const host = mounted(sidebar('content'))
  expect(warned(warn, "needs a 'label'")).toBeTruthy()
  expect(inner(host, '.panel').getAttribute('aria-label')).toEqual('Sidebar')
})

test('an unknown side is logged and falls back to the left', () => {
  const warn = warnings()
  const host = mounted(sidebar({ side: 'top', label: 'Sections' }))
  expect(warned(warn, "'side'")).toBeTruthy()
  expect(host.getAttribute('side')).toEqual('left')
  expect(root(host).classList.contains('side-left')).toBeTruthy()
})

test('the toggle collapses the sidebar to its rail and makes the panel inert', () => {
  const host = mounted(sidebar({ label: 'Sections' }, sections()))
  const toggle = inner(host, '.toggle')
  const panel = inner(host, '.panel')
  expect(root(host).classList.contains('is-collapsed')).toEqual(false)
  toggle.click()
  expect(root(host).classList.contains('is-collapsed')).toBeTruthy()
  expect(toggle.getAttribute('aria-expanded')).toEqual('false')
  expect(panel.inert).toBeTruthy()
  toggle.click()
  expect(root(host).classList.contains('is-collapsed')).toEqual(false)
  expect(panel.inert).toEqual(false)
})

test('a sidebar can start collapsed', () => {
  const host = mounted(sidebar({ label: 'Sections', collapsed: true }, sections()))
  expect(root(host).classList.contains('is-collapsed')).toBeTruthy()
  expect(inner(host, '.toggle').getAttribute('aria-expanded')).toEqual('false')
})

test('a sidebar that cannot collapse hides its toggle but keeps it for the drawer', () => {
  const host = mounted(sidebar({ label: 'Sections', collapsible: false }, sections()))
  expect(root(host).classList.contains('can-collapse')).toEqual(false)
  expect(getComputedStyle(inner(host, '.head')).display).toEqual('none')
  expect(inner(host, '.toggle')).toBeTruthy()
  expect(inner(host, '.panel').inert).toEqual(false)
})

test('sidebar takes its width from the theme scale', () => {
  const host = mounted(sidebar({ label: 'Sections', width: 'lg' }))
  expect(variable(root(host), '--sidebar-size')).toEqual('var(--imp-sidebar-lg, 20rem)')
})

test('a sidebar width outside the scale is logged and falls back', () => {
  const warn = warnings()
  const host = mounted(sidebar({ label: 'Sections', width: 'huge' }))
  expect(warned(warn, "'width'")).toBeTruthy()
  expect(variable(root(host), '--sidebar-size')).toEqual('var(--imp-sidebar-md, 16rem)')
})

test('a sidebar has no splitter until it is made resizable', () => {
  const host = mounted(sidebar({ label: 'Sections' }, sections()))
  expect(inner(host, '.resizer')).toEqual(null)
  expect(root(host).classList.contains('can-resize')).toEqual(false)
  expect(variable(root(host), '--sidebar-min')).toEqual('')
})

test('a resizable sidebar carries a named splitter wired to its panel', () => {
  const host = mounted(sidebar({ label: 'Sections', resizable: true }, sections()))
  const handle = inner(host, '.resizer')
  expect(handle.getAttribute('role')).toEqual('separator')
  expect(handle.getAttribute('aria-orientation')).toEqual('vertical')
  expect(handle.getAttribute('aria-controls')).toEqual(inner(host, '.panel').id)
  expect(handle.getAttribute('aria-label')).toEqual('Resize Sections')
  expect(handle.tabIndex).toEqual(0)
})

test('the resize range takes both ends from the sidebar scale', () => {
  const host = mounted(
    sidebar({ label: 'Sections', resizable: true, minWidth: 'sm', maxWidth: 'lg' }),
  )
  expect(variable(root(host), '--sidebar-min')).toEqual('var(--imp-sidebar-sm, 12rem)')
  expect(variable(root(host), '--sidebar-max')).toEqual('var(--imp-sidebar-lg, 20rem)')
})

test('a resize range left unsaid opens the whole scale', () => {
  const host = mounted(sidebar({ label: 'Sections', resizable: true }))
  expect(variable(root(host), '--sidebar-min')).toEqual('var(--imp-sidebar-xs, 10rem)')
  expect(variable(root(host), '--sidebar-max')).toEqual('var(--imp-sidebar-xl, 24rem)')
})

test('a resize range without resizable is logged as doing nothing', () => {
  const warn = warnings()
  mounted(sidebar({ label: 'Sections', minWidth: 'sm' }))
  expect(warned(warn, "need 'resizable: true'")).toBeTruthy()
})

test('a resize range whose ends are the wrong way round is logged and opened up', () => {
  const warn = warnings()
  const host = mounted(
    sidebar({ label: 'Sections', resizable: true, minWidth: 'lg', maxWidth: 'sm' }),
  )
  expect(warned(warn, "is wider than 'maxWidth'")).toBeTruthy()
  expect(variable(root(host), '--sidebar-min')).toEqual('var(--imp-sidebar-xs, 10rem)')
  expect(variable(root(host), '--sidebar-max')).toEqual('var(--imp-sidebar-xl, 24rem)')
})

test('a width outside the resize range is logged', () => {
  const warn = warnings()
  mounted(sidebar({ label: 'Sections', resizable: true, width: 'xs', minWidth: 'md' }))
  expect(warned(warn, 'is outside the')).toBeTruthy()
})

test('a wide-screen sidebar ignores Escape and a choice made inside it', () => {
  const host = mounted(sidebar({ label: 'Sections' }, sections()))
  press(inner(host, '.panel'), 'Escape')
  expect(root(host).classList.contains('is-collapsed')).toEqual(false)
  inner(host, '.panel').dispatchEvent(
    new CustomEvent('select', { bubbles: true, composed: true, detail: { id: 'a' } }),
  )
  expect(root(host).classList.contains('is-collapsed')).toEqual(false)
})

test('app leaves the backdrop out of the way until a drawer opens', () => {
  const host = mounted(app(sidebar({ label: 'Sections' }, sections()), 'the page'))
  expect(inner(host, '.backdrop')).toBeTruthy()
  expect(root(host).classList.contains('is-drawer-open')).toEqual(false)
  expect(inner(host, 'main').inert).toEqual(false)
})

test('app dims the page and closes the other drawers while one is open', () => {
  const first = sidebar({ side: 'left', label: 'Sections' }, sections())
  const second = sidebar({ side: 'right', label: 'Activity' }, 'activity')
  const host = mounted(app(first, second, 'the page'))
  const openDrawer = (bar) =>
    bar.dispatchEvent(
      new CustomEvent('impSidebarDrawer', {
        detail: { open: true },
        bubbles: true,
        composed: true,
      }),
    )

  openDrawer(first)
  expect(root(host).classList.contains('is-drawer-open')).toBeTruthy()
  expect(inner(host, 'main').inert).toBeTruthy()
  expect(first.inert).toEqual(false)
  expect(second.inert).toBeTruthy()

  openDrawer(second)
  expect(first.inert).toBeTruthy()
  expect(second.inert).toEqual(false)

  second.dispatchEvent(
    new CustomEvent('impSidebarDrawer', { detail: { open: false }, bubbles: true, composed: true }),
  )
  expect(root(host).classList.contains('is-drawer-open')).toEqual(false)
  expect(inner(host, 'main').inert).toEqual(false)
})

test('a layout box renders a plain div carrying its children', () => {
  const host = mounted(stack('Content'))
  expect(host.localName).toEqual('imp-stack')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('Content')
})

test('padding writes both axes, and paddingX/paddingY override the axis they name', () => {
  const both = root(mounted(stack({ padding: 4 })))
  expect(variable(both, '--padding-block-mobile')).toContain('var(--imp-space-4,')
  expect(variable(both, '--padding-inline-mobile')).toContain('var(--imp-space-4,')
  const mixed = root(mounted(stack({ padding: 2, paddingX: 5 })))
  expect(variable(mixed, '--padding-block-mobile')).toContain('var(--imp-space-2,')
  expect(variable(mixed, '--padding-inline-mobile')).toContain('var(--imp-space-5,')
})

test('a paddingX given only from the wide stop up keeps padding below it', () => {
  const element = root(mounted(stack({ padding: 2, paddingX: { desktop: 6 } })))
  expect(variable(element, '--padding-inline-mobile')).toContain('var(--imp-space-2,')
  expect(variable(element, '--padding-inline-desktop')).toContain('var(--imp-space-6,')
})

test('sizes are plain CSS lengths on the logical properties', () => {
  const element = root(mounted(stack({ width: '20rem', maxHeight: '50vh' })))
  expect(variable(element, '--width-mobile')).toEqual('20rem')
  expect(variable(element, '--max-height-mobile')).toEqual('50vh')
})

test('a size given as a spacing step is logged and ignored', () => {
  const warn = warnings()
  const element = root(mounted(stack({ maxWidth: 4 })))
  expect(warned(warn, "'maxWidth'")).toBeTruthy()
  expect(variable(element, '--max-width-mobile')).toEqual('')
})

test('radius, shadow, background and border resolve to theme tokens', () => {
  const element = root(mounted(stack({ radius: 'lg', shadow: 'md', background: 'sunken' })))
  expect(variable(element, '--radius-mobile')).toEqual('var(--imp-radius-lg, 10px)')
  expect(variable(element, '--shadow-mobile')).toEqual(
    'var(--imp-shadow-md, 0 4px 12px rgb(15 23 42 / 12%))',
  )
  expect(variable(element, '--background-mobile')).toEqual(
    'var(--imp-color-surface-sunken, #f2f5fb)',
  )
  expect(variable(root(mounted(stack({ border: true }))), '--border-mobile')).toContain('solid')
})

test("radius 'none' and shadow 'none' resolve to the absence of each", () => {
  const element = root(mounted(stack({ radius: 'none', shadow: 'none' })))
  expect(variable(element, '--radius-mobile')).toEqual('0px')
  expect(variable(element, '--shadow-mobile')).toEqual('none')
})

test('an unknown radius or background is logged and ignored', () => {
  const warn = warnings()
  const element = root(mounted(stack({ radius: 'round', background: 'brand' })))
  expect(warned(warn, "'radius'")).toBeTruthy()
  expect(warned(warn, "'background'")).toBeTruthy()
  expect(variable(element, '--radius-mobile')).toEqual('')
  expect(variable(element, '--background-mobile')).toEqual('')
})

test('the box surface is shared by page, stack, grid and section', () => {
  for (const layout of [page, stack, grid, section]) {
    const element = root(mounted(layout({ padding: 3, radius: 'sm' })))
    expect(variable(element, '--padding-block-mobile')).toContain('var(--imp-space-3,')
    expect(variable(element, '--radius-mobile')).toEqual('var(--imp-radius-sm, 4px)')
  }
})

test('page caps its width at the content token for its size', () => {
  expect(variable(root(mounted(page({ size: 'sm' }))), '--max-width-mobile'))
    .toEqual('var(--imp-content-sm, 40rem)')
  expect(variable(root(mounted(page({ size: 'xl' }))), '--max-width-mobile'))
    .toEqual('var(--imp-content-xl, 80rem)')
})

test('a page with no size leaves its cap to the stylesheet default', () => {
  expect(variable(root(mounted(page())), '--max-width-mobile')).toEqual('')
})

test('an explicit maxWidth wins over a page size and is logged', () => {
  const warn = warnings()
  const element = root(mounted(page({ size: 'sm', maxWidth: '30rem' })))
  expect(warned(warn, "'size' and 'maxWidth'")).toBeTruthy()
  expect(variable(element, '--max-width-mobile')).toEqual('30rem')
})

test('section renders a section element with block padding for its size', () => {
  const host = mounted(section('Band'))
  expect(root(host).localName).toEqual('section')
  expect(variable(root(host), '--padding-block-mobile')).toContain('var(--imp-space-5,')
  expect(variable(root(mounted(section({ size: 'sm' }))), '--padding-block-mobile'))
    .toContain('var(--imp-space-4,')
})

test('a section padding prop replaces its size and is logged', () => {
  const warn = warnings()
  const element = root(mounted(section({ size: 'lg', paddingY: 1 })))
  expect(warned(warn, "'size' and 'padding'")).toBeTruthy()
  expect(variable(element, '--padding-block-mobile')).toContain('var(--imp-space-1,')
})

test('a section labels itself for the accessibility tree', () => {
  expect(root(mounted(section({ label: 'Pricing' }))).getAttribute('aria-label')).toEqual('Pricing')
  expect(root(mounted(section())).hasAttribute('aria-label')).toEqual(false)
})

test('a page needs no props to get its padding and cap from the theme', () => {
  const sheet = [...root(mounted(page())).getRootNode().adoptedStyleSheets]
    .flatMap((each) => [...each.cssRules])
    .map((rule) => rule.cssText)
    .join(' ')
  expect(sheet).toContain('margin-inline: auto')
  expect(sheet).toContain('--imp-space-page')
  expect(sheet).toContain('--imp-content-lg')
})

test('a page size of full removes the cap', () => {
  expect(variable(root(mounted(page({ size: 'full' }))), '--max-width-mobile')).toEqual('none')
})

test('grid fits as many columns as the width allows when it is given neither prop', () => {
  expect(getComputedStyle(root(mounted(grid()))).display).toEqual('grid')
  expect(variable(root(mounted(grid())), '--columns-mobile')).toContain('auto-fit')
})
