import { component, mount } from 'imp'
import { button, buttonGroup, heading, icon, link, text } from 'imp/std'
import { luCircleUser, luHouse, luStar, luTrash } from 'imp/icons'
import { card, emptyState, tag, tooltip } from 'imp/std/display'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'
import { initState } from 'imp/state'

const stateHost = component('std-state-host', { setup: (self, render) => render(self) })

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

test('button with pressed is a toggle that flips on click and writes the state back', () => {
  let pressed = null
  const toggles = []
  const host = mounted(stateHost((self) => {
    pressed = initState(self, 'toggle.pressed', false)
    return button({ pressed, events: { click: () => {} } }, 'Bold')
  }))
  host.addEventListener('toggle', (event) => toggles.push(event.detail.pressed))
  const control = inner(host, 'imp-button').shadowRoot.querySelector('button')
  expect(control.getAttribute('aria-pressed')).toEqual('false')
  click(control)
  expect(control.getAttribute('aria-pressed')).toEqual('true')
  expect(pressed.get()).toEqual(true)
  expect(toggles).toEqual([true])
  pressed.set(false)
  expect(control.getAttribute('aria-pressed')).toEqual('false')
  expect(toggles).toEqual([true])
})

test('button with a plain pressed value keeps the toggle itself', () => {
  const control = inner(mounted(button({ pressed: true }, 'Bold')), 'button')
  expect(control.getAttribute('aria-pressed')).toEqual('true')
  click(control)
  expect(control.getAttribute('aria-pressed')).toEqual('false')
})

test('a disabled toggle button does not flip', () => {
  const control = inner(mounted(button({ pressed: false, disabled: true }, 'Bold')), 'button')
  click(control)
  expect(control.getAttribute('aria-pressed')).toEqual('false')
})

