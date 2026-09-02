import { component, mount } from 'imp'
import { div } from 'imp/html'
import { flex, shell, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame, renderedText } from './shadow.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const root = (host) => host.shadowRoot.querySelector('.root')

const classesOf = (host) => root(host).getAttribute('class')

const gapOf = (host) => root(host).style.getPropertyValue('--gap')

const navHost = component('layout-nav-host', {
  build: (_instance, build) => build(initState('layout.navOpen', false)),
})

const sectionHost = component('layout-section-host', {
  build: (_instance, build) => build(initState('layout.section', 'iconed')),
})

const authHost = component('layout-auth-host', {
  build: (_instance, build) => build(initState('layout.signedIn', true)),
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

test('stack has no vertical alignment prop', () => {
  const warn = warnings()
  mounted(stack({ verticalAlign: 'top' }))
  expect(warned(warn, "stack: unknown prop 'verticalAlign'")).toBeTruthy()
})

const shellRoot = (host) => host.shadowRoot.querySelector('.shell')

const region = (host, selector) => host.shadowRoot.querySelector(selector)

const drawerOf = (host) => region(host, '.drawer')

const burgerOf = (host) => region(host, '.hamburger')

const classesOfShell = (host) => shellRoot(host).getAttribute('class')

const ada = { name: 'Ada Lovelace', description: 'ada@example.com' }

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
  expect(region(host, '.sheet-head .title').textContent).toEqual('Second')
  expect(labelsIn(sheet)).toEqual(['Three'])
  click(sheet.querySelector('.link'))
  await settled()
  expect(states).toEqual(['open', 'closed'])
  expect(labelsIn(sheet)).toEqual([])
  expect(region(host, '.sidebar-body').querySelectorAll('.child').length).toEqual(3)
  expect(bar.querySelectorAll('.link').length).toEqual(2)
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
  expect(warned(warn, "shell: 'navbar' must be an object of { label, items, selected }"))
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
    shell({
      logo: div({ id: 'brand' }, 'Acme'),
      navbar,
      extras: div({ id: 'theme' }, 'theme'),
      account: ada,
    }),
  )
  expect(classesOfShell(host)).not.toContain('bar-away')
  expect(region(host, '.topbar .bar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.bar-body nav.bar-nav')).toBeTruthy()
  expect(region(host, '.bar-tools .tools #theme')).toBeTruthy()
  expect(region(host, '.bar-tools .tools imp-user-card')).toBeTruthy()
})

test('a sidebar without a navbar owns the logo and the tools, and the bar is dropped', () => {
  const host = mounted(
    shell({ logo: div({ id: 'brand' }, 'Acme'), sidebar: filters, account: ada }),
  )
  expect(classesOfShell(host)).toContain('bar-away')
  expect(region(host, '.sidebar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.sidebar-foot .tools imp-user-card')).toBeTruthy()
})

test('the account data becomes a userCard, and an unknown key is reported', () => {
  const warn = warnings()
  const host = mounted(shell({ navbar, account: { ...ada, role: 'admin' } }))
  expect(renderedText(region(host, 'imp-user-card'))).toContain('Ada Lovelace')
  expect(warned(warn, "shell: unknown 'account' key 'role'")).toBeTruthy()
})

test('the frame gets a hamburger that names and controls the drawer', () => {
  const host = mounted(shell({ navbar }))
  const burger = burgerOf(host)
  expect(burger.localName).toEqual('button')
  expect(burger.getAttribute('aria-label')).toEqual('Navigation')
  expect(burger.getAttribute('aria-controls')).toEqual(drawerOf(host).id)
  expect(burger.getAttribute('aria-expanded')).toEqual('false')
})

test('a frame with no chrome at all brings no drawer', () => {
  const bare = mounted(shell({ sidebar: filters }))
  expect(burgerOf(bare)).toEqual(null)
  expect(drawerOf(bare)).toEqual(null)
  const chromed = mounted(shell({ sidebar: filters, account: ada }))
  expect(burgerOf(chromed)).toBeTruthy()
  expect(drawerOf(chromed)).toBeTruthy()
})

test('signedIn false withholds the nav and shows the bar in its place', () => {
  const host = mounted(
    shell({ logo: div({ id: 'brand' }, 'Acme'), sidebar: filters, account: ada }),
  )
  expect(classesOfShell(host)).toContain('bar-away')
  const signedOut = mounted(
    shell({
      logo: div({ id: 'brand' }, 'Acme'),
      sidebar: filters,
      account: ada,
      signedIn: false,
    }),
  )
  expect(classesOfShell(signedOut)).toContain('signed-out')
  expect(classesOfShell(signedOut)).not.toContain('bar-away')
  expect(region(signedOut, '.topbar .bar-logo').firstElementChild.id).toEqual('brand')
  expect(region(signedOut, '.bar-tools .tools imp-user-card')).toBeTruthy()
})

test('signing out closes an open drawer and moves the chrome back into the bar', async () => {
  let signedIn = null
  let host = null
  mounted(authHost((state) => {
    signedIn = state
    host = shell({
      logo: div({ id: 'brand' }, 'Acme'),
      sidebar: filters,
      account: ada,
      signedIn: state,
    })
    return host
  }))
  expect(classesOfShell(host)).toContain('bar-away')
  click(burgerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  signedIn.set(false)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
  expect(classesOfShell(host)).toContain('signed-out')
  expect(region(host, '.topbar .bar-logo').firstElementChild.id).toEqual('brand')
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
  build: (_instance, build) =>
    build(initState('layout.footer', [{ id: 'help', label: 'Help', href: '/help' }])),
})

const sidebarDisplay = (host) => getComputedStyle(region(host, '.sidebar')).display

test('signedIn false hides the sidebar column on the desktop, not just its rows', () => {
  const host = mounted(shell({ navbar, account: ada, signedIn: false }))
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(sidebarDisplay(host)).toEqual('none')
  expect(getComputedStyle(shellRoot(host)).getPropertyValue('--sidebar-track')).toEqual('0px')
})

test('a footer state update keeps the account card in the sidebar foot', async () => {
  let footer = null
  let host = null
  mounted(footerHost((state) => {
    footer = state
    host = shell({ sidebar: { ...filters, footer: state }, account: ada })
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

test('shell paints a background node under everything, hidden from assistive technology', () => {
  const host = mounted(shell({ navbar, background: div({ id: 'sky' }, 'sky') }, div('page')))
  const backdrop = shellRoot(host).firstElementChild
  expect(backdrop.classList.contains('backdrop')).toBeTruthy()
  expect(backdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(backdrop.querySelector('#sky')).toBeTruthy()
  expect(region(mounted(shell({ navbar })), '.backdrop')).toEqual(null)
})

test('shell gap floats the panels apart from a spacing step', () => {
  const host = mounted(shell({ navbar, gap: 3 }))
  expect(classesOfShell(host)).toContain('gapped')
  expect(shellRoot(host).style.getPropertyValue('--frame-gap')).toContain('--imp-space-3')
})

test('a gapped shell publishes its inset and radius for the drawers inside it', () => {
  const published = region(mounted(shell({ navbar, gap: 3 })), '.shell').style
  expect(published.getPropertyValue('--imp-shell-frame-gap')).toContain('--imp-space-3')
  expect(published.getPropertyValue('--imp-shell-frame-radius')).toContain('--imp-radius-lg')
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
