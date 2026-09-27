import { appMap, component, mount } from 'imp'
import { div } from 'imp/html'
import { flex, stack } from 'imp/std/layout'
import { shell } from 'imp/std/shell'
import { guard, navigate, router, wait } from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame, renderedText } from './shadow.js'
import { initState } from 'imp/state'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const root = (host) => host.shadowRoot.querySelector('.root')

const classesOf = (host) => root(host).getAttribute('class')

const gapOf = (host) => root(host).style.getPropertyValue('--gap')

const navHost = component('layout-nav-host', {
  setup: (self, render) => render(initState(self, 'layout.navOpen', false)),
})

const sectionHost = component('layout-section-host', {
  setup: (self, render) => render(initState(self, 'layout.section', 'iconed')),
})

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const pointerDown = (node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

const escape = (node) =>
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
  )

const settled = async () => {
  for (let tick = 0; tick < 3; tick += 1) await Promise.resolve()
}

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('flex renders a row carrying its children', () => {
  const host = mounted(flex(div('one'), div('two')))
  expect(host.localName).toEqual('imp-flex')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('onetwo')
})

test('flex defaults to start, stretch and no wrapping', () => {
  const classes = classesOf(mounted(flex()))
  expect(classes).toContain('horizontal-start')
  expect(classes).toContain('vertical-stretch')
  expect(classes).not.toContain('wrap')
})

test('flex applies its alignments and wrap as classes', () => {
  const host = mounted(flex({ horizontalAlign: 'justify', verticalAlign: 'center', wrap: true }))
  expect(classesOf(host)).toContain('horizontal-justify')
  expect(classesOf(host)).toContain('vertical-center')
  expect(classesOf(host)).toContain('wrap')
})

test('flex warns and falls back on an alignment outside its list', () => {
  const warn = warnings()
  const host = mounted(flex({ horizontalAlign: 'left', verticalAlign: 'baseline' }))
  expect(classesOf(host)).toContain('horizontal-start')
  expect(classesOf(host)).toContain('vertical-stretch')
  expect(warned(warn, "flex: 'horizontalAlign' must be one of")).toBeTruthy()
  expect(warned(warn, "flex: 'verticalAlign' must be one of")).toBeTruthy()
})

test('flex takes its gap from a spacing step', () => {
  expect(gapOf(mounted(flex({ gap: 5 })))).toEqual(
    'var(--imp-space-5, clamp(1rem, 0.793rem + 0.884vw, 1.5rem))',
  )
  expect(gapOf(mounted(flex({ gap: 0 })))).toEqual('0px')
})

test('flex leaves the default gap in the stylesheet when none is passed', () => {
  expect(gapOf(mounted(flex()))).toEqual('')
})

test('flex warns and falls back to step 3 on a gap that is not a step', () => {
  const warn = warnings()
  const host = mounted(flex({ gap: '1rem' }))
  expect(gapOf(host)).toContain('--imp-space-3')
  expect(warned(warn, "flex: 'gap' must be a spacing step")).toBeTruthy()
})

test('flex with joined drops the gap and applies the seam rules to its children', () => {
  const host = mounted(flex({ joined: true }, div('a'), div('b'), div('c')))
  expect(root(host).classList.contains('joined')).toEqual(true)
  expect(gapOf(host)).toEqual('')
  const sheet = [...host.shadowRoot.adoptedStyleSheets]
    .map((style) => [...style.cssRules].map((rule) => rule.cssText).join('\n'))
    .join('\n')
  expect(sheet).toContain('.joined > *:not(:first-child)')
  expect(sheet).toContain('--imp-corner-inline-start: 0')
  expect(sheet).toContain('.joined > *:not(:last-child)')
  expect(sheet).toContain('--imp-corner-inline-end: 0')
})

test('flex warns about a gap on a joined row and ignores it', () => {
  const warn = spy(console, 'warn', () => {})
  const host = mounted(flex({ joined: true, gap: 4 }, div('a'), div('b')))
  expect(warn.calls.some(([first]) => String(first).includes('a joined row has no gap')))
    .toEqual(true)
  expect(gapOf(host)).toEqual('')
})

test('flex reports an unknown prop', () => {
  const warn = warnings()
  mounted(flex({ padding: 4 }))
  expect(warned(warn, "flex: unknown prop 'padding'")).toBeTruthy()
})

test('stack renders a stack carrying its children', () => {
  const host = mounted(stack(div('one'), div('two')))
  expect(host.localName).toEqual('imp-stack')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('onetwo')
})

test('stack defaults to stretching its children across', () => {
  expect(classesOf(mounted(stack()))).toContain('horizontal-stretch')
})

test('stack applies its alignment as a class', () => {
  expect(classesOf(mounted(stack({ horizontalAlign: 'center' })))).toContain('horizontal-center')
})

test('stack warns and falls back on an alignment outside its list', () => {
  const warn = warnings()
  const host = mounted(stack({ horizontalAlign: 'justify' }))
  expect(classesOf(host)).toContain('horizontal-stretch')
  expect(warned(warn, "stack: 'horizontalAlign' must be one of")).toBeTruthy()
})

test('stack takes its gap from a spacing step', () => {
  expect(gapOf(mounted(stack({ gap: 2 })))).toEqual('var(--imp-space-2, 8px)')
})

test('stack starts its children at the top and applies a vertical alignment as a class', () => {
  expect(classesOf(mounted(stack()))).toContain('vertical-top')
  expect(classesOf(mounted(stack({ verticalAlign: 'justify' })))).toContain('vertical-justify')
})

test('stack warns and falls back on a vertical alignment outside its list', () => {
  const warn = warnings()
  const host = mounted(stack({ verticalAlign: 'stretch' }))
  expect(classesOf(host)).toContain('vertical-top')
  expect(warned(warn, "stack: 'verticalAlign' must be one of")).toBeTruthy()
})

test('stack fills the height its parent gives it and spreads its children along it', () => {
  const host = mounted(stack({ verticalAlign: 'justify' }, div('first'), div('last')))
  expect(getComputedStyle(host).display).toEqual('block')
  expect(getComputedStyle(root(host)).blockSize).toEqual('100%')
  expect(getComputedStyle(root(host)).justifyContent).toEqual('space-between')
  expect(getComputedStyle(root(mounted(stack({ verticalAlign: 'bottom' })))).justifyContent)
    .toEqual('flex-end')
})