test('button without pressed has no aria-pressed', () => {
  const control = inner(mounted(button('Save')), 'button')
  expect(control.hasAttribute('aria-pressed')).toEqual(false)
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
  const host = mounted(stateHost((self) => {
    disabled = initState(self, 'std.disabled', false)
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
    mounted(stateHost((self) => {
      loading = initState(self, 'std.loading', false)
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

test('button paints aria-expanded and aria-haspopup only when asked', () => {
  const plain = mounted(button('Save'))
  expect(inner(plain, '.button').hasAttribute('aria-expanded')).toEqual(false)
  expect(inner(plain, '.button').hasAttribute('aria-haspopup')).toEqual(false)
  const host = mounted(button({ haspopup: 'listbox', expanded: true }, 'Save'))
  expect(inner(host, '.button').getAttribute('aria-haspopup')).toEqual('listbox')
  expect(inner(host, '.button').getAttribute('aria-expanded')).toEqual('true')
})

test('a state-shaped expanded prop repaints the button in place', () => {
  let open
  const host = mounted(stateHost((self) => {
    open = initState(self, 'std.open', false)
    return button({ expanded: open }, 'Save')
  }))
  const control = inner(inner(host, 'imp-button'), 'button')
  expect(control.getAttribute('aria-expanded')).toEqual('false')
  open.set(true)
  expect(control.getAttribute('aria-expanded')).toEqual('true')
})

test('button invokes a popover element handed to it, across the shadow boundary', () => {
  const warn = warnings()
  const panel = document.createElement('div')
  panel.setAttribute('popover', 'auto')
  const host = mounted(button({ popoverTarget: panel, popoverAction: 'show' }, 'Open'))
  const control = inner(host, '.button')
  expect(control.popoverTargetElement).toEqual(panel)
  expect(control.popoverTargetAction).toEqual('show')
  const plain = mounted(button({ popoverTarget: 'panel' }, 'Open'))
  expect(inner(plain, '.button').popoverTargetElement ?? null).toEqual(null)
  expect(warned(warn, "'popoverTarget' must be an element")).toBeTruthy()
})

test('button has no menu of its own', () => {
  const warn = warnings()
  const host = mounted(button({ items: [{ label: 'Copy' }] }, 'Save'))
  expect(host.shadowRoot.querySelector('.panel')).toEqual(null)
  expect(warned(warn, "unknown prop 'items'")).toBeTruthy()
})

const ACTIONS = [
  { id: 'copy', label: 'Copy' },
  { id: 'rename', label: 'Rename' },
  { id: 'delete', label: 'Delete', disabled: true },
]

const withItems = (extra = {}) => mounted(buttonGroup({ items: ACTIONS, ...extra }, button('Save')))

const rowOf = (host) => inner(host, '.row')

const panelOf = (host) => inner(host, '.panel')

const controlOf = (node) => node.shadowRoot.querySelector('.button')

const triggerOf = (host) => controlOf(inner(host, '.trigger'))

const firstOf = (host) => controlOf(rowOf(host).children[0])

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const isOpen = (trigger) => trigger.getAttribute('aria-expanded') === 'true'

const sheetOf = (host) =>
  [...host.shadowRoot.adoptedStyleSheets]
    .map((style) => [...style.cssRules].map((rule) => rule.cssText).join('\n'))
    .join('\n')

test('items add a trigger to the row and a menu it can open', () => {
  const host = withItems()
  expect(host.localName).toEqual('imp-button-group')
  const row = rowOf(host)
  expect(row.getAttribute('role')).toEqual('group')
  expect([...row.children].map((child) => child.localName)).toEqual(['imp-button', 'imp-button'])
  expect(renderedText(row.children[0])).toContain('Save')
  expect(row.children[1].classList.contains('trigger')).toEqual(true)
  const trigger = triggerOf(host)
  expect(trigger.getAttribute('aria-haspopup')).toEqual('menu')
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
  const panel = panelOf(host)
  expect(panel.getAttribute('role')).toEqual('menu')
  expect(panel.getAttribute('popover')).toEqual('auto')
  expect(panel.children.length).toEqual(3)
  expect([...panel.children].map((option) => option.getAttribute('role')))
    .toEqual(['menuitem', 'menuitem', 'menuitem'])
  expect(panel.children[2].disabled).toEqual(true)
})

test('the trigger opens the menu, tracks aria-expanded and focuses the first option', () => {
  const host = withItems()
  const panel = panelOf(host)
  invoke(triggerOf(host))
  expect(isOpen(triggerOf(host))).toEqual(true)
  expect(host.shadowRoot.activeElement).toEqual(panel.children[0])
  expect(panel.children[0].tabIndex).toEqual(0)
})

test('a second click on the trigger closes the menu instead of reopening it', () => {
  const host = withItems()
  invoke(triggerOf(host))
  expect(isOpen(triggerOf(host))).toEqual(true)
  invoke(triggerOf(host))
  expect(isOpen(triggerOf(host))).toEqual(false)
})

test('arrow keys walk the enabled options and skip a disabled one', () => {
  const host = withItems()
  const panel = panelOf(host)
  invoke(triggerOf(host))
  press(panel.children[0], 'ArrowDown')
  expect(panel.children[1].tabIndex).toEqual(0)
  press(panel.children[1], 'ArrowDown')
  expect(panel.children[0].tabIndex).toEqual(0)
  press(panel.children[0], 'End')
  expect(panel.children[1].tabIndex).toEqual(0)
})

test('Escape shuts the menu and hands focus back to the trigger', () => {
  const host = withItems()
  invoke(triggerOf(host))
  press(panelOf(host).children[0], 'Escape')
  expect(triggerOf(host).getAttribute('aria-expanded')).toEqual('false')
  expect(host.shadowRoot.activeElement).toEqual(inner(host, '.trigger'))
})

test('choosing an option closes the menu, reports the choice and runs its onClick', () => {
  const chosen = []
  const host = mounted(buttonGroup({
    items: [{ id: 'copy', label: 'Copy', onClick: (detail) => chosen.push(detail.id) }],
  }, button('Save')))
  const seen = []
  host.addEventListener('select', (event) => seen.push(event.detail.id))
  invoke(triggerOf(host))
  invoke(panelOf(host).children[0])
  expect(triggerOf(host).getAttribute('aria-expanded')).toEqual('false')
  expect(seen).toEqual(['copy'])
  expect(chosen).toEqual(['copy'])
})

test('a select handler in events runs for a choice', () => {
  const seen = []
  const host = mounted(buttonGroup({
    items: ACTIONS,
    events: { select: (event) => seen.push(event.detail.id) },
  }, button('Save')))
  invoke(triggerOf(host))
  invoke(panelOf(host).children[1])
  expect(seen).toEqual(['rename'])
})

test('cancelling the select event leaves the option onClick unrun', () => {
  const chosen = []
  const host = mounted(buttonGroup({
    items: [{ id: 'copy', label: 'Copy', onClick: () => chosen.push('copy') }],
  }, button('Save')))
  host.addEventListener('select', (event) => event.preventDefault())
  invoke(triggerOf(host))
  invoke(panelOf(host).children[0])
  expect(chosen).toEqual([])
})

test('a disabled buttonGroup disables its trigger and leaves a child alone', () => {
  const host = withItems({ disabled: true })
  expect(triggerOf(host).disabled).toEqual(true)
  expect(firstOf(host).disabled).toEqual(false)
})

test('a state-shaped disabled shuts an open menu', () => {
  let blocked
  const outer = mounted(stateHost((self) => {
    blocked = initState(self, 'std.blocked', false)
    return buttonGroup({ items: ACTIONS, disabled: blocked }, button('Save'))
  }))
  const host = inner(outer, 'imp-button-group')
  invoke(triggerOf(host))
  expect(isOpen(triggerOf(host))).toEqual(true)
  blocked.set(true)
  expect(isOpen(triggerOf(host))).toEqual(false)
  expect(triggerOf(host).disabled).toEqual(true)
})

test('the arrow trigger draws a chevron and names itself as a choice', () => {
  const host = withItems({ trigger: 'arrow' })
  const trigger = inner(host, '.trigger')
  expect(trigger.shadowRoot.querySelector('svg path').getAttribute('d')).toEqual('M6 9l6 6 6-6')
  expect(controlOf(trigger).getAttribute('aria-label')).toEqual('Choose an action')
})

test('the more trigger names itself as more actions', () => {
  expect(triggerOf(withItems()).getAttribute('aria-label')).toEqual('More actions')
})

test('variant and size of the group style the trigger', () => {
  const trigger = triggerOf(withItems({ variant: 'primary', size: 'sm' }))
  expect(trigger.classList.contains('variant-primary')).toEqual(true)
  expect(trigger.classList.contains('size-sm')).toEqual(true)
  expect(trigger.classList.contains('square')).toEqual(true)
})

test('a button with an icon in a buttonGroup trigger sizes that icon', () => {
  const sheet = sheetOf(mounted(button('Save')))
  expect(sheet).toContain('.label .icon')
  const trigger = inner(withItems(), '.trigger')
  const drawing = trigger.shadowRoot.querySelector('.label svg')
  expect(drawing).toBeTruthy()
  expect(drawing.classList.contains('icon')).toEqual(true)
})

test('an unknown trigger is logged and falls back to the triple-dot trigger', () => {
  const warn = warnings()
  const host = withItems({ trigger: 'click' })
  expect(warned(warn, "'trigger'")).toBeTruthy()
  expect(inner(host, '.trigger')).toBeTruthy()
})

test('items that are not an array, or carry no label, are logged and dropped', () => {
  const warn = warnings()
  expect(panelOf(mounted(buttonGroup({ items: 'copy' }, button('Save'))))).toEqual(null)
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
  const host = mounted(buttonGroup({
    items: [{ label: 'Copy' }, { onClick: () => {} }, text('hi')],
  }, button('Save')))
  expect(panelOf(host).children.length).toEqual(1)
  expect(warned(warn, "not an object with a 'label'")).toBeTruthy()
})

test('an items list with nothing usable in it is logged and renders the row alone', () => {
  const warn = warnings()
  const host = mounted(buttonGroup({ items: [] }, button('Save')))
  expect(warned(warn, 'no usable entry')).toBeTruthy()
  expect(panelOf(host)).toEqual(null)
  expect(rowOf(host).children.length).toEqual(1)
})

test('a trigger without items, and a call with nothing at all, are logged', () => {
  const warn = warnings()
  mounted(buttonGroup({ trigger: 'arrow' }, button('Save')))
  expect(warned(warn, "pass 'items' as well")).toBeTruthy()
  const host = mounted(buttonGroup({ label: 'Empty' }))
  expect(warned(warn, 'nothing to render')).toBeTruthy()
  expect(rowOf(host).children.length).toEqual(0)
})

test('items with no children render the trigger alone as a dropdown', () => {
  const host = mounted(buttonGroup({ trigger: 'arrow', items: ACTIONS }))
  expect(rowOf(host).children.length).toEqual(1)
  expect(rowOf(host).children[0].classList.contains('trigger')).toEqual(true)
  expect(panelOf(host).children.length).toEqual(3)
})

test('the menu declares CSS anchor positioning against the row', () => {
  const sheet = sheetOf(withItems())
  expect(sheet).toContain('anchor-name: --imp-anchor')
  expect(sheet).toContain('position-anchor: --imp-anchor')
  expect(sheet).toContain('position-area: block-end span-inline-start')
  expect(sheet).toContain('position-try-fallbacks: flip-block')
})

test('the seam squares the corners between neighbours with logical properties', () => {
  const sheet = sheetOf(withItems())
  expect(sheet).toContain('--imp-corner-inline-start: 0')
  expect(sheet).toContain('--imp-corner-inline-end: 0')
  expect(sheet).not.toContain('margin-left')
  expect(sheet).not.toContain('border-top-left-radius')
})

test('a groupable button reads its corners from the seam custom properties', () => {
  const sheet = sheetOf(mounted(button('Save')))
  expect(sheet).toContain('var(--imp-corner-inline-start,')
  expect(sheet).toContain('var(--imp-corner-inline-end,')
})

test('a control lifts itself only inside a row, and a menu resets the seam', () => {
  const buttonSheet = sheetOf(mounted(button('Save')))
  expect(buttonSheet).toContain('z-index: var(--imp-seam-lift, auto)')
  const sheet = sheetOf(withItems())
  expect(sheet).toContain('--imp-seam-lift: 1')
  expect(sheet).toContain('--imp-corner-inline-start: initial')
  expect(sheet).toContain('--imp-seam-shift: initial')
  expect(sheet).toContain('--imp-seam-lift: initial')
})

const zoom = (extra = {}) =>
  mounted(buttonGroup(
    { label: 'Zoom', ...extra },
    button({ label: 'Zoom out', square: true }, icon(luStar)),
    '100%',
    button({ label: 'Zoom in', square: true }, icon(luStar)),
  ))

test('children make a named group of joined controls with no menu', () => {
  const host = zoom()
  const row = rowOf(host)
  expect(row.getAttribute('aria-label')).toEqual('Zoom')
  expect(panelOf(host)).toEqual(null)
  expect(inner(host, '.trigger')).toEqual(null)
  expect(firstOf(host).getAttribute('aria-label')).toEqual('Zoom out')
  expect(controlOf(row.children[2]).getAttribute('aria-label')).toEqual('Zoom in')
})

test('a plain text child renders as a read-only segment in the size of the group', () => {
  const host = zoom({ size: 'sm' })
  const row = rowOf(host)
  expect([...row.children].map((child) => child.localName))
    .toEqual(['imp-button', 'span', 'imp-button'])
  expect(row.children[1].classList.contains('segment')).toEqual(true)
  expect(row.children[1].classList.contains('size-sm')).toEqual(true)
  expect(row.children[1].textContent).toEqual('100%')
})

test('a state text child keeps the segment live', () => {
  let level
  const outer = mounted(stateHost((self) => {
    level = initState(self, 'std.zoom', 100)
    return buttonGroup({ label: 'Zoom' }, button('out'), level.text((value) => `${value}%`))
  }))
  const segment = inner(inner(outer, 'imp-button-group'), '.segment')
  expect(segment.textContent).toEqual('100%')
  level.set(125)
  expect(segment.textContent).toEqual('125%')
})

test('a node child is placed between the buttons as it is', () => {
  const field = text('12')
  const host = mounted(buttonGroup({}, button('Previous'), field, button('Next')))
  expect(rowOf(host).children[1]).toEqual(field)
})

test('a state-shaped label repaints the group name', () => {
  let name
  const outer = mounted(stateHost((self) => {
    name = initState(self, 'std.group', 'Zoom')
    return buttonGroup({ label: name }, button('out'), button('in'))
  }))
  const row = rowOf(inner(outer, 'imp-button-group'))
  expect(row.getAttribute('aria-label')).toEqual('Zoom')
  name.set('Scale')
  expect(row.getAttribute('aria-label')).toEqual('Scale')
})

test('children and items together join the trigger to the end of the row', () => {
  const host = mounted(buttonGroup(
    { items: ACTIONS },
    button({ variant: 'primary' }, 'Approve'),
    button('Comment'),
  ))
  const row = rowOf(host)
  expect(row.children.length).toEqual(3)
  expect(row.children[2].classList.contains('trigger')).toEqual(true)
  expect(firstOf(host).classList.contains('variant-primary')).toEqual(true)
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
  const host = mounted(stateHost((self) => button(initState(self, 'std.strayLabel', 'Save'))))
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
    mounted(stateHost((self) => {
      title = initState(self, 'std.emptyTitle', 'No invoices')
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

test('icon draws a Lucide icon as an inline svg stroked in the current color', () => {
  const host = mounted(icon(luHouse))
  expect(host.localName).toEqual('imp-icon')
  const svg = inner(host, 'svg')
  expect(svg.getAttribute('viewBox')).toEqual('0 0 24 24')
  expect(svg.getAttribute('stroke')).toEqual('currentColor')
  expect(svg.getAttribute('fill')).toEqual('none')
  expect(svg.getAttribute('class')).toContain('size-md')
  expect(svg.querySelectorAll('path').length).toEqual(luHouse.length)
})

test('icon draws every shape a Lucide icon is made of, not just its paths', () => {
  const svg = inner(mounted(icon(luCircleUser)), 'svg')
  expect(svg.querySelector('circle').getAttribute('cx')).toEqual(luCircleUser[0][1].cx)
  expect(svg.childNodes.length).toEqual(luCircleUser.length)
})

test('icon takes its drawing positionally or as a prop', () => {
  const warn = warnings()
  const positional = inner(mounted(icon(luHouse, { size: 'lg' })), 'svg')
  const named = inner(mounted(icon({ icon: luHouse, size: 'lg' })), 'svg')
  expect(positional.getAttribute('class')).toEqual(named.getAttribute('class'))
  expect(positional.innerHTML).toEqual(named.innerHTML)
  expect(warned(warn, 'multiple props objects')).toEqual(false)
})

test('an explicit icon prop wins over the positional drawing', () => {
  const svg = inner(mounted(icon(luHouse, { icon: luStar })), 'svg')
  expect(svg.innerHTML).toEqual(inner(mounted(icon(luStar)), 'svg').innerHTML)
})

test('an icon with no label is decorative', () => {
  const svg = inner(mounted(icon(luStar)), 'svg')
  expect(svg.getAttribute('aria-hidden')).toEqual('true')
  expect(svg.getAttribute('role')).toEqual(null)
})

test('a labelled icon is an image with a name', () => {
  const svg = inner(mounted(icon(luTrash, { label: 'Delete' })), 'svg')
  expect(svg.getAttribute('role')).toEqual('img')
  expect(svg.getAttribute('aria-label')).toEqual('Delete')
  expect(svg.getAttribute('aria-hidden')).toEqual(null)
})

test('icon sizes are the three steps or any CSS length', () => {
  expect(inner(mounted(icon(luStar, { size: 'sm' })), 'svg').getAttribute('class'))
    .toContain('size-sm')
  expect(inner(mounted(icon(luStar, { size: 'lg' })), 'svg').getAttribute('class'))
    .toContain('size-lg')
  expect(inner(mounted(icon(luStar, { size: '3rem' })), 'svg').style.blockSize).toEqual('3rem')
})

test('icon colors itself from a theme token', () => {
  expect(inner(mounted(icon(luStar, { color: 'primary' })), 'svg').getAttribute('class'))
    .toContain('color-primary')
  expect(inner(mounted(icon(luStar, { color: 'teal' })), 'svg').getAttribute('class'))
    .toContain('color-teal')
  expect(inner(mounted(icon(luStar)), 'svg').getAttribute('class')).toEqual('size-md')
})

test('an unknown icon color is logged and falls back to the text color', () => {
  const warn = warnings()
  const svg = inner(mounted(icon(luStar, { color: 'burgundy' })), 'svg')
  expect(warned(warn, "'color'")).toBeTruthy()
  expect(svg.getAttribute('class')).toEqual('size-md')
})

test('an icon with no drawing is logged and draws nothing', () => {
  const warn = warnings()
  const svg = inner(mounted(icon({ label: 'Nothing' })), 'svg')
  expect(warned(warn, "'icon' must be an icon from 'imp/icons'")).toBeTruthy()
  expect(svg.childNodes.length).toEqual(0)
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
    mounted(stateHost((self) => {
      status = initState(self, 'std.tagStatus', 'Draft')
      return tag({ color: 'blue' }, status.text())
    })),
    'imp-tag',
  )
  const pill = inner(host, '.tag')
  expect(pill.textContent).toEqual('Draft')
  status.set('Published')
  expect(pill.textContent).toEqual('Published')
})

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pointerAs = (node, type, pointerType) =>
  node.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerType }))

const tipOf = (host) => inner(host, '.tip')

const toggles = new WeakMap()

const tipOpen = (host) => {
  const tip = tipOf(host)
  if (!toggles.has(tip)) {
    const seen = { open: false }
    tip.addEventListener('toggle', (event) => {
      seen.open = event.newState === 'open'
    })
    toggles.set(tip, seen)
  }
  return toggles.get(tip).open
}

test('tooltip anchors a hidden popover to its one child', () => {
  const host = mounted(tooltip({ text: 'Delete' }, button({ label: 'Delete' }, icon(luTrash))))
  expect(host.localName).toEqual('imp-tooltip')
  const anchor = inner(host, '.anchor')
  expect(anchor.querySelector('imp-button')).toBeTruthy()
  expect(anchor.style.anchorName || '').toEqual('')
  expect(tipOf(host).style.positionAnchor).toContain('--imp-tip-')
  expect(tipOf(host).getAttribute('popover')).toEqual('manual')
  expect(tipOf(host).getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(tipOf(host))).toEqual('Delete')
  expect(tipOpen(host)).toEqual(false)
})

test('tooltip opens after the pointer rests on the control, and closes when it leaves', async () => {
  const host = mounted(tooltip({ text: 'Edit' }, button('Edit')))
  const anchor = inner(host, '.anchor')
  expect(tipOpen(host)).toEqual(false)
  pointerAs(anchor, 'pointerenter', 'mouse')
  expect(tipOpen(host)).toEqual(false)
  await pause(250)
  expect(tipOpen(host)).toEqual(true)
  pointerAs(anchor, 'pointerleave', 'mouse')
  expect(tipOpen(host)).toEqual(false)
})

test('tooltip opens on focus at once, and Escape closes it', () => {
  const host = mounted(tooltip({ text: 'Edit' }, button('Edit')))
  const anchor = inner(host, '.anchor')
  expect(tipOpen(host)).toEqual(false)
  anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(tipOpen(host)).toEqual(true)
  expect(anchor.style.anchorName).toContain(tipOf(host).style.positionAnchor)
  const sides = ['block-start', 'block-end', 'inline-start', 'inline-end']
  expect(sides.filter((side) => tipOf(host).classList.contains(side)).length).toEqual(1)
  anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(tipOpen(host)).toEqual(false)
  expect(anchor.style.anchorName || '').toEqual('')
})

test('tooltip opens on a touch hold, not on a tap', async () => {
  const host = mounted(tooltip({ text: 'Edit' }, button('Edit')))
  const anchor = inner(host, '.anchor')
  expect(tipOpen(host)).toEqual(false)
  pointerAs(anchor, 'pointerdown', 'touch')
  pointerAs(anchor, 'pointerup', 'touch')
  await pause(450)
  expect(tipOpen(host)).toEqual(false)
  pointerAs(anchor, 'pointerdown', 'touch')
  await pause(450)
  expect(tipOpen(host)).toEqual(true)
  pointerAs(anchor, 'pointerup', 'touch')
  expect(tipOpen(host)).toEqual(false)
})

test('tooltip warns about a missing text or child', () => {
  const warn = warnings()
  const host = mounted(tooltip({}))
  expect(warned(warn, "tooltip: pass 'text'")).toBeTruthy()
  expect(warned(warn, 'tooltip: pass the control as a child')).toBeTruthy()
  expect(tipOf(host)).toBeTruthy()
})

test('an unknown tag color is logged and falls back to neutral', () => {
  const warn = warnings()
  const pill = inner(mounted(tag({ color: 'chartreuse' }, 'Draft')), '.tag')
  expect(warned(warn, "'color'")).toBeTruthy()
  expect(pill.classList.contains('color-neutral')).toBeTruthy()
})

test('card renders a themed panel around its children', () => {
  const host = mounted(card(text('Body')))
  expect(host.localName).toEqual('imp-card')
  const panel = inner(host, '.card')
  expect(panel.localName).toEqual('div')
  expect(panel.classList.contains('padding-md')).toBeTruthy()
  expect(renderedText(inner(host, '.body'))).toEqual('Body')
  expect(inner(host, '.header')).toEqual(null)
  expect(inner(host, '.footer')).toEqual(null)
})

test('card places its header and footer around the body', () => {
  const host = mounted(card({ header: 'Invoices', footer: button('New') }, text('Body')))
  const panel = inner(host, '.card')
  expect([...panel.children].map((child) => child.className)).toEqual([
    'header',
    'body',
    'footer',
  ])
  expect(renderedText(inner(host, '.header'))).toEqual('Invoices')
  expect(renderedText(inner(host, '.footer'))).toEqual('New')
})

test('a state-shaped card header updates in place', () => {
  let title
  const host = inner(
    mounted(stateHost((self) => {
      title = initState(self, 'std.cardTitle', 'Draft')
      return card({ header: title }, text('Body'))
    })),
    'imp-card',
  )
  const header = inner(host, '.header')
  expect(header.textContent).toEqual('Draft')
  title.set('Sent')
  expect(header.textContent).toEqual('Sent')
})

test('card takes a padding size', () => {
  const panel = inner(mounted(card({ padding: 'sm' }, text('Body'))), '.card')
  expect(panel.classList.contains('padding-sm')).toBeTruthy()
})

test('an unknown card padding is logged and falls back to md', () => {
  const warn = warnings()
  const panel = inner(mounted(card({ padding: 'huge' }, text('Body'))), '.card')
  expect(warned(warn, "'padding'")).toBeTruthy()
  expect(panel.classList.contains('padding-md')).toBeTruthy()
})

test('a card with a label and no href is a named region', () => {
  const panel = inner(mounted(card({ label: 'Billing' }, text('Body'))), '.card')
  expect(panel.localName).toEqual('section')
  expect(panel.getAttribute('aria-label')).toEqual('Billing')
})

test('a card with an href is one anchor that navigates in the app', () => {
  const panel = inner(mounted(card({ href: '/projects/1', label: 'Atlas' }, text('Body'))), '.card')
  expect(panel.localName).toEqual('a')
  expect(panel.getAttribute('href')).toEqual('/projects/1')
  expect(panel.getAttribute('aria-label')).toEqual('Atlas')
  click(panel)
  expect(globalThis.location.pathname).toEqual('/projects/1')
})

test('an off-site card link is left to the browser', () => {
  const panel = inner(mounted(card({ href: 'https://example.com' }, text('Body'))), '.card')
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  panel.dispatchEvent(event)
  expect(event.defaultPrevented).toEqual(false)
})
