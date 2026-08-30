import { component, mount } from 'imp'
import { initState } from 'imp/state'
import { button, heading, icon, link, text } from 'imp/std'
import { emptyState, tag } from 'imp/std/display'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('std-state-host', { build: (_instance, render) => render() })

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

test('button takes a link variant that stays a real button', () => {
  const control = inner(mounted(button({ variant: 'link' }, 'What is this?')), 'button')
  expect(control.localName).toEqual('button')
  expect(control.getAttribute('class')).toContain('variant-link')
})

test('button names an icon-only control with label', () => {
  const control = inner(mounted(button({ label: 'Close' }, 'x')), 'button')
  expect(control.getAttribute('aria-label')).toEqual('Close')
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

const withItems = (extra = {}) =>
  mounted(button({
    items: [
      { id: 'copy', label: 'Copy' },
      { id: 'rename', label: 'Rename' },
      { id: 'delete', label: 'Delete', disabled: true },
    ],
    ...extra,
  }, 'Save'))

const menuOf = (host) => inner(host, '.menu')

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

test('items add a triple-dot trigger beside the button and a menu it can open', () => {
  const host = withItems()
  const more = inner(host, '.more')
  const menu = menuOf(host)
  expect(inner(host, '.group').children.length).toEqual(3)
  expect(more.getAttribute('aria-haspopup')).toEqual('menu')
  expect(more.getAttribute('aria-expanded')).toEqual('false')
  expect(more.getAttribute('aria-label')).toEqual('More actions')
  expect(more.getAttribute('popovertarget')).toEqual(menu.id)
  expect(menu.getAttribute('popover')).toEqual('auto')
  expect(menu.getAttribute('role')).toEqual('menu')
  expect([...menu.children].map((item) => item.getAttribute('role')))
    .toEqual(['menuitem', 'menuitem', 'menuitem'])
  expect(renderedText(menu)).toEqual('CopyRenameDelete')
})

test('a button without items renders the bare control and no menu', () => {
  const host = mounted(button('Save'))
  expect(host.shadowRoot.querySelector('.group')).toEqual(null)
  expect(host.shadowRoot.querySelector('.menu')).toEqual(null)
})

test('the triple-dot trigger opens the menu, tracks aria-expanded and focuses the first item', () => {
  const host = withItems()
  const more = inner(host, '.more')
  const menu = menuOf(host)
  invoke(more)
  expect(more.getAttribute('aria-expanded')).toEqual('true')
  expect(host.shadowRoot.activeElement).toEqual(menu.children[0])
  invoke(more)
  expect(more.getAttribute('aria-expanded')).toEqual('false')
  expect(host.shadowRoot.activeElement).toEqual(more)
})

test('arrow keys walk the enabled items and skip a disabled one', () => {
  const host = withItems()
  const menu = menuOf(host)
  invoke(inner(host, '.more'))
  press(menu, 'ArrowDown')
  expect(host.shadowRoot.activeElement).toEqual(menu.children[1])
  press(menu, 'ArrowDown')
  expect(host.shadowRoot.activeElement).toEqual(menu.children[0])
  press(menu, 'ArrowUp')
  expect(host.shadowRoot.activeElement).toEqual(menu.children[1])
})

test('Escape shuts the menu and hands focus back to the trigger', () => {
  const host = withItems()
  invoke(inner(host, '.more'))
  press(menuOf(host).children[0], 'Escape')
  expect(inner(host, '.more').getAttribute('aria-expanded')).toEqual('false')
  expect(host.shadowRoot.activeElement).toEqual(inner(host, '.more'))
})

test('choosing an item closes the menu, reports the choice and runs its onClick', () => {
  const chosen = []
  const host = mounted(button({
    items: [{ id: 'copy', label: 'Copy', onClick: ({ id }) => chosen.push(id) }],
  }, 'Save'))
  const reported = []
  host.addEventListener('select', (event) => reported.push(event.detail.id))
  invoke(inner(host, '.more'))
  invoke(menuOf(host).children[0])
  expect(inner(host, '.more').getAttribute('aria-expanded')).toEqual('false')
  expect(reported).toEqual(['copy'])
  expect(chosen).toEqual(['copy'])
})

test('cancelling the select event leaves the item onClick unrun', () => {
  const chosen = []
  const host = mounted(button({
    items: [{ id: 'copy', label: 'Copy', onClick: () => chosen.push('copy') }],
  }, 'Save'))
  host.addEventListener('select', (event) => event.preventDefault())
  invoke(inner(host, '.more'))
  invoke(menuOf(host).children[0])
  expect(chosen).toEqual([])
})

test('a disabled button disables its triple-dot trigger too', () => {
  const host = withItems({ disabled: true })
  expect(inner(host, '.more').disabled).toEqual(true)
})

test('items that are not an array, or carry no label, are logged and dropped', () => {
  const warn = warnings()
  expect(mounted(button({ items: 'copy' }, 'Save')).shadowRoot.querySelector('.menu')).toEqual(null)
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
  const host = mounted(button({ items: [{ label: 'Copy' }, { onClick: () => {} }] }, 'Save'))
  expect(menuOf(host).children.length).toEqual(1)
  expect(warned(warn, "not an object with a 'label'")).toBeTruthy()
})

test('the menu declares CSS anchor positioning against the trigger', () => {
  const host = withItems()
  const sheet = [...host.shadowRoot.adoptedStyleSheets].map((style) =>
    [...style.cssRules].map((rule) => rule.cssText).join('\n')
  ).join('\n')
  expect(sheet).toContain('anchor-name: --imp-anchor')
  expect(sheet).toContain('position-anchor: --imp-anchor')
  expect(sheet).toContain('position-area: block-end span-inline-start')
  expect(sheet).toContain('position-try-fallbacks: flip-block')
})

test('props are dispatched by type wherever they sit among the arguments', () => {
  const warn = warnings()
  const host = mounted(button('Save', { variant: 'primary' }))
  expect(inner(host, 'button').getAttribute('class')).toContain('variant-primary')
  expect(renderedText(host)).toContain('Save')
  expect(warned(warn, 'single props object')).toEqual(false)
})

test('two props objects in one call are logged, and later keys win', () => {
  const warn = warnings()
  const host = mounted(button({ variant: 'ghost' }, 'Save', { variant: 'danger' }))
  expect(inner(host, 'button').getAttribute('class')).toContain('variant-danger')
  expect(warned(warn, 'single props object')).toBeTruthy()
})

test('a state passed as a standalone argument is logged, not read as props', () => {
  const warn = warnings()
  const host = mounted(stateHost(() => button(initState('std.strayLabel', 'Save'))))
  expect(warned(warn, 'state was passed directly')).toBeTruthy()
  expect(warned(warn, 'unknown prop')).toEqual(false)
  expect(renderedText(inner(host, 'imp-button'))).toEqual('')
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

test('emptyState reads without an app translation, from its own default wording', () => {
  const host = mounted(emptyState())
  expect(host.localName).toEqual('imp-empty-state')
  expect(renderedText(inner(host, '.title'))).toEqual('Nothing here yet')
  expect(inner(host, '.description')).toEqual(null)
  expect(inner(host, '.actions')).toEqual(null)
})

test('the noResults variant has its own wording', () => {
  const host = mounted(emptyState({ variant: 'noResults' }))
  expect(renderedText(inner(host, '.title'))).toEqual('No results')
})

test('a title and description given as props win over the wording', () => {
  const host = mounted(
    emptyState({ title: 'No invoices', description: 'Invoices appear here once you send one.' }),
  )
  expect(renderedText(inner(host, '.title'))).toEqual('No invoices')
  expect(renderedText(inner(host, '.description'))).toEqual(
    'Invoices appear here once you send one.',
  )
})

test('a state-shaped title updates the text in place', () => {
  let title
  const host = inner(
    mounted(stateHost(() => {
      title = initState('std.emptyTitle', 'No invoices')
      return emptyState({ title })
    })),
    'imp-empty-state',
  )
  const rendered = inner(host, '.title')
  expect(rendered.textContent).toEqual('No invoices')
  title.set('Nothing matched')
  expect(rendered.textContent).toEqual('Nothing matched')
})

test("emptyState renders its children as the empty state's actions", () => {
  const host = mounted(emptyState({ title: 'No invoices' }, button('New invoice')))
  expect(renderedText(inner(host, '.actions'))).toEqual('New invoice')
})

test('an unknown emptyState variant is logged and falls back to empty', () => {
  const warn = warnings()
  const host = mounted(emptyState({ variant: 'blank' }))
  expect(warned(warn, "'variant'")).toBeTruthy()
  expect(renderedText(inner(host, '.title'))).toEqual('Nothing here yet')
})

test('icon draws the named glyph as an inline svg in the current color', () => {
  const host = mounted(icon({ name: 'home' }))
  expect(host.localName).toEqual('imp-icon')
  const svg = inner(host, 'svg')
  expect(svg.getAttribute('viewBox')).toEqual('0 0 24 24')
  expect(svg.getAttribute('stroke')).toEqual('currentColor')
  expect(svg.getAttribute('class')).toContain('size-md')
  expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)
})

test('an icon with no label is decorative', () => {
  const svg = inner(mounted(icon({ name: 'star' })), 'svg')
  expect(svg.getAttribute('aria-hidden')).toEqual('true')
  expect(svg.getAttribute('role')).toEqual(null)
})

test('a labelled icon is an image with a name', () => {
  const svg = inner(mounted(icon({ name: 'trash', label: 'Delete' })), 'svg')
  expect(svg.getAttribute('role')).toEqual('img')
  expect(svg.getAttribute('aria-label')).toEqual('Delete')
  expect(svg.getAttribute('aria-hidden')).toEqual(null)
})

test('icon sizes are the three steps', () => {
  expect(inner(mounted(icon({ name: 'star', size: 'sm' })), 'svg').getAttribute('class'))
    .toContain('size-sm')
  expect(inner(mounted(icon({ name: 'star', size: 'lg' })), 'svg').getAttribute('class'))
    .toContain('size-lg')
})

test('an unknown glyph name is logged and draws nothing', () => {
  const warn = warnings()
  const svg = inner(mounted(icon({ name: 'rocket' })), 'svg')
  expect(warned(warn, "no built-in glyph named 'rocket'")).toBeTruthy()
  expect(svg.querySelectorAll('path').length).toEqual(0)
})

test('tag renders its label in a neutral pill by default', () => {
  const host = mounted(tag('Draft'))
  expect(host.localName).toEqual('imp-tag')
  const pill = inner(host, '.tag')
  expect(renderedText(pill)).toEqual('Draft')
  expect(pill.classList.contains('color-neutral')).toBeTruthy()
  expect(pill.classList.contains('size-md')).toBeTruthy()
})

test('tag takes a palette color and a size', () => {
  const pill = inner(mounted(tag({ color: 'green', size: 'sm' }, 'Shipped')), '.tag')
  expect(pill.classList.contains('color-green')).toBeTruthy()
  expect(pill.classList.contains('size-sm')).toBeTruthy()
})

test('a state-shaped tag label updates the text in place', () => {
  let status
  const host = inner(
    mounted(stateHost(() => {
      status = initState('std.tagStatus', 'Draft')
      return tag({ color: 'blue' }, status.text())
    })),
    'imp-tag',
  )
  const pill = inner(host, '.tag')
  expect(pill.textContent).toEqual('Draft')
  status.set('Published')
  expect(pill.textContent).toEqual('Published')
})

test('an unknown tag color is logged and falls back to neutral', () => {
  const warn = warnings()
  const pill = inner(mounted(tag({ color: 'chartreuse' }, 'Draft')), '.tag')
  expect(warned(warn, "'color'")).toBeTruthy()
  expect(pill.classList.contains('color-neutral')).toBeTruthy()
})