const shellRoot = (host) => host.shadowRoot.querySelector('.shell')

const region = (host, selector) => host.shadowRoot.querySelector(selector)

const drawerOf = (host) => region(host, '.drawer')

const burgerOf = (host) => region(host, '.hamburger')

const classesOfShell = (host) => shellRoot(host).getAttribute('class')

const tools = () => div({ id: 'theme' }, 'theme')

const reports = {
  id: 'reports',
  label: 'Reports',
  groups: [
    {
      label: 'Money',
      items: [
        { id: 'revenue', label: 'Revenue', href: '/revenue', icon: div('r') },
        {
          id: 'costs',
          label: 'Costs',
          href: '/costs',
          icon: div('c'),
          children: [{ id: 'costs-fixed', label: 'Fixed', href: '/costs/fixed' }],
        },
      ],
    },
    { label: 'People', items: [{ id: 'churn', label: 'Churn', href: '/churn', icon: div('p') }] },
  ],
}

const directory = { id: 'directory', label: 'Directory', href: '/directory' }

const navbar = { label: 'Sections', selected: 'reports', items: [reports, directory] }

const filters = {
  label: 'Filters',
  items: [
    { id: 'one', label: 'One', href: '/one' },
    { id: 'two', label: 'Two', href: '/two' },
    { id: 'three', label: 'Three', href: '/three' },
    { id: 'four', label: 'Four', href: '/four' },
    { id: 'five', label: 'Five', href: '/five' },
    { id: 'six', label: 'Six', href: '/six' },
  ],
}

const labelsIn = (node) =>
  [...node.querySelectorAll('li:not([hidden]) .link .label')].map((n) => n.textContent)

test('shell renders the frame landmarks and puts its children in main', () => {
  const host = mounted(shell({ navbar }, div('page')))
  expect(host.localName).toEqual('imp-shell')
  expect(region(host, 'header.topbar').localName).toEqual('header')
  expect(region(host, 'main.main').localName).toEqual('main')
  expect(renderedText(region(host, 'main.main'))).toEqual('page')
})

test('shell renders only the regions it is given', () => {
  const host = mounted(shell(div('page')))
  expect(region(host, 'header.topbar')).toEqual(null)
  expect(classesOfShell(host)).not.toContain('has-sidebar')
  expect(classesOfShell(host)).not.toContain('has-bottom-bar')
  expect(region(host, 'main.main')).toBeTruthy()
})

test('shell brings the nav landmarks its own nav data needs', () => {
  const host = mounted(shell({ navbar, sidebar: { label: 'Reports' } }, div('page')))
  expect(region(host, 'nav.bar-nav').getAttribute('aria-label')).toEqual('Sections')
  expect(region(host, 'nav.sidebar-body').getAttribute('aria-label')).toEqual('Reports')
  expect(region(host, 'nav.bottombar').getAttribute('aria-label')).toEqual('Reports')
})

test('shell names an unlabelled nav for what it is', () => {
  const host = mounted(shell({ navbar: { items: [] }, sidebar: { items: [] } }))
  expect(region(host, 'nav.bar-nav').getAttribute('aria-label')).toEqual('Navigation')
  expect(region(host, 'nav.sidebar-body').getAttribute('aria-label')).toEqual('Section')
})

test('a section declares its own sidebar, and the frame shows the current one', () => {
  const host = mounted(shell({ navbar }))
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
  expect(
    [...region(host, '.sidebar-body').querySelectorAll('.group-title')].map((n) => n.textContent),
  ).toEqual(['Money', 'People'])
})

test('a section with no groups renders no sidebar at all', () => {
  const host = mounted(shell({ navbar: { ...navbar, selected: 'directory' } }))
  expect(classesOfShell(host)).not.toContain('has-sidebar')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual([])
})

const nested = {
  label: 'Catalog',
  selected: 'two',
  items: [
    {
      id: 'first',
      label: 'First',
      icon: div('1'),
      children: [{ id: 'one', label: 'One', href: '/one' }, {
        id: 'two',
        label: 'Two',
        href: '/two',
      }],
    },
    {
      id: 'second',
      label: 'Second',
      icon: div('2'),
      children: [{ id: 'three', label: 'Three', href: '/three' }],
    },
  ],
}

const parentLink = (host, label) =>
  [...region(host, '.sidebar-body').querySelectorAll('.link')]
    .find((link) => link.textContent.includes(label))

test('the parent of the selected row starts expanded, the others collapsed', () => {
  const host = mounted(shell({ sidebar: nested }))
  expect(parentLink(host, 'First').getAttribute('aria-expanded')).toEqual('true')
  expect(parentLink(host, 'Second').getAttribute('aria-expanded')).toEqual('false')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['First', 'One', 'Two', 'Second'])
})

const onAPhone = (run) => {
  const original = globalThis.matchMedia
  globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {} })
  try {
    return run()
  } finally {
    globalThis.matchMedia = original
  }
}

test('on a phone a parent row in the bottom bar opens its children in the sheet', async () => {
  const host = onAPhone(() => mounted(shell({ sidebar: nested })))
  await nextFrame()
  const bar = region(host, '.bottombar')
  const sheet = region(host, '.sheet')
  const second = [...bar.querySelectorAll('.link')].find((link) =>
    link.textContent.includes('Second')
  )
  expect(second).toBeTruthy()
  const states = []
  sheet.addEventListener('toggle', (event) => states.push(event.newState))
  click(second)
  expect(states).toEqual(['open'])
  expect(second.classList.contains('sheet-anchor')).toBeTruthy()
  expect(second.style.anchorName || '').toEqual('')
  expect(region(host, '.sheet-head .title').textContent).toEqual('Second')
  expect(labelsIn(sheet)).toEqual(['Three'])
  click(sheet.querySelector('.link'))
  await settled()
  expect(states).toEqual(['open', 'closed'])
  expect(labelsIn(sheet)).toEqual([])
  expect(region(host, '.sidebar-body').querySelectorAll('.child').length).toEqual(3)
  expect(bar.querySelectorAll('.link').length).toEqual(2)
})

