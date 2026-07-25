import { component, initState, mount } from 'imp'
import { button, heading, link, text } from 'imp/std'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('std-state-host', { onMount: (_instance, render) => render() })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const click = (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('button renders a native button carrying its children', () => {
  const host = mounted(button('Save'))
  expect(host.localName).toEqual('imp-button')
  expect(inner(host, 'button').localName).toEqual('button')
  expect(renderedText(host)).toEqual('Save')
})

test('button defaults to the default variant and md size', () => {
  const control = inner(mounted(button('Save')), 'button')
  expect(control.getAttribute('class')).toContain('variant-default')
  expect(control.getAttribute('class')).toContain('size-md')
})

test('button never renders a native submit button', () => {
  const warn = warnings()
  const control = inner(mounted(button({ type: 'submit' }, 'Save')), 'button')
  expect(control.getAttribute('type')).toEqual('button')
  expect(warned(warn, "unknown prop 'type'")).toBeTruthy()
})

test('button applies variant, size and block as classes', () => {
  const control = inner(
    mounted(button({ variant: 'danger', size: 'lg', block: true }, 'Delete')),
    'button',
  )
  expect(control.getAttribute('class')).toContain('variant-danger')
  expect(control.getAttribute('class')).toContain('size-lg')
  expect(control.getAttribute('class')).toContain('block')
})

test('button forwards events to the native button', () => {
  let clicks = 0
  const host = mounted(button({ events: { click: () => clicks++ } }, 'Save'))
  click(inner(host, 'button'))
  expect(clicks).toEqual(1)
})

test('button disables the native button', () => {
  const control = inner(mounted(button({ disabled: true }, 'Save')), 'button')
  expect(control.disabled).toEqual(true)
})

test('a state-shaped disabled prop updates the button in place', () => {
  let disabled
  const host = mounted(stateHost(() => {
    disabled = initState('std.disabled', false)
    return button({ disabled }, 'Save')
  }))
  const control = inner(inner(host, 'imp-button'), 'button')
  expect(control.disabled).toEqual(false)
  disabled.set(true)
  expect(control.disabled).toEqual(true)
  disabled.set(false)
  expect(control.disabled).toEqual(false)
})

test('a loading button is busy, disabled and shows its spinner', () => {
  let loading
  const host = inner(
    mounted(stateHost(() => {
      loading = initState('std.loading', false)
      return button({ loading }, 'Save')
    })),
    'imp-button',
  )
  const control = inner(host, 'button')
  expect(control.getAttribute('aria-busy')).toEqual('false')
  expect(inner(host, '.spinner').hidden).toEqual(true)
  loading.set(true)
  expect(control.getAttribute('aria-busy')).toEqual('true')
  expect(control.disabled).toEqual(true)
  expect(inner(host, '.spinner').hidden).toEqual(false)
})

test('an unknown variant is logged and falls back to the default', () => {
  const warn = warnings()
  const control = inner(mounted(button({ variant: 'fancy' }, 'Save')), 'button')
  expect(warned(warn, "'variant'")).toBeTruthy()
  expect(control.getAttribute('class')).toContain('variant-default')
})

test('an unknown prop is logged and ignored', () => {
  const warn = warnings()
  mounted(button({ colour: 'red' }, 'Save'))
  expect(warned(warn, "unknown prop 'colour'")).toBeTruthy()
})

test('props passed after the children are logged', () => {
  const warn = warnings()
  mounted(button('Save', { variant: 'primary' }))
  expect(warned(warn, 'single props object')).toBeTruthy()
})

test('heading renders the requested level', () => {
  expect(inner(mounted(heading('Title')), 'h1')).toBeTruthy()
  document.body.replaceChildren()
  expect(inner(mounted(heading({ level: 3 }, 'Title')), 'h3')).toBeTruthy()
})

test('heading applies tone and alignment as classes', () => {
  const host = mounted(heading({ level: 2, tone: 'secondary', align: 'center' }, 'Title'))
  const title = inner(host, 'h2')
  expect(title.getAttribute('class')).toContain('tone-secondary')
  expect(title.getAttribute('class')).toContain('align-center')
  expect(renderedText(host)).toEqual('Title')
})

test('text renders a paragraph by default and a span when inline', () => {
  expect(inner(mounted(text('Body copy')), 'p')).toBeTruthy()
  document.body.replaceChildren()
  expect(inner(mounted(text({ inline: true }, 'inline copy')), 'span')).toBeTruthy()
})

test('text applies tone, size, weight and alignment as classes', () => {
  const host = mounted(
    text({ tone: 'secondary', size: 'sm', weight: 'bold', align: 'end' }, 'Body copy'),
  )
  const classes = inner(host, 'p').getAttribute('class')
  expect(classes).toContain('tone-secondary')
  expect(classes).toContain('size-sm')
  expect(classes).toContain('weight-bold')
  expect(classes).toContain('align-end')
})

test('link renders an anchor with its href', () => {
  const anchor = inner(mounted(link({ href: '/settings' }, 'Settings')), 'a')
  expect(anchor.getAttribute('href')).toEqual('/settings')
})

test('an external link opens in a new tab with a safe rel', () => {
  const anchor = inner(
    mounted(link({ href: 'https://example.com', external: true }, 'Docs')),
    'a',
  )
  expect(anchor.getAttribute('target')).toEqual('_blank')
  expect(anchor.getAttribute('rel')).toEqual('noreferrer noopener')
})

test('clicking an in-app link navigates without a page load', () => {
  const anchor = inner(mounted(link({ href: '/settings' }, 'Settings')), 'a')
  click(anchor)
  expect(globalThis.location.pathname).toEqual('/settings')
})

test('an off-site link is left to the browser', () => {
  const anchor = inner(mounted(link({ href: 'https://example.com' }, 'Docs')), 'a')
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  anchor.dispatchEvent(event)
  expect(event.defaultPrevented).toEqual(false)
})

test('a link without an href is logged', () => {
  const warn = warnings()
  mounted(link('Nowhere'))
  expect(warned(warn, "needs an 'href'")).toBeTruthy()
})
