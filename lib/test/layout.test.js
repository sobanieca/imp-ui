import { component, mount } from 'imp'
import { div } from 'imp/html'
import { flex, shell, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

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

const triggerOf = (host) => region(host, '.trigger')

test('shell renders the frame landmarks and puts its children in main', () => {
  const host = mounted(shell({ header: div('bar'), aside: div('filters') }, div('page')))
  expect(host.localName).toEqual('imp-shell')
  expect(region(host, 'header.header').localName).toEqual('header')
  expect(region(host, 'main.main').localName).toEqual('main')
  expect(region(host, 'aside.aside').localName).toEqual('aside')
  expect(renderedText(region(host, 'main.main'))).toEqual('page')
})

test('shell renders only the regions it is given', () => {
  const host = mounted(shell(div('page')))
  expect(region(host, 'header.header')).toEqual(null)
  expect(region(host, '.rail')).toEqual(null)
  expect(region(host, '.sidebar')).toEqual(null)
  expect(region(host, 'aside.aside')).toEqual(null)
  expect(region(host, '.bottom')).toEqual(null)
  expect(region(host, 'main.main')).toBeTruthy()
})

test('shell brings no nav landmark of its own', () => {
  const host = mounted(shell({ sidebar: div('sections') }, div('page')))
  expect(host.shadowRoot.querySelector('nav')).toEqual(null)
})

test('shell marks which regions are present and how the header spans', () => {
  const host = mounted(
    shell({ rail: div('r'), sidebar: div('s'), aside: div('a'), headerSpan: 'content' }),
  )
  const classes = shellRoot(host).getAttribute('class')
  expect(classes).toContain('has-rail')
  expect(classes).toContain('has-sidebar')
  expect(classes).toContain('has-aside')
  expect(classes).toContain('span-content')
})

test('shell spans its header across everything by default', () => {
  expect(shellRoot(mounted(shell())).getAttribute('class')).toContain('span-full')
})

test('shell warns and falls back on a headerSpan outside its list', () => {
  const warn = warnings()
  const host = mounted(shell({ headerSpan: 'main' }))
  expect(shellRoot(host).getAttribute('class')).toContain('span-full')
  expect(warned(warn, "shell: 'headerSpan' must be one of")).toBeTruthy()
})

test('shell reports an unknown prop', () => {
  const warn = warnings()
  mounted(shell({ footer: div('legal') }))
  expect(warned(warn, "shell: unknown prop 'footer'")).toBeTruthy()
})

test('shell gives a sidebar a drawer trigger that names and controls it', () => {
  const host = mounted(shell({ sidebar: div('sections') }))
  const trigger = triggerOf(host)
  expect(trigger.localName).toEqual('button')
  expect(trigger.getAttribute('aria-label')).toEqual('Navigation')
  expect(trigger.getAttribute('aria-controls')).toEqual(region(host, '.sidebar').id)
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
})

test('shell has no drawer without a sidebar, and none when a bottom nav is given', () => {
  expect(triggerOf(mounted(shell({ header: div('bar') })))).toEqual(null)
  expect(drawerOf(mounted(shell({ header: div('bar') })))).toEqual(null)
  const withBottom = mounted(shell({ sidebar: div('s'), bottomNav: div('b') }))
  expect(triggerOf(withBottom)).toEqual(null)
  expect(drawerOf(withBottom)).toEqual(null)
})

test('the trigger opens the sidebar as a modal drawer and reports it', () => {
  const opened = []
  const host = mounted(
    shell({ sidebar: div('sections'), events: { navToggle: (e) => opened.push(e.detail.open) } }),
  )
  click(triggerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  expect(region(host, '.sidebar').parentElement).toEqual(drawerOf(host))
  expect(triggerOf(host).getAttribute('aria-expanded')).toEqual('true')
  expect(opened).toEqual([true])
})

test('closing the drawer holds the sidebar until it has slid away', async () => {
  const opened = []
  const host = mounted(
    shell({ sidebar: div('sections'), events: { navToggle: (e) => opened.push(e.detail.open) } }),
  )
  click(triggerOf(host))
  click(triggerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  expect(region(host, '.sidebar').parentElement).toEqual(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(false)
  expect(region(host, '.sidebar').parentElement).toEqual(shellRoot(host))
  expect(triggerOf(host).getAttribute('aria-expanded')).toEqual('false')
  expect(opened).toEqual([true, false])
})

test('escape dismisses the drawer through the same closing slide', async () => {
  const host = mounted(shell({ sidebar: div('sections') }))
  click(triggerOf(host))
  escape(drawerOf(host))
  expect(drawerOf(host).open).toEqual(true)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
  expect(region(host, '.sidebar').parentElement).toEqual(shellRoot(host))
})

test('clicking the backdrop dismisses the drawer', async () => {
  const host = mounted(shell({ sidebar: div('sections') }))
  click(triggerOf(host))
  pointerDown(drawerOf(host))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})

test('a drag that starts inside the drawer leaves it open', async () => {
  const host = mounted(shell({ sidebar: div('sections') }))
  click(triggerOf(host))
  pointerDown(region(host, '.sidebar'))
  click(drawerOf(host))
  await settled()
  expect(drawerOf(host).open).toEqual(true)
})

test('the open drawer takes focus, inerts the page and holds the page scroll', async () => {
  const host = mounted(shell({ sidebar: div('sections') }))
  const outside = document.body.appendChild(document.createElement('button'))
  outside.focus()
  click(triggerOf(host))
  expect(outside.inert).toEqual(true)
  expect(document.documentElement.style.overflow).toEqual('hidden')
  click(triggerOf(host))
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
    host = shell({ sidebar: div('sections'), navOpen: state })
    return host
  }))
  navOpen.set(true)
  expect(drawerOf(host).open).toEqual(true)
  click(triggerOf(host))
  expect(navOpen.get()).toEqual(false)
  await settled()
  expect(drawerOf(host).open).toEqual(false)
})
