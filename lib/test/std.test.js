import { component, mount } from 'imp'
import { button, heading, icon, link, menuButton, text } from 'imp/std'
import { luCircleCheck, luCircleUser, luHouse, luInbox, luStar, luTrash } from 'imp/icons'
import { card, emptyState, tag, tooltip } from 'imp/std/display'
import { flex } from 'imp/std/layout'
import {
  comboBox,
  datePicker,
  dateRangePicker,
  emojiPicker,
  segmented,
  select,
  textField,
  treeSelect,
} from 'imp/std/inputs'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText, settled } from './shadow.js'
import { computed, initState } from 'imp/state'

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

test('button with a read-only pressed state shows the state and leaves it to the click handler', () => {
  let picked = null
  const warn = warnings()
  const host = mounted(stateHost((self) => {
    picked = initState(self, 'toggle.picked', 'b')
    const pick = (id) =>
      button({
        pressed: computed([picked], (current) => current === id),
        events: { click: () => picked.set(id) },
      }, id)
    return flex(pick('a'), pick('b'))
  }))
  const [first, second] = [...inner(host, 'imp-flex').shadowRoot.querySelectorAll('imp-button')]
    .map((node) => node.shadowRoot.querySelector('button'))
  click(first)
  expect(picked.get()).toEqual('a')
  expect(first.getAttribute('aria-pressed')).toEqual('true')
  expect(second.getAttribute('aria-pressed')).toEqual('false')
  click(first)
  expect(first.getAttribute('aria-pressed')).toEqual('true')
  expect(warned(warn, 'read-only')).toEqual(false)
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

test('a focused button that turns busy keeps the focus and ignores a click', () => {
  let loading
  let clicks = 0
  const host = inner(
    mounted(stateHost((self) => {
      loading = initState(self, 'std.loading', false)
      return button({ loading, events: { click: () => clicks++ } }, 'Save')
    })),
    'imp-button',
  )
  const control = inner(host, 'button')
  control.focus()
  loading.set(true)
  expect(host.shadowRoot.activeElement === control).toEqual(true)
  expect(control.disabled).toEqual(false)
  expect(control.getAttribute('aria-disabled')).toEqual('true')
  control.click()
  expect(clicks).toEqual(0)
  control.blur()
  expect(control.disabled).toEqual(true)
  expect(control.hasAttribute('aria-disabled')).toEqual(false)
  loading.set(false)
  control.click()
  expect(clicks).toEqual(1)
})

test('a focused button that turns disabled keeps the focus', () => {
  let disabled
  const host = inner(
    mounted(stateHost((self) => {
      disabled = initState(self, 'std.disabled', false)
      return button({ disabled }, 'Clear')
    })),
    'imp-button',
  )
  const control = inner(host, 'button')
  control.focus()
  disabled.set(true)
  expect(host.shadowRoot.activeElement === control).toEqual(true)
  expect(control.getAttribute('aria-disabled')).toEqual('true')
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
  document.body.append(panel)
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

const withItems = (extra = {}, ...children) =>
  mounted(menuButton({ items: ACTIONS, ...extra }, ...children))

const boxOf = (host) => inner(host, '.box')

const panelOf = (host) => inner(host, '.panel')

const controlOf = (node) => node.shadowRoot.querySelector('.button')

const triggerOf = (host) => controlOf(inner(host, '.trigger'))

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const isOpen = (trigger) => trigger.getAttribute('aria-expanded') === 'true'

const nextTask = () => new Promise((resolve) => setTimeout(resolve))

const sheetOf = (host) =>
  [...host.shadowRoot.adoptedStyleSheets]
    .map((style) => [...style.cssRules].map((rule) => rule.cssText).join('\n'))
    .join('\n')

test('menuButton renders a square trigger and a menu it can open', () => {
  const host = withItems()
  expect(host.localName).toEqual('imp-menu-button')
  const box = boxOf(host)
  expect([...box.children].map((child) => child.localName)).toEqual(['imp-button', 'div'])
  expect(box.children[0].classList.contains('trigger')).toEqual(true)
  const trigger = triggerOf(host)
  expect(trigger.classList.contains('square')).toEqual(true)
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

test('a menu item takes a Lucide export as its icon and draws it', () => {
  const host = mounted(menuButton({ items: [{ id: 'trash', label: 'Delete', icon: luTrash }] }))
  const option = panelOf(host).children[0]
  expect(option.textContent).toEqual('Delete')
  expect(option.querySelector('.icon imp-icon')).toBeTruthy()
})

test('children label the trigger, and the glyph follows the text', () => {
  const host = withItems({ trigger: 'arrow' }, 'Export')
  const trigger = triggerOf(host)
  expect(trigger.classList.contains('square')).toEqual(false)
  expect(renderedText(inner(host, '.trigger'))).toContain('Export')
  const label = trigger.querySelector('.label')
  expect(label.lastElementChild.localName).toEqual('svg')
  expect(getComputedStyle(label).display).toEqual('flex')
})

test('the trigger opens the menu, tracks aria-expanded and focuses the first option', async () => {
  const host = withItems()
  const panel = panelOf(host)
  invoke(triggerOf(host))
  expect(isOpen(triggerOf(host))).toEqual(true)
  await nextTask()
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

test('arrow keys walk the enabled options and skip a disabled one', async () => {
  const host = withItems()
  const panel = panelOf(host)
  invoke(triggerOf(host))
  await nextTask()
  press(panel.children[0], 'ArrowDown')
  expect(panel.children[1].tabIndex).toEqual(0)
  press(panel.children[1], 'ArrowDown')
  expect(panel.children[0].tabIndex).toEqual(0)
  press(panel.children[0], 'End')
  expect(panel.children[1].tabIndex).toEqual(0)
})

test('closing the menu from an option hands focus back to the trigger', async () => {
  const host = withItems()
  invoke(triggerOf(host))
  await nextTask()
  expect(host.shadowRoot.activeElement).toEqual(panelOf(host).children[0])
  panelOf(host).hidePopover()
  expect(triggerOf(host).getAttribute('aria-expanded')).toEqual('false')
  await nextTask()
  expect(host.shadowRoot.activeElement).toEqual(inner(host, '.trigger'))
})

test('choosing an option closes the menu, reports the choice and runs its onClick', () => {
  const chosen = []
  const host = mounted(menuButton({
    items: [{ id: 'copy', label: 'Copy', onClick: (detail) => chosen.push(detail.id) }],
  }))
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
  const host = withItems({ events: { select: (event) => seen.push(event.detail.id) } })
  invoke(triggerOf(host))
  invoke(panelOf(host).children[1])
  expect(seen).toEqual(['rename'])
})

test('cancelling the select event leaves the option onClick unrun', () => {
  const chosen = []
  const host = mounted(menuButton({
    items: [{ id: 'copy', label: 'Copy', onClick: () => chosen.push('copy') }],
  }))
  host.addEventListener('select', (event) => event.preventDefault())
  invoke(triggerOf(host))
  invoke(panelOf(host).children[0])
  expect(chosen).toEqual([])
})

test('a disabled menuButton disables its trigger', () => {
  expect(triggerOf(withItems({ disabled: true })).disabled).toEqual(true)
})

test('a state-shaped disabled shuts an open menu', () => {
  let blocked
  const outer = mounted(stateHost((self) => {
    blocked = initState(self, 'std.blocked', false)
    return menuButton({ items: ACTIONS, disabled: blocked })
  }))
  const host = inner(outer, 'imp-menu-button')
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

test('the more trigger names itself as more actions, and label overrides that name', () => {
  expect(triggerOf(withItems()).getAttribute('aria-label')).toEqual('More actions')
  expect(triggerOf(withItems({ label: 'Actions for Ada' })).getAttribute('aria-label'))
    .toEqual('Actions for Ada')
})

test('a trigger with text takes its name from that text, and label still overrides it', () => {
  expect(triggerOf(withItems({}, 'Actions')).hasAttribute('aria-label')).toEqual(false)
  expect(triggerOf(withItems({ label: 'Actions for Ada' }, 'Actions')).getAttribute('aria-label'))
    .toEqual('Actions for Ada')
})

test('variant and size style the trigger', () => {
  const trigger = triggerOf(withItems({ variant: 'primary', size: 'sm' }))
  expect(trigger.classList.contains('variant-primary')).toEqual(true)
  expect(trigger.classList.contains('size-sm')).toEqual(true)
})

test('the trigger sizes its icon like any button', () => {
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
  expect(panelOf(mounted(menuButton({ items: 'copy' })))).toEqual(null)
  expect(warned(warn, "'items' must be an array")).toBeTruthy()
  const host = mounted(menuButton({
    items: [{ label: 'Copy' }, { onClick: () => {} }, text('hi')],
  }))
  expect(panelOf(host).children.length).toEqual(1)
  expect(warned(warn, "not an object with a 'label'")).toBeTruthy()
})

test('an items list with nothing usable in it renders a disabled trigger that announces no menu', () => {
  const warn = warnings()
  const host = mounted(menuButton({ items: [] }))
  expect(warned(warn, 'no usable entry')).toBeTruthy()
  expect(panelOf(host)).toEqual(null)
  expect(boxOf(host).children.length).toEqual(1)
  const trigger = triggerOf(host)
  expect(trigger.disabled).toEqual(true)
  expect(trigger.hasAttribute('aria-haspopup')).toEqual(false)
  expect(trigger.hasAttribute('aria-expanded')).toEqual(false)
  expect(trigger.popoverTargetElement ?? null).toEqual(null)
})

test('the menu declares CSS anchor positioning against its box', () => {
  const sheet = sheetOf(withItems())
  expect(sheet).toContain('anchor-name: --imp-anchor')
  expect(sheet).toContain('position-anchor: --imp-anchor')
  expect(sheet).toContain('position-area: block-end span-inline-start')
  expect(sheet).toContain('position-try: most-block-size flip-block, flip-inline')
})

test('the seam squares the corners between neighbours with logical properties', () => {
  const sheet = sheetOf(mounted(flex({ joined: true }, button('a'), button('b'))))
  expect(sheet).toContain('--imp-seam-lift: 1')
  expect(sheet).toContain('--imp-seam-keep: 2')
  expect(sheet).toContain('--imp-corner-inline-start: 0')
  expect(sheet).toContain('--imp-corner-inline-end: 0')
  expect(sheet).not.toContain('margin-left')
  expect(sheet).not.toContain('border-top-left-radius')
})

test('every single-line control takes the control box of its size', () => {
  const box =
    'min-block-size: calc(var(--imp-font-size-md, 1rem) * var(--imp-line-height-tight, 1.25) + 2 * var(--imp-space-2, 8px) + 2 * var(--imp-border-width, 1px))'
  const controls = [
    button('Save'),
    segmented({ label: 'Size', options: ['sm', 'md'] }),
    textField({ label: 'Name' }),
    select({ label: 'Plan', options: ['free'] }),
    comboBox({ label: 'Country', options: ['Peru'] }),
    datePicker({ label: 'Date' }),
    dateRangePicker({ label: 'Period' }),
    treeSelect({ label: 'Pages', items: [] }),
    emojiPicker({ label: 'Emoji' }),
  ]
  for (const control of controls) expect(sheetOf(mounted(control))).toContain(box)
  expect(sheetOf(mounted(button('Save')))).toContain(
    'min-inline-size: calc(var(--imp-font-size-md, 1rem) * var(--imp-line-height-tight, 1.25)',
  )
})

test('a groupable button reads its corners from the seam custom properties', () => {
  const sheet = sheetOf(mounted(button('Save')))
  expect(sheet).toContain('var(--imp-corner-inline-start,')
  expect(sheet).toContain('var(--imp-corner-inline-end,')
})

test('a control lifts itself only inside a row, and a menu resets the seam', () => {
  const buttonSheet = sheetOf(mounted(button('Save')))
  expect(buttonSheet).toContain('z-index: var(--imp-seam-lift, auto)')
  expect(buttonSheet).toContain('z-index: var(--imp-seam-keep, auto)')
  const sheet = sheetOf(withItems())
  expect(sheet).toContain('--imp-corner-inline-start: initial')
  expect(sheet).toContain('--imp-seam-shift: initial')
  expect(sheet).toContain('--imp-seam-lift: initial')
  expect(sheet).toContain('--imp-seam-keep: initial')
})

test('a menuButton inside a joined flex row sits at the end of the row as one host', () => {
  const host = mounted(flex(
    { joined: true },
    button({ variant: 'primary' }, 'Approve'),
    button('Comment'),
    menuButton({ items: ACTIONS }),
  ))
  const row = inner(host, '.root')
  expect([...row.children].map((child) => child.localName))
    .toEqual(['imp-button', 'imp-button', 'imp-menu-button'])
  expect(controlOf(row.children[0]).classList.contains('variant-primary')).toEqual(true)
  expect(triggerOf(row.children[2]).classList.contains('square')).toEqual(true)
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
  expect(anchor.getAttribute('rel')).toEqual('noopener')
})

test('clicking an in-app link navigates without a page load', () => {
  const anchor = inner(mounted(link({ href: '/settings' }, 'Settings')), 'a')
  click(anchor)
  expect(globalThis.location.pathname).toEqual('/settings')
})

const leftToBrowser = (node) => {
  let left = null
  const stopNavigation = (event) => {
    left = !event.defaultPrevented
    event.preventDefault()
  }
  node.getRootNode().addEventListener('click', stopNavigation, { once: true })
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return left
}

test('an off-site link is left to the browser', () => {
  const anchor = inner(mounted(link({ href: 'https://example.com' }, 'Docs')), 'a')
  expect(leftToBrowser(anchor)).toEqual(true)
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

test('emptyState draws the imp mark when it is given no icon and no image', () => {
  const host = mounted(emptyState())
  const mark = inner(host, '.image > svg')
  expect(mark).toBeTruthy()
  expect(mark.getAttribute('aria-hidden')).toEqual('true')
  expect(mark.getAttribute('viewBox')).toEqual('55 -10 252 252')
  expect(inner(host, '.icon')).toEqual(null)
})

test('emptyState takes a drawing as a node or as an image URL, in place of the mark', () => {
  const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  drawing.id = 'art'
  const own = mounted(emptyState({ image: drawing, title: 'No photos' }))
  expect(inner(own, '.image > svg').id).toEqual('art')
  const linked = mounted(emptyState({ image: '/art/empty.png', title: 'No photos' }))
  const picture = inner(linked, '.image > img')
  expect(picture.getAttribute('src')).toEqual('/art/empty.png')
  expect(picture.getAttribute('alt')).toEqual('')
  expect(inner(mounted(emptyState({ icon: luInbox })), '.image')).toEqual(null)
})

test('emptyState with both an icon and an image warns and draws the image', () => {
  const warn = warnings()
  const host = mounted(emptyState({ icon: luInbox, image: '/art/empty.png' }))
  expect(warned(warn, "pass 'icon' or 'image', not both")).toBeTruthy()
  expect(inner(host, '.image > img')).toBeTruthy()
  expect(inner(host, '.icon')).toEqual(null)
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

test('emptyState draws a large muted icon above the title', () => {
  const host = mounted(emptyState({ icon: luInbox, title: 'No messages' }))
  const root = inner(host, '.root')
  expect(root.firstElementChild.classList.contains('icon')).toBeTruthy()
  const svg = inner(host, '.icon imp-icon').shadowRoot.querySelector('svg')
  expect(svg.getAttribute('aria-hidden')).toEqual('true')
  expect(svg.style.inlineSize).toEqual('3rem')
  expect(svg.classList.contains('color-secondary')).toBeTruthy()
})

test('emptyState without an icon draws none', () => {
  expect(inner(mounted(emptyState()), '.icon')).toEqual(null)
})

test('the kind of an emptyState tints the icon only', () => {
  const tintOf = (kind) =>
    inner(mounted(emptyState({ icon: luCircleCheck, kind })), '.icon imp-icon')
      .shadowRoot.querySelector('svg').getAttribute('class')
  expect(tintOf('success')).toContain('color-success')
  expect(tintOf('error')).toContain('color-danger')
  expect(tintOf('warning')).toContain('color-warning')
  expect(tintOf('info')).toContain('color-info')
  expect(tintOf('neutral')).toContain('color-secondary')
})

test('a kind keeps the wording of the variant', () => {
  const host = mounted(emptyState({ icon: luCircleCheck, kind: 'success', variant: 'noResults' }))
  expect(renderedText(inner(host, '.title'))).toEqual('No results')
})

test('an unknown kind, and a kind with no icon, are logged', () => {
  const warn = warnings()
  const host = mounted(emptyState({ icon: luInbox, kind: 'fatal' }))
  expect(warned(warn, "'kind' must be one of")).toBeTruthy()
  const svg = inner(host, '.icon imp-icon').shadowRoot.querySelector('svg')
  expect(svg.classList.contains('color-secondary')).toBeTruthy()
  mounted(emptyState({ kind: 'success' }))
  expect(warned(warn, "'kind' only tints the 'icon'")).toBeTruthy()
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

test('a tag with a dot draws a decorative circle before the label', () => {
  const pill = inner(mounted(tag({ color: 'green', dot: true }, 'Online')), '.tag')
  const circle = pill.firstElementChild
  expect(circle.classList.contains('dot')).toBeTruthy()
  expect(circle.getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(pill)).toEqual('Online')
  expect(pill.hasAttribute('role')).toEqual(false)
})

test('a tag without dot draws no circle', () => {
  expect(inner(mounted(tag({ color: 'green' }, 'Online')), '.dot')).toEqual(null)
})

test('a dot with no text is a bare status dot that the label names', () => {
  const host = mounted(tag({ color: 'red', dot: true, size: 'lg', label: 'Offline' }))
  expect(inner(host, '.tag')).toEqual(null)
  const bare = inner(host, '.bare')
  expect(bare.getAttribute('role')).toEqual('img')
  expect(bare.getAttribute('aria-label')).toEqual('Offline')
  expect(bare.classList.contains('color-red')).toBeTruthy()
  expect(bare.classList.contains('size-lg')).toBeTruthy()
  expect(bare.querySelector('.dot')).toBeTruthy()
})

test('a live label renames the bare dot in place', () => {
  let health
  const host = inner(
    mounted(stateHost((self) => {
      health = initState(self, 'std.tagHealth', 'Online')
      return tag({ color: 'green', dot: true, label: health })
    })),
    'imp-tag',
  )
  health.set('Degraded')
  expect(inner(host, '.bare').getAttribute('aria-label')).toEqual('Degraded')
})

test('a bare dot with no label is logged', () => {
  const warn = warnings()
  const bare = inner(mounted(tag({ color: 'red', dot: true })), '.bare')
  expect(warned(warn, "needs a 'label'")).toBeTruthy()
  expect(bare.hasAttribute('aria-label')).toEqual(false)
})

test('a label on a tag with text is logged and ignored', () => {
  const warn = warnings()
  const pill = inner(mounted(tag({ dot: true, label: 'Online' }, 'Online')), '.tag')
  expect(warned(warn, "'label' names a dot with no text only")).toBeTruthy()
  expect(pill.hasAttribute('aria-label')).toEqual(false)
})

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pointerAs = (node, type, pointerType) =>
  node.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerType }))

const tipOf = (host) => inner(host, '.tip')

const tipOpen = (host) => tipOf(host).matches(':popover-open')

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

test('tooltip gives the anchor name back when it leaves the page while open', async () => {
  const host = mounted(tooltip({ text: 'Edit' }, button('Edit')))
  const anchor = inner(host, '.anchor')
  anchor.style.anchorName = '--own'
  expect(tipOpen(host)).toEqual(false)
  anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  expect(tipOpen(host)).toEqual(true)
  expect(anchor.style.anchorName).toContain(tipOf(host).style.positionAnchor)
  host.remove()
  await settled()
  expect(anchor.style.anchorName).toEqual('--own')
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
  expect(leftToBrowser(panel)).toEqual(true)
})