test('on a phone the title of the children sheet links to the parent page', async () => {
  const items = nested.items.map((item) => ({ ...item, href: `/${item.id}` }))
  const host = onAPhone(() => mounted(shell({ sidebar: { ...nested, items } })))
  await nextFrame()
  const tap = (node) =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  const bar = region(host, '.bottombar')
  const sheet = region(host, '.sheet')
  const states = []
  sheet.addEventListener('toggle', (event) => states.push(event.newState))
  const second = [...bar.querySelectorAll('.link')].find((link) =>
    link.textContent.includes('Second')
  )
  tap(second)
  expect(states).toEqual(['open'])
  expect(location.pathname).not.toEqual('/second')
  const title = region(host, '.sheet-head .title .title-link')
  expect(title.localName).toEqual('a')
  expect(title.getAttribute('href')).toEqual('/second')
  expect(title.textContent).toEqual('Second')
  expect(title.hasAttribute('aria-current')).toEqual(false)
  expect(labelsIn(sheet)).toEqual(['Three'])
  tap(title)
  await settled()
  expect(location.pathname).toEqual('/second')
  expect(states).toEqual(['open', 'closed'])
  const onParent = onAPhone(() =>
    mounted(shell({ sidebar: { ...nested, items, selected: 'second' } }))
  )
  await nextFrame()
  tap(
    [...region(onParent, '.bottombar').querySelectorAll('.link')].find((link) =>
      link.textContent.includes('Second')
    ),
  )
  expect(region(onParent, '.sheet-head .title .title-link').getAttribute('aria-current'))
    .toEqual('page')
})

test('on a phone the title of the children sheet stays text for a parent without a page', async () => {
  const host = onAPhone(() => mounted(shell({ sidebar: nested })))
  await nextFrame()
  const second = [...region(host, '.bottombar').querySelectorAll('.link')].find((link) =>
    link.textContent.includes('Second')
  )
  click(second)
  expect(region(host, '.sheet-head .title').textContent).toEqual('Second')
  expect(region(host, '.sheet-head .title .title-link')).toEqual(null)
})

test('on a phone the More button sizes its box the same way as the rows beside it', async () => {
  const rows = ['One', 'Two', 'Three', 'Four', 'Five'].map((label) => ({
    id: label.toLowerCase(),
    label,
    href: `/${label.toLowerCase()}`,
  }))
  const host = onAPhone(() => mounted(shell({ sidebar: { items: rows } })))
  await nextFrame()
  const bar = region(host, '.bottombar')
  const more = bar.querySelector('button.more')
  const row = bar.querySelector('a.link')
  expect(more).toBeTruthy()
  expect(getComputedStyle(more).boxSizing).toEqual('border-box')
  expect(getComputedStyle(more).boxSizing).toEqual(getComputedStyle(row).boxSizing)
})

const nestedHost = component('layout-nested-host', {
  setup: (self, render) =>
    render(initState(self, 'layout.selected', 'two'), initState(self, 'layout.footer', [])),
})

test('a folded parent stays folded until the selection moves to another parent', async () => {
  let selected = null
  let footer = null
  let host = null
  mounted(nestedHost((selectedState, footerState) => {
    selected = selectedState
    footer = footerState
    host = shell({ sidebar: { ...nested, selected: selectedState, footer: footerState } })
    return host
  }))
  const parent = parentLink(host, 'First')
  expect(parent.getAttribute('aria-expanded')).toEqual('true')
  click(parent)
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  footer.set([{ id: 'help', label: 'Help', href: '/help' }])
  await settled()
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['First', 'Second'])
  selected.set('one')
  await settled()
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  selected.set('three')
  await settled()
  expect(parentLink(host, 'Second').getAttribute('aria-expanded')).toEqual('true')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['First', 'Second', 'Three'])
})

test('a child row is hidden until its parent is expanded', () => {
  const host = mounted(shell({ navbar }))
  const parent = [...region(host, '.sidebar-body').querySelectorAll('.link')]
    .find((link) => link.textContent.includes('Costs'))
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  expect(labelsIn(region(host, '.sidebar-body'))).not.toContain('Fixed')
  click(parent)
  expect(parent.getAttribute('aria-expanded')).toEqual('true')
  expect(labelsIn(region(host, '.sidebar-body'))).toContain('Fixed')
})

test('the rail toggle is withheld while any row lacks an icon', () => {
  const host = mounted(shell({ sidebar: filters }))
  expect(region(host, '.rail-toggle').hidden).toEqual(true)
  expect(getComputedStyle(region(host, '.rail-toggle')).display).toEqual('none')
  const iconed = mounted(
    shell({
      sidebar: {
        items: [{ id: 'one', label: 'One', href: '/one', icon: div('i') }],
        footer: [{ id: 'help', label: 'Help', href: '/help' }],
      },
    }),
  )
  expect(region(iconed, '.rail-toggle').hidden).toEqual(true)
  const railable = mounted(
    shell({
      sidebar: {
        items: [{ id: 'one', label: 'One', href: '/one', icon: div('i') }],
        footer: [{ id: 'help', label: 'Help', href: '/help', icon: div('h') }],
      },
    }),
  )
  expect(region(railable, '.rail-toggle').hidden).toEqual(false)
  expect(getComputedStyle(region(railable, '.rail-toggle')).display).toEqual('inline-flex')
})

test('switching to a section whose rows lack icons expands the rail and hides the toggle', () => {
  let section = null
  let host = null
  mounted(sectionHost((selected) => {
    section = selected
    host = shell({
      navbar: {
        selected,
        items: [
          {
            id: 'iconed',
            label: 'Iconed',
            items: [{ id: 'a', label: 'A', href: '/a', icon: div('i') }],
          },
          { id: 'plain', label: 'Plain', items: [{ id: 'b', label: 'B', href: '/b' }] },
        ],
      },
    })
    return host
  }))
  const toggle = region(host, '.rail-toggle')
  expect(toggle.hidden).toEqual(false)
  click(toggle)
  expect(classesOfShell(host)).toContain('rail')
  section.set('plain')
  expect(toggle.hidden).toEqual(true)
  expect(classesOfShell(host)).not.toContain('rail')
})

