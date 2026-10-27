import { appMap, component, mount } from 'imp'
import { div } from 'imp/html'
import { flex, stack } from 'imp/std/layout'
import { shell } from 'imp/std/shell'
import { navigate, redirect, router, wait } from 'imp/router'
import { beforeEach, expect, spy, test } from 'imp/test'
import { nextFrame, renderedText } from './shadow.js'
import { initState, useState } from 'imp/state'

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

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const pointerDown = (node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

const escape = (node) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))

const settled = async () => {
  for (let tick = 0; tick < 3; tick += 1) await Promise.resolve()
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve))

const closeOf = (dialog) =>
  new Promise((resolve) => dialog.addEventListener('close', () => resolve(), { once: true }))

const takesFocus = (node) => {
  node.focus()
  return document.activeElement === node
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
  expect(sheet).toContain('.joined > :not(:first-child)')
  expect(sheet).toContain('--imp-corner-inline-start: 0')
  expect(sheet).toContain('.joined > :not(:last-child)')
  expect(sheet).toContain('--imp-corner-inline-end: 0')
})

test('flex warns about a gap on a joined row and ignores it', () => {
  const warn = spy(console, 'warn', () => {})
  const host = mounted(flex({ joined: true, gap: 4 }, div('a'), div('b')))
  expect(warn.calls.some(([first]) => String(first).includes('a joined row has no gap'))).toEqual(
    true,
  )
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
  host.style.blockSize = '300px'
  expect(getComputedStyle(host).display).toEqual('block')
  expect(getComputedStyle(root(host)).blockSize).toEqual('300px')
  expect(getComputedStyle(root(host)).justifyContent).toEqual('space-between')
  expect(
    getComputedStyle(root(mounted(stack({ verticalAlign: 'bottom' })))).justifyContent,
  ).toEqual('flex-end')
})

const shellRoot = (host) => host.shadowRoot.querySelector('.shell')

const region = (host, selector) => host.shadowRoot.querySelector(selector)

const drawerOf = (host) => region(host, '.drawer')

const burgerOf = (host) => region(host, '.hamburger')

const classesOfShell = (host) => shellRoot(host).getAttribute('class')

const tools = () => div({ id: 'theme' }, 'theme')

const reportsMap = () =>
  appMap({
    reports: {
      money: { revenue: {}, costs: { fixed: {} } },
      people: { churn: {} },
    },
    directory: {},
  })

const groupedNav = (app) => ({
  [app.reports.money]: { group: true },
  [app.reports.people]: { group: true },
  [app.reports.money.revenue]: { icon: div('r') },
  [app.reports.money.costs]: { icon: div('c') },
  [app.reports.people.churn]: { icon: div('p') },
})

const routed = (app, props, path, screens = {}) => {
  navigate(path)
  return mounted(shell({ map: app, ...props }, router({ map: app, screens })))
}

const reportsShell = (props = {}, path = '/reports/money/revenue') => {
  const app = reportsMap()
  return routed(app, { nav: groupedNav(app), ...props }, path)
}

const reportsNav = (extra) => {
  const app = reportsMap()
  return { app, nav: { ...groupedNav(app), ...extra(app) } }
}

const catalogMap = () => appMap({ first: { one: {}, two: {} }, second: { three: {} } })

const catalogShell = (path = '/first/two', props = {}) => {
  const app = catalogMap()
  const nav = { [app.first]: { icon: div('1') }, [app.second]: { icon: div('2') } }
  const screens = { [app.first]: () => div('first'), [app.second]: () => div('second') }
  return routed(app, { navbar: false, nav, ...props }, path, screens)
}

const framed = (props) => mounted(shell(props, div('page')))

const labelsIn = (node) =>
  [...node.querySelectorAll('li:not([hidden]) .link .label')].map((n) => n.textContent)

const titlesIn = (node) => [...node.querySelectorAll('.group-title')].map((n) => n.textContent)

test('shell renders the frame landmarks and puts its children in main', () => {
  const host = framed({ logo: div('Acme') })
  expect(host.localName).toEqual('imp-shell')
  expect(region(host, 'header.topbar').localName).toEqual('header')
  expect(region(host, 'main.main').localName).toEqual('main')
  expect(renderedText(region(host, 'main.main'))).toEqual('page')
})

test('shell leaves its main region unnamed without an effect', () => {
  const host = framed({})
  expect(region(host, 'main.main').style.getPropertyValue('view-transition-name')).toEqual('')
})

