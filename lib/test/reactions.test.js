import { component, mount } from 'imp'
import { card } from 'imp/std/display'
import { reactions } from 'imp/std/feedback'
import { text } from 'imp/std'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const THUMBS_UP = '\u{1F44D}'

const PARTY = '\u{1F389}'

const HEART = '\u{2764}\u{FE0F}'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const chips = (host) =>
  innerAll(host, '.chip').map((chip) => ({
    emoji: chip.querySelector('.glyph').textContent,
    count: chip.querySelector('.count').textContent,
    pressed: chip.getAttribute('aria-pressed'),
  }))

const chipOf = (host, emoji) =>
  innerAll(host, '.chip').find((chip) => chip.querySelector('.glyph').textContent === emoji)

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const stateHost = component('reactions-state-host', {
  setup: (self, render) => render(self),
})

const withState = (initial, props = {}) => {
  let items
  const host = mounted(stateHost((self) => {
    items = initState(self, 'demo.reactions', initial)
    return reactions({ items, ...props })
  }))
  return { items, bar: host.shadowRoot.querySelector('imp-reactions') }
}

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en')
})

test('reactions wraps its content and renders a named group of toggle chips', () => {
  const host = mounted(reactions(
    { items: [{ emoji: THUMBS_UP, count: 3, reacted: true }, { emoji: PARTY, count: 1 }] },
    card(text('A post')),
  ))
  expect(host.localName).toEqual('imp-reactions')
  expect(inner(host, '.content imp-card')).not.toEqual(null)
  const bar = inner(host, '.bar')
  expect(bar.getAttribute('role')).toEqual('group')
  expect(bar.getAttribute('aria-label')).toEqual('Reactions')
  expect(chips(host)).toEqual([
    { emoji: THUMBS_UP, count: '3', pressed: 'true' },
    { emoji: PARTY, count: '1', pressed: 'false' },
  ])
  expect(innerAll(host, '.chip').every((chip) => chip.localName === 'button')).toEqual(true)
  const add = inner(host, '.add')
  expect(add.getAttribute('aria-label')).toEqual('Add a reaction')
  expect(add.getAttribute('aria-haspopup')).toEqual('dialog')
})

test('with no content it renders the bar alone', () => {
  const host = mounted(reactions({ items: [{ emoji: THUMBS_UP, count: 1 }] }))
  expect(inner(host, '.content')).toEqual(null)
  expect(chips(host).length).toEqual(1)
})

test('a click toggles the reaction of the person and calls onReact', () => {
  const onReact = spy()
  const host = mounted(reactions({
    items: [{ emoji: THUMBS_UP, count: 3, reacted: true }, { emoji: PARTY, count: 1 }],
    onReact,
  }))
  invoke(chipOf(host, PARTY))
  expect(chips(host)[1]).toEqual({ emoji: PARTY, count: '2', pressed: 'true' })
  invoke(chipOf(host, THUMBS_UP))
  expect(chips(host)[0]).toEqual({ emoji: THUMBS_UP, count: '2', pressed: 'false' })
  expect(onReact.calls).toEqual([[PARTY, true], [THUMBS_UP, false]])
})

test('taking back the last reaction removes the chip and keeps the focus in the bar', () => {
  const host = mounted(reactions({ items: [{ emoji: PARTY, count: 1, reacted: true }] }))
  const chip = chipOf(host, PARTY)
  chip.focus()
  invoke(chip)
  expect(chips(host)).toEqual([])
  expect(host.shadowRoot.activeElement).toEqual(inner(host, '.add'))
})

test('a writable state receives each change, and keeps the other fields of an item', () => {
  const { items, bar } = withState([{ id: 7, emoji: THUMBS_UP, count: 2 }])
  invoke(chipOf(bar, THUMBS_UP))
  expect(items.get()).toEqual([{ id: 7, emoji: THUMBS_UP, count: 3, reacted: true }])
  items.set([{ emoji: HEART, count: 5 }])
  expect(chips(bar)).toEqual([{ emoji: HEART, count: '5', pressed: 'false' }])
})