test('the rail toggle collapses the sidebar to icons', () => {
  const host = mounted(shell({ navbar }))
  const toggle = region(host, '.rail-toggle')
  expect(toggle.getAttribute('aria-expanded')).toEqual('true')
  expect(toggle.getAttribute('aria-label')).toEqual('Collapse the sidebar')
  click(toggle)
  expect(classesOfShell(host)).toContain('rail')
  expect(toggle.getAttribute('aria-expanded')).toEqual('false')
  expect(toggle.getAttribute('aria-label')).toEqual('Expand the sidebar')
})

test('in the rail a row keeps its label for a screen reader and shows it as a tooltip', () => {
  const host = mounted(shell({ navbar }))
  const link = region(host, '.sidebar-body .link')
  const tip = link.parentElement.querySelector('.tip')
  let open = false
  tip.addEventListener('toggle', (event) => {
    open = event.newState === 'open'
  })
  expect(tip.getAttribute('popover')).toEqual('manual')
  expect(tip.textContent).toEqual(link.querySelector('.label').textContent)
  link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(open).toEqual(false)
  click(region(host, '.rail-toggle'))
  expect(getComputedStyle(link.querySelector('.label')).display).not.toEqual('none')
  link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(open).toEqual(true)
  link.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  expect(open).toEqual(false)
})

test('the sidebar takes footer rows of its own', () => {
  const host = mounted(
    shell({ navbar, sidebar: { footer: [{ id: 'help', label: 'Help', href: '/help' }] } }),
  )
  expect(labelsIn(region(host, '.sidebar-foot'))).toEqual(['Help'])
})

test('shell marks which regions are present', () => {
  const host = mounted(shell({ navbar }))
  expect(classesOfShell(host)).toContain('has-navbar')
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(classesOfShell(mounted(shell({ sidebar: filters })))).not.toContain('has-navbar')
})

test('shell reports an unknown prop, including the ones it used to take', () => {
  const warn = warnings()
  mounted(shell({ header: div('bar'), rail: div('r'), aside: div('a'), headerSpan: 'full' }))
  expect(warned(warn, "shell: unknown prop 'header'")).toBeTruthy()
  expect(warned(warn, "shell: unknown prop 'rail'")).toBeTruthy()
  expect(warned(warn, "shell: unknown prop 'aside'")).toBeTruthy()
  expect(warned(warn, "shell: unknown prop 'headerSpan'")).toBeTruthy()
})

test('a nav region is data, and DOM in one is reported and dropped', () => {
  const warn = warnings()
  const host = mounted(shell({ navbar: div('bar') }))
  expect(
    warned(
      warn,
      "shell: 'navbar' must be an object of { label, items, selected, map, icons, tags, background }",
    ),
  )
    .toBeTruthy()
  expect(classesOfShell(host)).not.toContain('has-navbar')
})

test('a nav region reports an unknown key', () => {
  const warn = warnings()
  mounted(shell({ sidebar: { ...filters, direction: 'row' } }))
  expect(warned(warn, "shell: unknown 'sidebar' key 'direction'")).toBeTruthy()
})

test('sidebar items beside a navbar are reported and dropped', () => {
  const warn = warnings()
  const host = mounted(shell({ navbar, sidebar: filters }))
  expect(warned(warn, "shell: 'sidebar.items' is ignored beside a 'navbar'")).toBeTruthy()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
})

test('a navbar owns the logo and the tools, and the bar is shown', () => {
  const host = mounted(
    shell({ logo: div({ id: 'brand' }, 'Acme'), navbar, extras: tools() }),
  )
  expect(classesOfShell(host)).not.toContain('bar-away')
  expect(region(host, '.topbar .bar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.bar-body nav.bar-nav')).toBeTruthy()
  expect(region(host, '.bar-tools .tools #theme')).toBeTruthy()
})

test('a sidebar without a navbar owns the logo and the tools, and the bar is dropped', () => {
  const host = mounted(
    shell({ logo: div({ id: 'brand' }, 'Acme'), sidebar: filters, extras: tools() }),
  )
  expect(classesOfShell(host)).toContain('bar-away')
  expect(region(host, '.sidebar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.sidebar-foot .tools #theme')).toBeTruthy()
})

test('an account prop is reported and dropped', () => {
  const warn = warnings()
  mounted(shell({ navbar, account: { name: 'Ada' } }))
  expect(warned(warn, "shell: unknown prop 'account'")).toBeTruthy()
})

const gateHost = component('layout-gate-host', {
  setup: (self, render) => render(initState(self, 'layout.gate', undefined)),
})

const gateOf = (host) => region(host, 'main.gate')

test('a signed-out frame shows the sign-in content and the logo, and no chrome', () => {
  const page = div({ id: 'page' }, 'page')
  const host = mounted(
    shell(
      {
        logo: div({ id: 'brand' }),
        navbar,
        extras: tools(),
        signedIn: false,
        signIn: div({ id: 'login' }),
      },
      page,
    ),
  )
  expect(classesOfShell(host)).toContain('gated')
  expect(gateOf(host).querySelector('.gate-body #login')).toBeTruthy()
  expect(gateOf(host).querySelector('.gate-logo #brand')).toBeTruthy()
  expect(region(host, 'header.topbar')).toEqual(null)
  expect(region(host, 'main.main')).toEqual(null)
  expect(page.isConnected).toEqual(false)
  expect(host.shadowRoot.querySelector('#theme')).toEqual(null)
})

test('the frame follows a session state: unknown shows a loader, nobody the sign-in, somebody the app', () => {
  let session
  let calls = 0
  const page = div({ id: 'page' }, 'page')
  const outer = mounted(gateHost((state) => {
    session = state
    return shell(
      {
        logo: div({ id: 'brand' }),
        navbar,
        signedIn: state,
        signIn: () => {
          calls += 1
          return div({ id: 'login' })
        },
      },
      page,
    )
  }))
  const host = outer.shadowRoot.querySelector('imp-shell')
  expect(gateOf(host).querySelector('imp-loader')).toBeTruthy()
  expect(gateOf(host).querySelector('#login')).toEqual(null)
  expect(calls).toEqual(0)
  session.set(null)
  expect(gateOf(host).querySelector('#login')).toBeTruthy()
  expect(gateOf(host).querySelector('imp-loader')).toEqual(null)
  expect(calls).toEqual(1)
  session.set({ name: 'Ada' })
  expect(gateOf(host)).toEqual(null)
  expect(classesOfShell(host)).not.toContain('gated')
  expect(region(host, 'header.topbar')).toBeTruthy()
  expect(region(host, 'main.main').contains(page)).toEqual(true)
  expect(region(host, '.bar-logo #brand')).toBeTruthy()
  session.set(null)
  expect(gateOf(host).querySelector('#login')).toBeTruthy()
  expect(page.isConnected).toEqual(false)
  expect(calls).toEqual(1)
})