test('shell names its main region as the screen for an effect, and rejects an unknown one', () => {
  const warn = warnings()
  const fading = framed({ effect: 'fade' })
  expect(region(fading, 'main.main').style.getPropertyValue('view-transition-name')).toEqual(
    'imp-screen',
  )
  const sheet = document.adoptedStyleSheets.at(-1)
  const fadeRules = [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
  expect(fadeRules).toContain('imp-screen-fade-in')
  expect(fadeRules).toContain('pointer-events: none')
  document.body.replaceChildren()
  const sliding = framed({ effect: 'slide' })
  expect(region(sliding, 'main.main').style.getPropertyValue('view-transition-name')).toEqual(
    'imp-screen',
  )
  const slideRules = [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
  expect(slideRules).toContain('imp-screen-slide-in')
  document.body.replaceChildren()
  framed({ effect: 'spin' })
  expect(warned(warn, "'effect' must be one of")).toEqual(true)
})

test('shell renders only the regions it is given', () => {
  const host = mounted(shell(div('page')))
  expect(region(host, 'header.topbar')).toEqual(null)
  expect(classesOfShell(host)).not.toContain('has-sidebar')
  expect(classesOfShell(host)).not.toContain('has-bottom-bar')
  expect(region(host, 'main.main')).toBeTruthy()
})

test('shell brings the nav landmarks its own nav data needs', () => {
  const host = reportsShell({ navbar: { label: 'Sections' }, sidebar: { label: 'Reports' } })
  expect(region(host, 'nav.bar-nav').getAttribute('aria-label')).toEqual('Sections')
  expect(region(host, 'nav.sidebar-body').getAttribute('aria-label')).toEqual('Reports')
  expect(region(host, 'nav.bottombar').getAttribute('aria-label')).toEqual('Reports')
})

test('shell names an unlabelled nav for what it is', () => {
  const host = reportsShell()
  expect(region(host, 'nav.bar-nav').getAttribute('aria-label')).toEqual('Navigation')
  expect(region(host, 'nav.sidebar-body').getAttribute('aria-label')).toEqual('Section')
})

test('the top-level nodes are the bar, and the children of the current one are the sidebar', () => {
  const host = reportsShell()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Directory'])
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
  expect(titlesIn(region(host, '.sidebar-body'))).toEqual(['Money', 'People'])
})

test('a group heading is not a link, and it names the list of its rows', () => {
  const host = reportsShell()
  const title = region(host, '.sidebar-body .group-title')
  expect(title.querySelector('a')).toEqual(null)
  expect(title.nextElementSibling.getAttribute('aria-labelledby')).toEqual(title.id)
})

test('a section with no children renders no sidebar at all', () => {
  const host = reportsShell({}, '/directory')
  expect(classesOfShell(host)).not.toContain('has-sidebar')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual([])
})

const parentLink = (host, label) =>
  [...region(host, '.sidebar-body').querySelectorAll('.link')].find((link) =>
    link.textContent.includes(label),
  )

test('the parent of the selected row starts expanded, the others collapsed', () => {
  const host = catalogShell()
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

const tap = (node) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

const barLink = (host, label) =>
  [...region(host, '.bottombar').querySelectorAll('.link')].find((link) =>
    link.textContent.includes(label),
  )

test('on a phone a parent row in the bottom bar opens its children in the sheet', async () => {
  const host = onAPhone(() => catalogShell())
  await nextFrame()
  const sheet = region(host, '.sheet')
  const second = barLink(host, 'Second')
  expect(second).toBeTruthy()
  const states = []
  sheet.addEventListener('toggle', (event) => states.push(event.newState))
  tap(second)
  await nextTask()
  expect(states).toEqual(['open'])
  expect(location.pathname).toEqual('/first/two')
  expect(second.classList.contains('sheet-anchor')).toBeTruthy()
  expect(second.style.anchorName || '').toEqual('')
  expect(region(host, '.sheet-head .title').textContent).toEqual('Second')
  expect(labelsIn(sheet)).toEqual(['Three'])
  tap(sheet.querySelector('ul .link'))
  await settled()
  await nextTask()
  expect(location.pathname).toEqual('/second/three')
  expect(states).toEqual(['open', 'closed'])
  expect(labelsIn(sheet)).toEqual([])
  expect(region(host, '.sidebar-body').querySelectorAll('.child').length).toEqual(3)
  expect(region(host, '.bottombar').querySelectorAll('.link').length).toEqual(2)
})

test('on a phone the title of the children sheet links to the parent page', async () => {
  const host = onAPhone(() => catalogShell())
  await nextFrame()
  const sheet = region(host, '.sheet')
  const states = []
  sheet.addEventListener('toggle', (event) => states.push(event.newState))
  tap(barLink(host, 'Second'))
  await nextTask()
  expect(states).toEqual(['open'])
  const title = region(host, '.sheet-head .title .title-link')
  expect(title.localName).toEqual('a')
  expect(title.getAttribute('href')).toEqual('/second')
  expect(title.textContent).toEqual('Second')
  expect(title.hasAttribute('aria-current')).toEqual(false)
  expect(labelsIn(sheet)).toEqual(['Three'])
  tap(title)
  await settled()
  await nextTask()
  expect(location.pathname).toEqual('/second')
  expect(states).toEqual(['open', 'closed'])
  document.body.replaceChildren()
  const onParent = onAPhone(() => catalogShell('/second'))
  await nextFrame()
  tap(barLink(onParent, 'Second'))
  expect(region(onParent, '.sheet-head .title .title-link').getAttribute('aria-current')).toEqual(
    'page',
  )
})

test('on a phone the More button sizes its box the same way as the rows beside it', async () => {
  const app = appMap({ one: {}, two: {}, three: {}, four: {}, five: {} })
  const host = onAPhone(() => routed(app, { navbar: false }, '/one'))
  await nextFrame()
  const bar = region(host, '.bottombar')
  const more = bar.querySelector('button.more')
  const row = bar.querySelector('a.link')
  expect(more).toBeTruthy()
  expect(getComputedStyle(more).boxSizing).toEqual('border-box')
  expect(getComputedStyle(more).boxSizing).toEqual(getComputedStyle(row).boxSizing)
})

test('a folded parent stays folded until the selection moves to another parent', async () => {
  const host = catalogShell()
  const parent = parentLink(host, 'First')
  expect(parent.getAttribute('aria-expanded')).toEqual('true')
  tap(parent)
  await settled()
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  navigate('/first/one')
  await settled()
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['First', 'Second'])
  navigate('/second/three')
  await settled()
  expect(parentLink(host, 'Second').getAttribute('aria-expanded')).toEqual('true')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['First', 'Second', 'Three'])
})

test('a child row is hidden until its parent is expanded', () => {
  const host = reportsShell()
  const parent = parentLink(host, 'Costs')
  expect(parent.getAttribute('aria-expanded')).toEqual('false')
  expect(labelsIn(region(host, '.sidebar-body'))).not.toContain('Fixed')
  tap(parent)
  expect(parent.getAttribute('aria-expanded')).toEqual('true')
  expect(labelsIn(region(host, '.sidebar-body'))).toContain('Fixed')
})

test('the rail toggle is withheld while any row lacks an icon', () => {
  const app = appMap({ one: {}, two: {} })
  const plain = routed(app, { navbar: false, nav: { [app.one]: { icon: div('i') } } }, '/one')
  expect(region(plain, '.rail-toggle').hidden).toEqual(true)
  expect(getComputedStyle(region(plain, '.rail-toggle')).display).toEqual('none')
  const iconed = routed(
    app,
    { navbar: false, nav: { [app.one]: { icon: div('i') }, [app.two]: { icon: div('t') } } },
    '/one',
  )
  expect(region(iconed, '.rail-toggle').hidden).toEqual(false)
  expect(getComputedStyle(region(iconed, '.rail-toggle')).display).toEqual('flex')
})

test('switching to a section whose rows lack icons expands the rail and hides the toggle', async () => {
  const app = appMap({ iconed: { a: {} }, plain: { b: {} } })
  const host = routed(app, { nav: { [app.iconed.a]: { icon: div('i') } } }, '/iconed/a')
  const toggle = region(host, '.rail-toggle')
  expect(toggle.hidden).toEqual(false)
  click(toggle)
  expect(shellRoot(host).classList.contains('rail')).toEqual(true)
  navigate('/plain/b')
  await settled()
  expect(toggle.hidden).toEqual(true)
  expect(shellRoot(host).classList.contains('rail')).toEqual(false)
})

test('the rail toggle collapses the sidebar to icons', () => {
  const host = reportsShell()
  const toggle = region(host, '.rail-toggle')
  expect(toggle.getAttribute('aria-expanded')).toEqual('true')
  expect(toggle.getAttribute('aria-label')).toEqual('Collapse the sidebar')
  click(toggle)
  expect(shellRoot(host).classList.contains('rail')).toEqual(true)
  expect(toggle.getAttribute('aria-expanded')).toEqual('false')
  expect(toggle.getAttribute('aria-label')).toEqual('Expand the sidebar')
})

test('in the rail a row keeps its label for a screen reader and shows it as a tooltip', () => {
  const host = reportsShell()
  const link = region(host, '.sidebar-body .link')
  const tip = link.parentElement.querySelector('.tip')
  const open = () => tip.matches(':popover-open')
  expect(tip.getAttribute('popover')).toEqual('manual')
  expect(tip.textContent).toEqual(link.querySelector('.label').textContent)
  link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(open()).toEqual(false)
  click(region(host, '.rail-toggle'))
  expect(getComputedStyle(link.querySelector('.label')).display).not.toEqual('none')
  link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(open()).toEqual(true)
  link.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  expect(open()).toEqual(false)
})

test('shell marks which regions are present', () => {
  const host = reportsShell()
  expect(classesOfShell(host)).toContain('has-navbar')
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(classesOfShell(reportsShell({ navbar: false }))).not.toContain('has-navbar')
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
  const host = reportsShell({ navbar: div('bar') })
  expect(
    warned(warn, "shell: 'navbar' must be an object of { label, background, hidden }"),
  ).toBeTruthy()
  expect(region(host, 'nav.bar-nav').getAttribute('aria-label')).toEqual('Navigation')
})

test('a nav region reports an unknown key, and the map binds the nav', () => {
  const warn = warnings()
  const removedNavbarKeys = { map: reportsMap(), items: [] }
  const removedSidebarKeys = { label: 'Rows', footer: [] }
  framed({ navbar: removedNavbarKeys, sidebar: removedSidebarKeys })
  expect(warned(warn, "shell: unknown 'navbar' key 'map'")).toBeTruthy()
  expect(warned(warn, "shell: unknown 'navbar' key 'items'")).toBeTruthy()
  expect(warned(warn, "shell: unknown 'sidebar' key 'footer'")).toBeTruthy()
})

test('a bar owns the logo and the tools', () => {
  const host = reportsShell({ logo: div({ id: 'brand' }, 'Acme'), extras: tools() })
  expect(classesOfShell(host)).not.toContain('bar-away')
  expect(region(host, '.topbar .bar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.bar-body nav.bar-nav')).toBeTruthy()
  expect(region(host, '.bar-tools .tools #theme')).toBeTruthy()
})

test('navbar false drops the bar, and the sidebar owns the logo and the tools', () => {
  const host = reportsShell({ logo: div({ id: 'brand' }, 'Acme'), navbar: false, extras: tools() })
  expect(classesOfShell(host)).toContain('bar-away')
  expect(region(host, 'nav.bar-nav')).toEqual(null)
  expect(region(host, '.sidebar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.sidebar-foot .tools #theme')).toBeTruthy()
})

test('navbar hidden drops the bar like false, and still paints the top bar of a phone', () => {
  const warn = warnings()
  const host = reportsShell({ navbar: { hidden: true, background: div({ id: 'bar-sky' }) } })
  expect(region(host, 'nav.bar-nav')).toEqual(null)
  expect(classesOfShell(host)).not.toContain('has-navbar')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual([
    'Reports',
    'Money',
    'People',
    'Directory',
  ])
  expect(region(host, '.topbar > .backdrop #bar-sky')).toBeTruthy()
  reportsShell({ navbar: { hidden: 'yes' } })
  expect(warned(warn, "'navbar.hidden' must be true or false")).toBeTruthy()
})

test('an account prop is reported and dropped', () => {
  const warn = warnings()
  framed({ account: { name: 'Ada' } })
  expect(warned(warn, "shell: unknown prop 'account'")).toBeTruthy()
})

test('the frame gets a hamburger that names and controls the drawer', () => {
  const host = reportsShell()
  const burger = burgerOf(host)
  expect(burger.localName).toEqual('button')
  expect(burger.getAttribute('aria-label')).toEqual('Menu')
  expect(drawerOf(host).getAttribute('aria-label')).toEqual('Menu')
  expect(burger.getAttribute('aria-controls')).toEqual(drawerOf(host).id)
  expect(burger.getAttribute('aria-expanded')).toEqual('false')
})

test('a frame with no chrome at all brings no drawer', () => {
  const bare = catalogShell()
  expect(burgerOf(bare)).toEqual(null)
  expect(drawerOf(bare)).toEqual(null)
  const chromed = catalogShell('/first/two', { extras: tools() })
  expect(burgerOf(chromed)).toBeTruthy()
  expect(drawerOf(chromed)).toBeTruthy()
})

test('the hamburger opens the drawer and reports it', () => {
  const opened = []
  const host = reportsShell({ events: { navToggle: (e) => opened.push(e.detail.open) } })
  click(burgerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  expect(burgerOf(host).getAttribute('aria-expanded')).toEqual('true')
  expect(opened).toEqual([true])
})

test('closing the drawer waits for the slide to finish', async () => {
  const opened = []
  const host = reportsShell({ events: { navToggle: (e) => opened.push(e.detail.open) } })
  click(burgerOf(host))
  click(burgerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
  expect(burgerOf(host).getAttribute('aria-expanded')).toEqual('false')
  expect(opened).toEqual([true, false])
})

test('escape dismisses the drawer through the same closing slide', async () => {
  const host = reportsShell()
  click(burgerOf(host))
  escape(drawerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('clicking the backdrop dismisses the drawer', async () => {
  const host = reportsShell()
  click(burgerOf(host))
  pointerDown(drawerOf(host))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('a drag that starts inside the drawer leaves it open', async () => {
  const host = reportsShell()
  click(burgerOf(host))
  pointerDown(region(host, '.drawer-body'))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(true)
})

test('the open drawer takes focus, inerts the page and holds the page scroll', async () => {
  const host = reportsShell()
  const outside = document.body.appendChild(document.createElement('button'))
  outside.focus()
  click(burgerOf(host))
  expect(host.shadowRoot.activeElement).not.toEqual(null)
  expect(takesFocus(outside)).toEqual(false)
  expect(document.documentElement.style.overflow).toEqual('hidden')
  const closed = closeOf(drawerOf(host))
  click(burgerOf(host))
  await closed
  expect(document.activeElement).toEqual(outside)
  expect(takesFocus(outside)).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('')
})

test('navOpen drives the drawer and is written back when it closes itself', async () => {
  const app = reportsMap()
  let navOpen = null
  let host = null
  navigate('/reports/money/revenue')
  mounted(
    navHost((state) => {
      navOpen = state
      host = shell({ map: app, navOpen: state }, router({ map: app, screens: {} }))
      return host
    }),
  )
  navOpen.set(true)
  expect(drawerOf(host).open).toEqual(true)
  click(burgerOf(host))
  expect(navOpen.get()).toEqual(false)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('a cancelled select event skips the href', async () => {
  const host = reportsShell({ events: { select: (event) => event.preventDefault() } })
  tap(parentLink(host, 'Churn'))
  await settled()
  expect(location.pathname).toEqual('/reports/money/revenue')
})

test('a row draws its icon before its label', () => {
  const mark = document.createElement('svg')
  const { app, nav } = reportsNav((map) => ({ [map.reports.money.revenue]: { icon: mark } }))
  const host = routed(app, { nav }, '/reports/money/revenue')
  const link = region(host, '.sidebar-body .link')
  expect(link.firstElementChild.getAttribute('class')).toEqual('icon')
  expect(link.firstElementChild.firstElementChild).toEqual(mark)
})

const taggedShell = (handleOf, tag) => {
  const { app, nav } = reportsNav((map) => ({
    [handleOf(map)]: { ...groupedNav(map)[handleOf(map)], tag },
  }))
  return routed(app, { nav }, '/reports/money/revenue')
}

test('a row tag renders as a tag component in the requested color', () => {
  const host = taggedShell((app) => app.reports.money.revenue, { text: 'overdue', color: 'red' })
  const pill = region(host, '.sidebar-body .link imp-tag').shadowRoot.querySelector('.tag')
  expect(renderedText(pill)).toEqual('overdue')
  expect(pill.classList.contains('color-red')).toBeTruthy()
})

test('a group tag renders beside the group heading', () => {
  const host = taggedShell((app) => app.reports.money, { text: 2 })
  const title = region(host, '.sidebar-body .group-title')
  expect(renderedText(title)).toEqual('Money2')
  expect(region(host, '.sidebar-body ul').getAttribute('aria-labelledby')).toEqual(title.id)
})

const describedText = (node) => {
  const id = node.getAttribute('aria-describedby')
  return id === null ? null : (node.getRootNode().getElementById(id)?.textContent ?? null)
}

test('a row tag with a title describes its link and shows the title on hover', () => {
  const host = taggedShell((app) => app.reports.money.revenue, {
    text: 'main +2',
    title: 'main, backup, eu-west',
  })
  const link = region(host, '.sidebar-body .link')
  expect(describedText(link)).toEqual('main, backup, eu-west')
  expect(link.querySelector('.tag').getAttribute('title')).toEqual('main, backup, eu-west')
  expect(renderedText(link.querySelector('.label'))).toEqual('Revenue')
  expect(link.querySelector('.tag [hidden]').textContent).toEqual('main, backup, eu-west')
})

test('a tag with no title adds no description', () => {
  const host = taggedShell((app) => app.reports.money.revenue, { text: 1 })
  const link = region(host, '.sidebar-body .link')
  expect(link.hasAttribute('aria-describedby')).toEqual(false)
  expect(link.querySelector('.tag').hasAttribute('title')).toEqual(false)
})

test('a group tag with a title describes the list of the group', () => {
  const host = taggedShell((app) => app.reports.money, { text: 2, title: '2 tasks are late' })
  expect(describedText(region(host, '.sidebar-body ul'))).toEqual('2 tasks are late')
})

test('a tag without text is logged and dropped', () => {
  const warn = warnings()
  const host = taggedShell((app) => app.reports.money.revenue, { color: 'red' })
  expect(warned(warn, "a 'tag' must be an object")).toBeTruthy()
  expect(region(host, '.sidebar-body imp-tag')).toEqual(null)
})

test('the bottom bar is named for the sections when it carries them', () => {
  const labels = { navbar: { label: 'Sections' }, sidebar: { label: 'Reports' } }
  const host = reportsShell(labels, '/directory')
  expect(region(host, 'nav.bottombar').getAttribute('aria-label')).toEqual('Sections')
  const withRows = reportsShell(labels)
  expect(region(withRows, 'nav.bottombar').getAttribute('aria-label')).toEqual('Reports')
})

test('shell puts a skip link first, and it moves the focus to the main region', () => {
  const host = reportsShell()
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
  const host = framed({ background: div({ id: 'sky' }, 'sky') })
  const backdrop = shellRoot(host).firstElementChild
  expect(backdrop.classList.contains('backdrop')).toBeTruthy()
  expect(backdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(backdrop.querySelector('#sky')).toBeTruthy()
  expect(region(framed({}), '.backdrop')).toEqual(null)
})

test('the bar and the column each paint their own background node, hidden the same way', () => {
  const host = reportsShell({
    navbar: { background: div({ id: 'bar-sky' }) },
    sidebar: { background: div({ id: 'column-sky' }) },
  })
  const barBackdrop = region(host, '.topbar > .backdrop')
  expect(barBackdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(barBackdrop.querySelector('#bar-sky')).toBeTruthy()
  const columnBackdrop = region(host, '.sidebar > .backdrop')
  expect(columnBackdrop.getAttribute('aria-hidden')).toEqual('true')
  expect(columnBackdrop.querySelector('#column-sky')).toBeTruthy()
  expect(region(host, '.shell > .backdrop')).toEqual(null)
})

test('on a phone the background of the column moves into the drawer', () => {
  const host = onAPhone(() => reportsShell({ sidebar: { background: div({ id: 'column-sky' }) } }))
  expect(region(host, '.drawer > .backdrop #column-sky')).toBeTruthy()
  expect(region(host, '.sidebar > .backdrop')).toEqual(null)
})

test('shell gap floats the panels apart from a spacing step', () => {
  const host = framed({ gap: 3 })
  expect(classesOfShell(host)).toContain('gapped')
  expect(shellRoot(host).style.getPropertyValue('--frame-gap')).toContain('--imp-space-3')
})

test('a gapped shell publishes its inset and radius for the drawers inside it', () => {
  const published = region(framed({ gap: 3 }), '.shell').style
  expect(published.getPropertyValue('--imp-shell-frame-gap')).toContain('--imp-space-3')
  expect(published.getPropertyValue('--imp-shell-frame-radius')).toContain('--imp-radius-container')
  const flush = region(framed({}), '.shell').style
  expect(flush.getPropertyValue('--imp-shell-frame-gap')).toEqual('')
  expect(flush.getPropertyValue('--imp-shell-frame-radius')).toEqual('')
})

test('shell without a gap, or with step 0, is the edge-to-edge frame', () => {
  for (const host of [framed({}), framed({ gap: 0 })]) {
    expect(classesOfShell(host)).not.toContain('gapped')
    expect(shellRoot(host).style.getPropertyValue('--frame-gap')).toEqual('')
  }
})

test('shell limits the frame to 125rem by default and publishes the inset', () => {
  const host = framed({})
  expect(classesOfShell(host)).toContain('limited')
  const published = shellRoot(host).style
  expect(published.getPropertyValue('--page-max')).toEqual('125rem')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toEqual(
    'max(0px, calc((100% - 125rem) / 2))',
  )
})

test('shell maxWidth takes a CSS length, and a gap joins the inset', () => {
  const host = framed({ maxWidth: '90rem', gap: 3 })
  const published = shellRoot(host).style
  expect(published.getPropertyValue('--page-max')).toEqual('90rem')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toContain('--imp-space-3')
  expect(published.getPropertyValue('--imp-shell-frame-inset')).toContain('90rem')
})

test('shell maxWidth none lifts the limit and keeps the gap as the inset', () => {
  const flush = framed({ maxWidth: 'none' })
  expect(classesOfShell(flush)).not.toContain('limited')
  expect(shellRoot(flush).style.getPropertyValue('--page-max')).toEqual('')
  expect(shellRoot(flush).style.getPropertyValue('--imp-shell-frame-inset')).toEqual('')
  const gapped = framed({ maxWidth: 'none', gap: 3 })
  expect(shellRoot(gapped).style.getPropertyValue('--imp-shell-frame-inset')).toContain(
    '--imp-space-3',
  )
})

test('shell warns and uses the default for a maxWidth that is not a string', () => {
  const warn = warnings()
  const host = framed({ maxWidth: 90 })
  expect(warned(warn, "shell: 'maxWidth' must be a CSS length")).toBeTruthy()
  expect(shellRoot(host).style.getPropertyValue('--page-max')).toEqual('125rem')
})

test('the top bar keeps its controls in a bar box that the frame centres', () => {
  const host = reportsShell({ logo: div({ id: 'brand' }) })
  expect(region(host, '.topbar > .bar > .bar-logo #brand')).toBeTruthy()
  expect(region(host, '.topbar > .bar > .bar-body')).toBeTruthy()
})

test('shell warns and drops a gap that is not a spacing step', () => {
  const warn = warnings()
  const host = framed({ gap: '1rem' })
  expect(warned(warn, "shell: 'gap' must be a spacing step")).toBeTruthy()
  expect(classesOfShell(host)).not.toContain('gapped')
})

test('sidebar extras keep the column in a section that has no children', () => {
  const host = reportsShell(
    { sidebar: { extras: div({ id: 'support' }, 'Support') } },
    '/directory',
  )
  expect(classesOfShell(host)).toContain('has-sidebar')
  expect(region(host, '.sidebar .sidebar-extras .extras #support')).toBeTruthy()
  expect(region(host, '.sidebar-body').childElementCount).toEqual(0)
})

test('sidebar extras sit below the nav and above the foot', () => {
  const host = catalogShell('/first/two', {
    sidebar: { extras: div({ id: 'support' }, 'Support') },
    extras: tools(),
  })
  const order = [...shellRoot(host).querySelector('.sidebar').children].map(
    (node) => node.className,
  )
  expect(order).toEqual(['sidebar-head', 'sidebar-body', 'sidebar-extras', 'sidebar-foot'])
  expect(region(host, '.sidebar-extras #support')).toBeTruthy()
  expect(region(host, '.sidebar-foot .tools #theme')).toBeTruthy()
})

const mapped = () =>
  appMap({
    reports: {
      money: { revenue: {}, costs: { fixed: {} } },
      people: { churn: {} },
    },
    projects: {
      $projectId: { builds: {}, settings: {} },
    },
    directory: {},
    login: {},
  })

const PROJECT_NAMES = { 1: 'Alpha', 2: 'Beta' }

const projectScreen = component('layout-project-screen', {
  setup: (self, { projectId }) => {
    useState(self, 'imp.routeLabels').set((all) => ({
      ...all,
      $projectId: PROJECT_NAMES[projectId],
    }))
    return div({ id: 'project' })
  },
})

const navOf = (app, extra = {}) => ({
  [app.login]: { hidden: true },
  [app.reports.money]: { group: true },
  [app.reports.people]: { group: true },
  ...extra,
})

const sessionHost = component('layout-session-host', {
  setup: (self, render) =>
    render(initState(self, 'layout.session', { roles: [] }), initState(self, 'layout.count', null)),
})

const admin = {
  states: ['layout.session'],
  check: (session) => (session === undefined ? wait : session.roles.includes('admin') || '/login'),
}

const mountMapped = ({ nav = () => ({}), breadcrumbs } = {}) => {
  const app = mapped()
  let host = null
  let session = null
  let count = null
  mounted(
    sessionHost((state, counter) => {
      session = state
      count = counter
      host = shell(
        {
          map: app,
          nav: navOf(app, nav(app)),
          navbar: { label: 'Sections' },
          sidebar: { label: 'Rows' },
          breadcrumbs,
        },
        router({
          map: app,
          guards: { [app.directory]: admin },
          screens: {
            [app.projects.$projectId.builds]: ({ params }) => projectScreen(params),
            [app.projects.$projectId.settings]: ({ params }) => projectScreen(params),
          },
        }),
      )
      return host
    }),
  )
  return { app, host, session, count }
}

const gateHost = component('layout-gate-host', {
  setup: (self, render) => render(initState(self, 'layout.session', undefined)),
})

const gateOf = (host) => region(host, 'main.gate')

const signInScreens = (app) => ({
  [app.login]: () => div({ id: 'login' }),
  [app.directory]: () => div({ id: 'directory' }),
  [app.reports]: () => div({ id: 'reports' }),
})

const mountSignIn = () => {
  const app = mapped()
  let session = null
  let host = null
  mounted(
    gateHost((state) => {
      session = state
      host = shell(
        {
          map: app,
          nav: { [app.login]: { hidden: true } },
          logo: div({ id: 'brand' }),
          extras: tools(),
          signIn: app.login,
        },
        router({
          map: app,
          guards: { [app.directory]: admin },
          screens: signInScreens(app),
          loading: () => div({ id: 'loading' }),
        }),
      )
      return host
    }),
  )
  return { app, host, session }
}

test('the sign-in node shows its screen under the logo, and no chrome', async () => {
  navigate('/login')
  const { host } = mountSignIn()
  await settled()
  expect(classesOfShell(host)).toContain('bare')
  expect(gateOf(host).querySelector('.gate-body imp-router')).toBeTruthy()
  expect(gateOf(host).querySelector('.gate-logo #brand')).toBeTruthy()
  expect(region(host, 'header.topbar')).toEqual(null)
  expect(region(host, 'main.main')).toEqual(null)
  expect(host.shadowRoot.querySelector('#theme')).toEqual(null)
})

test('a waiting verdict shows the loading content with no chrome, and an allow shows the app', async () => {
  navigate('/directory')
  const { host, session } = mountSignIn()
  await settled()
  expect(classesOfShell(host)).toContain('bare')
  expect(region(host, 'header.topbar')).toEqual(null)
  session.set({ roles: ['admin'] })
  await settled()
  expect(classesOfShell(host)).not.toContain('bare')
  expect(gateOf(host)).toEqual(null)
  expect(region(host, 'header.topbar')).toBeTruthy()
  expect(region(host, 'main.main imp-router')).toBeTruthy()
  expect(region(host, '.bar-logo #brand')).toBeTruthy()
})

test('a view that renders while the frame is bare moves into the main region with the chrome', async () => {
  const app = mapped()
  const removed = []
  const probe = component('layout-gate-probe', {
    setup: () => div({ id: 'probe' }),
    onRemove: () => removed.push('probe'),
  })
  let host = null
  let session = null
  navigate('/directory')
  mounted(
    gateHost((state) => {
      session = state
      host = shell(
        { map: app, signIn: app.login },
        state.view((user) => user && probe()),
        router({ map: app, guards: { [app.directory]: admin }, screens: signInScreens(app) }),
      )
      return host
    }),
  )
  await settled()
  session.set({ roles: ['admin'] })
  await settled()
  expect(classesOfShell(host)).not.toContain('bare')
  expect(region(host, 'main.main imp-router')).toBeTruthy()
  expect(region(host, 'main.main layout-gate-probe')).toBeTruthy()
  expect(removed).toEqual([])
})

test('the logo stays on the page while the chrome mounts after a waiting verdict', async () => {
  const app = mapped()
  const brand = div({ id: 'brand' })
  const seen = []
  const brandProbe = component('layout-brand-probe', {
    setup: () => {
      seen.push(brand.isConnected)
      return div('tools')
    },
  })
  let session = null
  navigate('/directory')
  mounted(
    gateHost((state) => {
      session = state
      return shell(
        { map: app, logo: brand, extras: brandProbe(), signIn: app.login },
        router({ map: app, guards: { [app.directory]: admin }, screens: signInScreens(app) }),
      )
    }),
  )
  await settled()
  session.set({ roles: ['admin'] })
  await settled()
  expect(seen.length > 0).toBeTruthy()
  expect(seen.every(Boolean)).toBeTruthy()
})

test('a redirect from a waiting verdict to the sign-in node never shows the chrome', async () => {
  navigate('/directory')
  const { host, session } = mountSignIn()
  await settled()
  session.set({ roles: [] })
  expect(classesOfShell(host)).toContain('bare')
  expect(region(host, 'header.topbar')).toEqual(null)
  await settled()
  expect(globalThis.location.pathname).toEqual('/login')
  expect(classesOfShell(host)).toContain('bare')
  expect(region(host, 'header.topbar')).toEqual(null)
})

test('leaving the sign-in node mounts the chrome and focuses the main region', async () => {
  navigate('/login')
  const { host, session } = mountSignIn()
  session.set({ roles: [] })
  await settled()
  expect(classesOfShell(host)).toContain('bare')
  navigate('/reports')
  await settled()
  expect(region(host, 'header.topbar')).toBeTruthy()
  expect(host.shadowRoot.activeElement).toEqual(region(host, 'main.main'))
  navigate('/login')
  await settled()
  expect(classesOfShell(host)).toContain('bare')
  expect(host.shadowRoot.activeElement).toEqual(gateOf(host))
})

test('a signIn that is not a node of the map is reported', () => {
  const warn = warnings()
  const plain = framed({ signIn: '/login' })
  expect(warned(warn, "'signIn' needs a 'map'")).toBeTruthy()
  expect(region(plain, 'main.main')).toBeTruthy()
  framed({ map: mapped(), signIn: '/nowhere' })
  expect(warned(warn, "'signIn' is not a node of the map")).toBeTruthy()
})

const hrefsIn = (node) =>
  [...node.querySelectorAll('li:not([hidden]) a')].map((link) => link.getAttribute('href'))

const markedIn = (node) =>
  [...node.querySelectorAll('[aria-current="page"]')].map((link) => link.getAttribute('href'))

const crumbsOf = (host) =>
  [...region(host, '.trail imp-breadcrumbs').shadowRoot.querySelectorAll('.crumb')].map(
    (crumb) => crumb.textContent,
  )

test('a map gives the bar its sections and the sidebar the rows of the current section', async () => {
  navigate('/reports/money/revenue')
  const { host } = mountMapped()
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
  expect(titlesIn(region(host, '.sidebar-body'))).toEqual(['Money', 'People'])
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/reports'])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/reports/money/revenue'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Reports')
})

test('a root with a screen of its own is the first section, current only at its own path', async () => {
  const app = appMap({ reports: { revenue: {} }, directory: {} })
  const screens = { [app]: () => div('home') }
  const host = routed(app, { nav: { [app]: { icon: div('h') } } }, '/', screens)
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Home', 'Reports', 'Directory'])
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/'])
  expect(region(host, '.bar-nav .link .icon').textContent).toEqual('h')
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual([])
  navigate('/reports/revenue')
  await settled()
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/reports'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue'])
})

test('a root that redirects is not a section', async () => {
  const app = appMap({ reports: { revenue: {} }, directory: {} })
  const host = routed(app, {}, '/', { [app]: redirect(app.reports) })
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Directory'])
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/reports'])
})

test('a root that nav hides is not a section, and its page shows no rows', async () => {
  const app = appMap({ reports: { revenue: {} }, directory: {} })
  const hidden = routed(app, { nav: { [app]: { hidden: true } } }, '/', {
    [app]: () => div('home'),
  })
  await settled()
  expect(labelsIn(region(hidden, '.bar-nav'))).toEqual(['Reports', 'Directory'])
  expect(markedIn(region(hidden, '.bar-nav'))).toEqual([])
  expect(labelsIn(region(hidden, '.sidebar-body'))).toEqual([])
})

test('navbar false makes a root with a screen of its own the first row of the sidebar', async () => {
  const app = appMap({ inputs: { button: {} }, layout: {} })
  const host = routed(app, { navbar: false }, '/', { [app]: () => div('home') })
  await settled()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Home', 'Inputs', 'Layout'])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/'])
})

test('navbar false makes the top-level nodes the rows of the sidebar, with their children under them', () => {
  const app = appMap({
    inputs: { button: {}, select: {} },
    layout: { shell: {} },
    login: {},
  })
  const host = routed(
    app,
    {
      logo: div({ id: 'brand' }, 'Acme'),
      navbar: false,
      nav: { [app.login]: { hidden: true } },
      extras: tools(),
    },
    '/inputs/select',
  )
  expect(classesOfShell(host)).toContain('bar-away')
  expect(classesOfShell(host)).not.toContain('has-navbar')
  expect(region(host, 'nav.bar-nav')).toEqual(null)
  expect(region(host, '.sidebar-logo').firstElementChild.id).toEqual('brand')
  expect(region(host, '.sidebar-foot .tools #theme')).toBeTruthy()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Inputs', 'Button', 'Select', 'Layout'])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/inputs/select'])
})

test('without the bar a top-level group node is a heading over its children', () => {
  const app = appMap({
    reports: { revenue: { monthly: {} }, costs: {} },
    directory: {},
  })
  const host = routed(
    app,
    { navbar: false, nav: { [app.reports]: { group: true } } },
    '/reports/revenue/monthly',
  )
  const body = region(host, '.sidebar-body')
  expect(titlesIn(body)).toEqual(['Reports'])
  expect(labelsIn(body)).toEqual(['Revenue', 'Monthly', 'Costs', 'Directory'])
  expect(markedIn(body)).toEqual(['/reports/revenue/monthly'])
  expect(body.querySelector('.group-title a')).toEqual(null)
})

test('the bar has no groups, so group on a node of the bar is reported and ignored', () => {
  const warn = warnings()
  const { app, nav } = reportsNav((map) => ({ [map.reports]: { group: true } }))
  const host = routed(app, { nav }, '/reports/money/revenue')
  expect(warned(warn, `'nav[${app.reports}].group' is ignored - the bar has no groups`)).toEqual(
    true,
  )
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Directory'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Revenue', 'Costs', 'Churn'])
})

test('a param node is a crumb named by imp.routeLabels, and its children are the sidebar', async () => {
  navigate('/projects/1/builds')
  const { host } = mountMapped()
  await settled()
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Builds', 'Settings'])
  expect(hrefsIn(region(host, '.sidebar-body'))).toEqual([
    '/projects/1/builds',
    '/projects/1/settings',
  ])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/projects/1/builds'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Alpha')
  expect(crumbsOf(host)).toEqual(['Home', 'Projects', 'Alpha', 'Builds'])
  expect(classesOfShell(host)).toContain('has-trail')
  expect(region(host, '.bar-title .over').textContent).toEqual('Alpha')
  expect(region(host, '.bar-title .now').textContent).toEqual('Builds')
  expect(region(host, '.trail imp-breadcrumbs').shadowRoot.querySelector('.picker')).toEqual(null)
})

test('a param crumb shows the loader while its screen loads', async () => {
  const app = mapped()
  let open = null
  const gate = new Promise((resolve) => {
    open = resolve
  })
  const slowProject = component('layout-slow-project', {
    setup: async (self) => {
      await gate
      useState(self, 'imp.routeLabels').set((all) => ({ ...all, $projectId: 'Gamma' }))
      return div('gamma')
    },
  })
  navigate('/projects/3/builds')
  const host = mounted(
    shell(
      { map: app, nav: navOf(app) },
      router({ map: app, screens: { [app.projects.$projectId.builds]: () => slowProject() } }),
    ),
  )
  await settled()
  const trail = region(host, '.trail imp-breadcrumbs').shadowRoot
  expect(trail.querySelectorAll('.crumb')[2].querySelector('imp-loader')).toBeTruthy()
  expect(crumbsOf(host)).toEqual(['Home', 'Projects', '', 'Builds'])
  open()
  await settled()
  expect(trail.querySelectorAll('.crumb')[2].querySelector('imp-loader')).toEqual(null)
  expect(crumbsOf(host)).toEqual(['Home', 'Projects', 'Gamma', 'Builds'])
})

test('a hidden node leaves the nav, and its page marks the nearest row above it', async () => {
  const app = mapped()
  const nav = navOf(app, {
    [app.reports.money.costs.fixed]: { hidden: true },
    [app.directory]: { hidden: true },
  })
  const host = routed(app, { nav }, '/reports/money/costs/fixed')
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects'])
  expect(hrefsIn(region(host, '.sidebar-body'))).toEqual([
    '/reports/money/revenue',
    '/reports/money/costs',
    '/reports/people/churn',
  ])
  expect(markedIn(region(host, '.sidebar-body'))).toEqual(['/reports/money/costs'])
})

test('nav names nodes of the map, and each entry takes icon, tag, group and hidden', () => {
  const warn = warnings()
  const app = mapped()
  framed({ map: app, nav: 'login' })
  expect(
    warned(warn, "'nav' must be an object of { [handle]: { icon, tag, group, hidden } }"),
  ).toBeTruthy()
  framed({ map: app, nav: { '/nowhere': { hidden: true } } })
  expect(warned(warn, "'nav' holds '/nowhere', which is not a node of the map")).toBeTruthy()
  framed({ map: app, nav: { [app.login]: { hide: true, group: 'yes' } } })
  expect(warned(warn, "unknown 'nav[/login]' key 'hide'")).toBeTruthy()
  expect(warned(warn, "'nav[/login].group' must be true or false")).toBeTruthy()
  framed({ nav: { [app.login]: { hidden: true } } })
  expect(warned(warn, "'nav' needs a 'map'")).toBeTruthy()
})

test('the trail hides on a top-level page and shows below it', async () => {
  navigate('/reports')
  const { host } = mountMapped()
  expect(region(host, '.trail').hidden).toEqual(true)
  expect(classesOfShell(host)).not.toContain('has-trail')
  navigate('/reports/money/revenue')
  await settled()
  expect(region(host, '.trail').hidden).toEqual(false)
  expect(classesOfShell(host)).toContain('has-trail')
  expect(crumbsOf(host)).toEqual(['Home', 'Reports', 'Money', 'Revenue'])
})

test('the nav follows a navigation, and the trail can be turned off', async () => {
  navigate('/reports/money/revenue')
  const { host } = mountMapped({ breadcrumbs: false })
  expect(region(host, '.trail')).toEqual(null)
  expect(classesOfShell(host)).not.toContain('has-trail')
  navigate('/projects/2/settings')
  await settled()
  expect(markedIn(region(host, '.bar-nav'))).toEqual(['/projects'])
  expect(labelsIn(region(host, '.sidebar-body'))).toEqual(['Builds', 'Settings'])
  expect(region(host, '.sidebar-head .here').textContent).toEqual('Beta')
})

test('icons bind to sections and rows by handle', async () => {
  navigate('/reports/money/revenue')
  const { host } = mountMapped({
    nav: (app) => ({
      [app.reports]: { icon: div('r') },
      [app.reports.people.churn]: { icon: div('c') },
    }),
  })
  await settled()
  expect(region(host, '.bar-nav .link .icon').textContent).toEqual('r')
  expect(parentLink(host, 'Churn').querySelector('.icon').textContent).toEqual('c')
})

test('a tag takes a fixed tag or the name of a state, and the state keeps the pill live', async () => {
  navigate('/reports/money/revenue')
  const { host, count } = mountMapped({
    nav: (app) => ({
      [app.reports]: { tag: { text: 'new' } },
      [app.reports.people.churn]: { tag: 'layout.count' },
    }),
  })
  count.set({ text: 3, color: 'blue' })
  await settled()
  const pillsIn = (node) => [...node.querySelectorAll('.tag')].map(renderedText)
  expect(pillsIn(region(host, '.bar-nav'))).toEqual(['new'])
  expect(pillsIn(region(host, '.sidebar-body'))).toEqual(['3'])
  count.set(7)
  await settled()
  expect(pillsIn(region(host, '.sidebar-body'))).toEqual(['7'])
  count.set(null)
  await settled()
  expect(pillsIn(region(host, '.sidebar-body'))).toEqual([])
})

test('a tag title describes the section link of the bar', async () => {
  navigate('/reports/money/revenue')
  const { host } = mountMapped({
    nav: (app) => ({ [app.reports]: { tag: { text: 'a +1', title: 'alpha, beta' } } }),
  })
  await settled()
  const reportsIn = (node) =>
    [...node.querySelectorAll('.link')].find((link) => link.textContent.includes('Reports'))
  expect(describedText(reportsIn(region(host, '.bar-nav')))).toEqual('alpha, beta')
})

test('a section the guard denies is not in the nav until it allows it', async () => {
  navigate('/reports/money/revenue')
  const { host, session } = mountMapped()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects'])
  session.set({ roles: ['admin'] })
  await settled()
  expect(labelsIn(region(host, '.bar-nav'))).toEqual(['Reports', 'Projects', 'Directory'])
})

test('router({ scope }) makes the children of a tenant param the sections', async () => {
  const app = appMap({
    organizations: {
      $org: { projects: { $projectId: {} }, admin: {} },
    },
    userSettings: { me: {} },
  })
  const orgScreen = component('layout-org-screen', {
    setup: (self) => {
      useState(self, 'imp.routeLabels').set((all) => ({ ...all, $org: 'Acme' }))
      return div('projects')
    },
  })
  navigate('/organizations/acme/projects')
  const host = mounted(
    shell(
      {
        map: app,
        nav: { [app.userSettings]: { hidden: true } },
        navbar: { label: 'Sections' },
      },
      router({
        map: app,
        scope: app.organizations.$org,
        screens: { [app.organizations.$org.projects]: () => orgScreen() },
      }),
    ),
  )
  await settled()
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
  expect(crumbsOf(host)).toEqual(['Home', 'User settings', 'Me'])
  expect(() => router({ map: app, scope: app.userSettings })).toThrow('scope is the param handle')
})