test('a rejected onReact takes the reaction back', async () => {
  const warn = spy(console, 'warn', () => {})
  const { items, bar } = withState([{ emoji: THUMBS_UP, count: 2 }], {
    onReact: () => Promise.reject(new Error('offline')),
  })
  invoke(chipOf(bar, THUMBS_UP))
  expect(items.get()[0].count).toEqual(3)
  await settle()
  expect(items.get()).toEqual([{ emoji: THUMBS_UP, count: 2, reacted: false }])
  expect(chips(bar)).toEqual([{ emoji: THUMBS_UP, count: '2', pressed: 'false' }])
  expect(warn.calls.some(([first]) => String(first).includes("'onReact' failed"))).toEqual(true)
})

test('the add button opens the emoji panel, and a pick adds a reaction', () => {
  const onReact = spy()
  const host = mounted(reactions({ items: [{ emoji: THUMBS_UP, count: 1 }], onReact }))
  const add = inner(host, '.add')
  const panel = inner(host, '.panel')
  expect(panel.getAttribute('role')).toEqual('dialog')
  expect(panel.getAttribute('aria-label')).toEqual('Add a reaction')
  add.focus()
  invoke(add)
  expect(add.getAttribute('aria-expanded')).toEqual('true')
  const search = inner(host, '.emoji-search')
  expect(host.shadowRoot.activeElement).toEqual(search)
  type(search, 'rocket')
  const rocket = innerAll(host, '.emoji-choice').find((choice) => !choice.hidden)
  rocket.focus()
  invoke(rocket)
  expect(add.getAttribute('aria-expanded')).toEqual('false')
  expect(host.shadowRoot.activeElement).toEqual(add)
  expect(chips(host).at(-1)).toEqual({ emoji: '\u{1F680}', count: '1', pressed: 'true' })
  expect(onReact.calls).toEqual([['\u{1F680}', true]])
})

test('a pick of an emoji already in the bar marks it and never takes it back', () => {
  const onReact = spy()
  const host = mounted(reactions({
    items: [{ emoji: HEART, count: 4 }, { emoji: THUMBS_UP, count: 1, reacted: true }],
    emojis: [HEART, THUMBS_UP],
    onReact,
  }))
  invoke(inner(host, '.add'))
  expect(inner(host, '.emoji-search')).toEqual(null)
  const [heart, thumbsUp] = innerAll(host, '.emoji-choice')
  invoke(heart)
  invoke(inner(host, '.add'))
  invoke(thumbsUp)
  expect(chips(host)).toEqual([
    { emoji: HEART, count: '5', pressed: 'true' },
    { emoji: THUMBS_UP, count: '1', pressed: 'true' },
  ])
  expect(onReact.calls).toEqual([[HEART, true]])
})

test('disabled is live: chips are disabled and the add button hides', () => {
  let off
  const host = mounted(stateHost((self) => {
    off = initState(self, 'demo.reactions.off', true)
    return reactions({ items: [{ emoji: THUMBS_UP, count: 1 }], disabled: off })
  })).shadowRoot.querySelector('imp-reactions')
  expect(chipOf(host, THUMBS_UP).disabled).toEqual(true)
  expect(inner(host, '.add').hidden).toEqual(true)
  off.set(false)
  expect(chipOf(host, THUMBS_UP).disabled).toEqual(false)
  expect(inner(host, '.add').hidden).toEqual(false)
})

test('a large count shows short, and a bad item is skipped with a warning', () => {
  const warn = spy(console, 'warn', () => {})
  const host = mounted(reactions({
    items: [{ emoji: THUMBS_UP, count: 1284 }, { emoji: PARTY, count: 'many' }, {
      emoji: HEART,
      count: 0,
    }],
  }))
  expect(chips(host)).toEqual([{ emoji: THUMBS_UP, count: '1.3K', pressed: 'false' }])
  expect(warn.calls.some(([first]) => String(first).includes('a whole'))).toEqual(true)
})