test('signIn without signedIn, and signedIn without signIn, are reported', () => {
  const warn = warnings()
  const open = mounted(shell({ navbar, signIn: div({ id: 'login' }) }, div('page')))
  expect(warned(warn, "'signIn' needs 'signedIn'")).toBeTruthy()
  expect(region(open, 'main.main')).toBeTruthy()
  expect(gateOf(open)).toEqual(null)
  const bare = mounted(shell({ navbar, signedIn: false }, div('page')))
  expect(warned(warn, "'signedIn' needs 'signIn'")).toBeTruthy()
  expect(gateOf(bare)).toBeTruthy()
  expect(region(bare, 'main.main')).toEqual(null)
})

test('the frame gets a hamburger that names and controls the drawer', () => {
  const host = mounted(shell({ navbar }))
  const burger = burgerOf(host)
  expect(burger.localName).toEqual('button')
  expect(burger.getAttribute('aria-label')).toEqual('Menu')
  expect(drawerOf(host).getAttribute('aria-label')).toEqual('Menu')
  expect(burger.getAttribute('aria-controls')).toEqual(drawerOf(host).id)
  expect(burger.getAttribute('aria-expanded')).toEqual('false')
})

test('a frame with no chrome at all brings no drawer', () => {
  const bare = mounted(shell({ sidebar: filters }))
  expect(burgerOf(bare)).toEqual(null)
  expect(drawerOf(bare)).toEqual(null)
  const chromed = mounted(shell({ sidebar: filters, extras: tools() }))
  expect(burgerOf(chromed)).toBeTruthy()
  expect(drawerOf(chromed)).toBeTruthy()
})

test('the hamburger opens the drawer and reports it', () => {
  const opened = []
  const host = mounted(
    shell({ navbar, events: { navToggle: (e) => opened.push(e.detail.open) } }),
  )
  click(burgerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  expect(burgerOf(host).getAttribute('aria-expanded')).toEqual('true')
  expect(opened).toEqual([true])
})

test('closing the drawer waits for the slide to finish', async () => {
  const opened = []
  const host = mounted(
    shell({ navbar, events: { navToggle: (e) => opened.push(e.detail.open) } }),
  )
  click(burgerOf(host))
  click(burgerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
  expect(burgerOf(host).getAttribute('aria-expanded')).toEqual('false')
  expect(opened).toEqual([true, false])
})

test('escape dismisses the drawer through the same closing slide', async () => {
  const host = mounted(shell({ navbar }))
  click(burgerOf(host))
  escape(drawerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('clicking the backdrop dismisses the drawer', async () => {
  const host = mounted(shell({ navbar }))
  click(burgerOf(host))
  pointerDown(drawerOf(host))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('a drag that starts inside the drawer leaves it open', async () => {
  const host = mounted(shell({ navbar }))
  click(burgerOf(host))
  pointerDown(region(host, '.drawer-body'))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(true)
})

test('the open drawer takes focus, inerts the page and holds the page scroll', async () => {
  const host = mounted(shell({ navbar }))
  const outside = document.body.appendChild(document.createElement('button'))
  outside.focus()
  click(burgerOf(host))
  expect(outside.inert).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('hidden')
  click(burgerOf(host))
  await settled()
  expect(outside.inert).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('')
  expect(document.activeElement).toEqual(outside)
})

test('navOpen drives the drawer and is written back when it closes itself', async () => {
  let navOpen = null
  let host = null
  mounted(navHost((state) => {
    navOpen = state
    host = shell({ navbar, navOpen: state })
    return host
  }))
  navOpen.set(true)
  expect(drawerOf(host).open).toEqual(true)
  click(burgerOf(host))
  expect(navOpen.get()).toEqual(false)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

const footerHost = component('layout-footer-host', {
  setup: (self, render) =>
    render(initState(self, 'layout.footer', [{ id: 'help', label: 'Help', href: '/help' }])),
})

test('a footer state update keeps the extras in the sidebar foot', async () => {
  let footer = null
  let host = null
  mounted(footerHost((state) => {
    footer = state
    host = shell({ sidebar: { ...filters, footer: state }, extras: tools() })
    return host
  }))
  expect(region(host, '.sidebar-foot .tools')).toBeTruthy()
  footer.set([{ id: 'docs', label: 'Docs', href: '/docs' }])
  await settled()
  expect(labelsIn(region(host, '.sidebar-foot'))).toEqual(['Docs'])
  expect(region(host, '.sidebar-foot .tools')).toBeTruthy()
})

test('a parent row with children and no href is a focusable button that expands them', () => {
  const tree = {
    selected: 'reports',
    items: [{
      id: 'reports',
      label: 'Reports',
      groups: [{
        items: [{
          id: 'costs',
          label: 'Costs',
          children: [{ id: 'fixed', label: 'Fixed', href: '/f' }],
        }],
      }],
    }],
  }
  const host = mounted(shell({ navbar: tree }))
  const parent = region(host, '.sidebar-body .link')
  expect(parent.localName).toEqual('button')
  expect(parent.tabIndex).toEqual(0)
  click(parent)
  expect(parent.getAttribute('aria-expanded')).toEqual('true')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Costs', 'Fixed'])
})

test('a row with onClick and no href is a button that calls it', () => {
  const chosen = []
  const host = mounted(
    shell({
      sidebar: { items: [{ id: 'help', label: 'Help', onClick: ({ id }) => chosen.push(id) }] },
    }),
  )
  const control = region(host, '.sidebar-body .link')
  expect(control.localName).toEqual('button')
  expect(control.getAttribute('type')).toEqual('button')
  click(control)
  expect(chosen).toEqual(['help'])
})

test('a cancelled select event skips both onClick and the href', () => {
  const chosen = []
  const host = mounted(
    shell({
      sidebar: {
        items: [{
          id: 'tasks',
          label: 'Tasks',
          href: '/tasks',
          onClick: () => chosen.push('click'),
        }],
      },
      events: { select: (event) => event.preventDefault() },
    }),
  )
  click(region(host, '.sidebar-body .link'))
  expect(chosen).toEqual([])
})

test('a disabled row is an inert link', () => {
  const host = mounted(
    shell({
      sidebar: { items: [{ id: 'audit', label: 'Audit', href: '/audit', disabled: true }] },
    }),
  )
  const link = region(host, '.sidebar-body .link')
  expect(link.localName).toEqual('span')
  expect(link.getAttribute('role')).toEqual('link')
  expect(link.getAttribute('aria-disabled')).toEqual('true')
})

test('a row draws its icon before its label', () => {
  const mark = document.createElement('svg')
  const host = mounted(
    shell({ sidebar: { items: [{ id: 'home', label: 'Home', href: '/', icon: mark }] } }),
  )
  const link = region(host, '.sidebar-body .link')
  expect(link.firstElementChild.getAttribute('class')).toEqual('icon')
  expect(link.firstElementChild.firstElementChild).toEqual(mark)
})

test('a row tag renders as a tag component in the requested color', () => {
  const host = mounted(
    shell({
      sidebar: {
        items: [{
          id: 'tasks',
          label: 'Tasks',
          href: '/tasks',
          tag: { text: 'overdue', color: 'red' },
        }],
      },
    }),
  )
  const pill = region(host, '.sidebar-body .link imp-tag').shadowRoot.querySelector('.tag')
  expect(renderedText(pill)).toEqual('overdue')
  expect(pill.classList.contains('color-red')).toBeTruthy()
})

test('a group tag renders beside the group title', () => {
  const host = mounted(
    shell({
      sidebar: {
        groups: [{ label: 'Work', tag: { text: 2 }, items: [{ id: 'a', label: 'A', href: '/a' }] }],
      },
    }),
  )
  const title = region(host, '.sidebar-body .group-title')
  expect(renderedText(title)).toEqual('Work2')
  expect(region(host, '.sidebar-body ul').getAttribute('aria-labelledby')).toEqual(title.id)
})

test('a tag without text is logged and dropped', () => {
  const warn = warnings()
  const host = mounted(
    shell({ sidebar: { items: [{ id: 'tasks', label: 'Tasks', tag: { color: 'red' } }] } }),
  )
  expect(warned(warn, "a 'tag' must be an object")).toBeTruthy()
  expect(region(host, '.sidebar-body imp-tag')).toEqual(null)
})

test('a selected footer row names the phone title', () => {
  const host = mounted(
    shell({
      navbar,
      sidebar: { selected: 'help', footer: [{ id: 'help', label: 'Help', href: '/help' }] },
    }),
  )
  expect(region(host, '.bar-title .now').textContent).toEqual('Help')
  expect(region(host, '.sidebar-foot .link').getAttribute('aria-current')).toEqual('page')
})

test('the bottom bar is named for the sections when it carries them', () => {
  const host = mounted(
    shell({ navbar: { ...navbar, selected: 'directory' }, sidebar: { label: 'Reports' } }),
  )
  expect(region(host, 'nav.bottombar').getAttribute('aria-label')).toEqual('Sections')
  const withRows = mounted(shell({ navbar, sidebar: { label: 'Reports' } }))
  expect(region(withRows, 'nav.bottombar').getAttribute('aria-label')).toEqual('Reports')
})

test('shell puts a skip link first, and it moves the focus to the main region', () => {
  const host = mounted(shell({ navbar }, div('page')))
  const skip = region(host, '.skip')
  expect(skip.localName).toEqual('a')
  expect(skip.textContent).toEqual('Skip to the content')
  expect(skip.previousElementSibling?.classList.contains('backdrop') ?? true).toEqual(true)
  const mainRegion = region(host, '.main')
  expect(mainRegion.getAttribute('tabindex')).toEqual('-1')
  skip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  expect(host.shadowRoot.activeElement).toEqual(mainRegion)
})

test('shell paints a background node under everything, hidden from assistive technology', () => {
  const host = mounted(shell({ navbar, background: div({ id: 'sky' }, 'sky') }, div('page')))
  const backdrop = shellRoot(host).firstElementChild
  expect(backdrop.classList.contains('backdrop')).toBeTruthy()
  expect(backdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(backdrop.querySelector('#sky')).toBeTruthy()
  expect(region(mounted(shell({ navbar })), '.backdrop')).toEqual(null)
})

test('the bar and the column each paint their own background node, hidden the same way', () => {
  const host = mounted(
    shell({
      navbar: { ...navbar, background: div({ id: 'bar-sky' }) },
      sidebar: { background: div({ id: 'column-sky' }) },
    }),
  )
  const barBackdrop = region(host, '.topbar > .backdrop')
  expect(barBackdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(barBackdrop.querySelector('#bar-sky')).toBeTruthy()
  const columnBackdrop = region(host, '.sidebar > .backdrop')
  expect(columnBackdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(columnBackdrop.querySelector('#column-sky')).toBeTruthy()
  expect(region(host, '.shell > .backdrop')).toEqual(null)
})

test('on a phone the background of the column moves into the drawer', () => {
  const host = onAPhone(() =>
    mounted(shell({ navbar, sidebar: { background: div({ id: 'column-sky' }) } }))
  )
  expect(region(host, '.drawer > .backdrop #column-sky')).toBeTruthy()
  expect(region(host, '.sidebar > .backdrop')).toEqual(null)
})

test('shell gap floats the panels apart from a spacing step', () => {
  const host = mounted(shell({ navbar, gap: 3 }))
  expect(classesOfShell(host)).toContain('gapped')
  expect(shellRoot(host).style.getPropertyValue('--frame-gap')).toContain('--imp-space-3')
})

test('a gapped shell publishes its inset and radius for the drawers inside it', () => {
  const published = region(mounted(shell({ navbar, gap: 3 })), '.shell').style
  expect(published.getPropertyValue('--imp-shell-frame-gap')).toContain('--imp-space-3')
  expect(published.getPropertyValue('--imp-shell-frame-radius')).toContain('--imp-radius-container')
  const flush = region(mounted(shell({ navbar })), '.shell').style
  expect(flush.getPropertyValue('--imp-shell-frame-gap')).toEqual('')
  expect(flush.getPropertyValue('--imp-shell-frame-radius')).toEqual('')
})

test('shell without a gap, or with step 0, is the edge-to-edge frame', () => {
  for (const host of [mounted(shell({ navbar })), mounted(shell({ navbar, gap: 0 }))]) {
    expect(classesOfShell(host)).not.toContain('gapped')
    expect(shellRoot(host).style.getPropertyValue('--frame-gap')).toEqual('')
  }
})

test('shell limits the frame to 125rem by default and publishes the inset', () => {
  const host = mounted(shell({ navbar }))
  expect(classesOfShell(host)).toContain('limited')
  const published = shellRoot(host).style
  expect(published.getPropertyValue('--page-max')).toEqual('125rem')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toEqual(
    'max(0px, calc((100% - 125rem) / 2))',
  )
})

test('shell maxWidth takes a CSS length, and a gap joins the inset', () => {
  const host = mounted(shell({ navbar, maxWidth: '90rem', gap: 3 }))
  const published = shellRoot(host).style
  expect(published.getPropertyValue('--page-max')).toEqual('90rem')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toContain('--imp-space-3')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toContain('90rem')
})

test('shell maxWidth none lifts the limit and keeps the gap as the inset', () => {
  const flush = mounted(shell({ navbar, maxWidth: 'none' }))
  expect(classesOfShell(flush)).not.toContain('limited')
  expect(shellRoot(flush).style.getPropertyValue('--page-max')).toEqual('')
  expect(shellRoot(flush).style.getPropertyValue('--imp-shell-frame-inset')).toEqual('')
  const gapped = mounted(shell({ navbar, maxWidth: 'none', gap: 3 }))
  expect(shellRoot(gapped).style.getPropertyValue('--imp-shell-frame-inset')).toContain(
    '--imp-space-3',
  )
})

test('shell warns and uses the default for a maxWidth that is not a string', () => {
  const warn = warnings()
  const host = mounted(shell({ navbar, maxWidth: 90 }))
  expect(warned(warn, "shell: 'maxWidth' must be a CSS length")).toBeTruthy()
  expect(shellRoot(host).style.getPropertyValue('--page-max')).toEqual('125rem')
})

test('the top bar keeps its controls in a bar box that the frame centres', () => {
  const host = mounted(shell({ logo: div({ id: 'brand' }), navbar }))
  expect(region(host, '.topbar > .bar > .bar-logo #brand')).toBeTruthy()
  expect(region(host, '.topbar > .bar > .bar-body')).toBeTruthy()
})

test('shell warns and drops a gap that is not a spacing step', () => {
  const warn = warnings()
  const host = mounted(shell({ navbar, gap: '1rem' }))
  expect(warned(warn, "shell: 'gap' must be a spacing step")).toBeTruthy()
  expect(classesOfShell(host)).not.toContain('gapped')
})

test('sidebar extras keep the column in a section that has no groups', () => {
  const host = mounted(
    shell({
      navbar: { ...navbar, selected: 'directory' },
      sidebar: { extras: div({ id: 'support' }, 'Support') },
    }),
  )
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(region(host, '.sidebar .sidebar-extras .extras #support')).toBeTruthy()
  expect(region(host, '.sidebar-body').childElementCount).toEqual(0)
})

test('footer rows keep the column in a section that has no groups', () => {
  const host = mounted(
    shell({
      navbar: { ...navbar, selected: 'directory' },
      sidebar: { footer: [{ id: 'help', label: 'Help', href: '/help' }] },
    }),
  )
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(labelsIn(region(host, '.sidebar-foot'))).toEqual(['Help'])
})

test('sidebar extras sit above the footer rows and below the nav', () => {
  const host = mounted(
    shell({
      sidebar: {
        ...filters,
        extras: div({ id: 'support' }, 'Support'),
        footer: [{ id: 'help', label: 'Help', href: '/help' }],
      },
    }),
  )
  const order = [...shellRoot(host).querySelector('.sidebar').children].map((node) =>
    node.className
  )
  expect(order).toEqual(['sidebar-head', 'sidebar-body', 'sidebar-extras', 'sidebar-foot'])
  expect(region(host, '.sidebar-extras #support')).toBeTruthy()
})

const mapped = () =>
  appMap({
    reports: {
      revenue: { group: 'Money' },
      costs: { group: 'Money', fixed: {} },
      churn: { group: 'People' },
    },
    projects: {
      $projectId: { builds: {}, settings: {} },
    },
    directory: { access: 'admin' },
    login: { nav: false },
  })

const projectOptions = [{ value: '1', label: 'Alpha' }, { value: '2', label: 'Beta' }]

const sessionHost = component('layout-session-host', {
  setup: (self, render) =>
    render(initState(self, 'layout.session', { roles: [] }), initState(self, 'layout.count', null)),
})

const roles = guard(
  ['layout.session'],
  (session, { need }) => session === undefined ? wait : session.roles.includes(need) || '/login',
)

const mountMapped = ({ icons, tags, breadcrumbs } = {}) => {
  const app = mapped()
  const bound = typeof icons === 'function' ? icons(app) : icons
  let host = null
  let session = null
  let count = null
  mounted(sessionHost((state, counter) => {
    session = state
    count = counter
    host = shell(
      {
        navbar: {
          label: 'Sections',
          map: app,
          icons: bound,
          tags: typeof tags === 'function' ? tags(app, counter) : tags,
        },
        sidebar: { label: 'Rows' },
        breadcrumbs,
      },
      router({
        map: app,
        access: roles,
        screens: {},
        options: { [app.projects.$projectId]: projectOptions },
      }),
    )
    return host
  }))
  return { app, host, session, count }
}

const hrefsIn = (node) =>
  [...node.querySelectorAll('li:not([hidden]) a')].map((link) => link.getAttribute('href'))

const markedIn = (node) =>
  [...node.querySelectorAll('[aria-current="page"]')].map((link) => link.getAttribute('href'))

const crumbsOf = (host) =>
  [...region(host, '.trail imp-breadcrumbs').shadowRoot.querySelectorAll('.crumb')]
    .map((crumb) => crumb.textContent)

test('a map gives the bar its sections and the sidebar the rows of the current section', () => {
  navigate('/reports/revenue')
  const { host } = mountMapped()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
  expect(
    [...region(host, '.sidebar-body').querySelectorAll('.group-title')].map((n) => n.textContent),
  ).toEqual(['Money', 'People'])
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/reports'])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/reports/revenue'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Reports')
})

test('a map with one section draws the sidebar-only layout', () => {
  const app = appMap({
    catalog: {
      path: '/',
      inputs: { button: {}, select: {} },
      layout: { shell: {} },
    },
    login: { nav: false },
  })
  navigate('/inputs/select')
  const host = mounted(shell(
    { logo: div({ id: 'brand' }, 'Acme'), navbar: { map: app }, extras: tools() },
    router({ map: app, screens: {} }),
  ))
  expect(classesOfShell(host)).toContain('bar-away')
  expect(classesOfShell(host)).not.toContain('has-navbar')
  expect(labelsIn(region(host, '.bar-nav'))).toEqual([])
  expect(region(host, '.sidebar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.sidebar-foot .tools #theme')).toBeTruthy()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Inputs', 'Button', 'Select', 'Layout'])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/inputs/select'])
})

test('a param node is a crumb with a picker, and its children are the sidebar', () => {
  navigate('/projects/1/builds')
  const { host } = mountMapped()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Builds', 'Settings'])
  expect(hrefsIn(region(host, '.sidebar-body'))).toEqual([
    '/projects/1/builds',
    '/projects/1/settings',
  ])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/projects/1/builds'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Alpha')
  expect(crumbsOf(host)).toEqual(['Projects', 'Alpha', 'Builds'])
  expect(classesOfShell(host)).toContain('has-trail')
  expect(region(host, '.bar-title .over').textContent).toEqual('Alpha')
  expect(region(host, '.bar-title .now').textContent).toEqual('Builds')
  const trail = region(host, '.trail imp-breadcrumbs').shadowRoot
  expect(trail.querySelector('.picker').getAttribute('aria-label')).toEqual('Change Alpha')
  expect([...trail.querySelectorAll('.option')].map((option) => option.getAttribute('href')))
    .toEqual(['/projects/1/builds', '/projects/2/builds'])
})

test('the nav follows a navigation, and the trail can be turned off', async () => {
  navigate('/reports/revenue')
  const { host } = mountMapped({ breadcrumbs: false })
  expect(region(host, '.trail')).toEqual(null)
  expect(classesOfShell(host)).not.toContain('has-trail')
  navigate('/projects/2/settings')
  await settled()
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/projects'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Builds', 'Settings'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Beta')
})

test('icons bind to sections and rows by handle', () => {
  navigate('/reports/revenue')
  const { host } = mountMapped({
    icons: (app) => ({ [app.reports]: div('r'), [app.reports.churn]: div('c') }),
  })
  expect(region(host, '.bar-nav .link .icon').textContent).toEqual('r')
  const churn = [...region(host, '.sidebar-body').querySelectorAll('.link')]
    .find((link) => link.textContent.includes('Churn'))
  expect(churn.querySelector('.icon').textContent).toEqual('c')
})

test('tags bind to rows by handle, and a state keeps the pill live', async () => {
  navigate('/reports/revenue')
  const { host, count } = mountMapped({
    tags: (app, counter) => ({ [app.reports]: { text: 'new' }, [app.reports.churn]: counter }),
  })
  count.set({ text: 3, color: 'blue' })
  await settled()
  const pillsIn = (node) => [...node.querySelectorAll('.tag')].map(renderedText)
  expect(pillsIn(region(host, '.bar-nav'))).toEqual(['new'])
  expect(pillsIn(region(host, '.sidebar-body'))).toEqual(['3'])
  count.set(null)
  await settled()
  expect(pillsIn(region(host, '.sidebar-body'))).toEqual([])
})

test('a section the access guard denies is not in the nav until it allows it', async () => {
  navigate('/reports/revenue')
  const { host, session } = mountMapped()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects'])
  session.set({ roles: ['admin'] })
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects', 'Directory'])
})

test('navbar items and the selected keys beside a map are reported and dropped', () => {
  const warn = warnings()
  const app = mapped()
  mounted(sessionHost(() =>
    shell(
      { navbar: { map: app, items: [], selected: 'x' }, sidebar: { selected: 'y' } },
      router({ map: app, access: roles, screens: {} }),
    )
  ))
  expect(warned(warn, "shell: 'navbar.items' is ignored beside a 'map'")).toBeTruthy()
  expect(warned(warn, "shell: 'navbar.selected' is ignored beside a 'map'")).toBeTruthy()
  expect(warned(warn, "shell: 'sidebar.selected' is ignored beside a 'map'")).toBeTruthy()
})

test('router({ scope }) makes the children of a tenant param the sections', async () => {
  const app = appMap({
    organizations: {
      $org: { projects: { $projectId: {} }, admin: {} },
    },
    userSettings: { nav: false, me: {} },
  })
  navigate('/organizations/acme/projects')
  const host = mounted(shell(
    { navbar: { label: 'Sections', map: app } },
    router({
      map: app,
      scope: app.organizations.$org,
      screens: {},
      options: { [app.organizations.$org]: [{ value: 'acme', label: 'Acme' }] },
    }),
  ))
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Projects', 'Admin'])
  expect(hrefsIn(region(host, '.bar-nav'))).toEqual([
    '/organizations/acme/projects',
    '/organizations/acme/admin',
  ])
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/organizations/acme/projects'])
  expect(crumbsOf(host)).toEqual(['Acme', 'Projects'])
  expect(app.organizations.$org.admin.href()).toEqual('/organizations/acme/admin')
  navigate('/user-settings/me')
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Organizations'])
  expect(crumbsOf(host)).toEqual(['User settings', 'Me'])
  expect(() => router({ map: app, scope: app.userSettings })).toThrow('scope is the param handle')
})
