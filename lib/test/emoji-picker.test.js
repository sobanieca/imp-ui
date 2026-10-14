import { component, mount } from 'imp'
import { emojiPicker, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { initState, useState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'

const ROCKET = '\u{1F680}'

const THUMBS_UP = '\u{1F44D}'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const inner = (host, selector) => host.shadowRoot.querySelector(selector)

const innerAll = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const triggerOf = (host) => inner(host, '#control')

const toggled = () => new Promise((resolve) => setTimeout(resolve))

const invoke = (node) => {
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
}

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const type = (input, value) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const visibleChoices = (host) => innerAll(host, '.emoji-choice').filter((choice) => !choice.hidden)

const focused = (host) => host.shadowRoot.activeElement

const isOpen = (host) => triggerOf(host).getAttribute('aria-expanded') === 'true'

const stateHost = component('emoji-picker-state-host', {
  setup: (self, render) => render(self),
})

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.setAttribute('lang', 'en')
})

test('emojiPicker renders a labelled trigger that shows the emoji and its name', () => {
  const host = mounted(emojiPicker({ value: ROCKET, label: 'Project icon' }))
  expect(host.localName).toEqual('imp-emoji-picker')
  const trigger = triggerOf(host)
  expect(trigger.localName).toEqual('button')
  expect(trigger.getAttribute('aria-haspopup')).toEqual('dialog')
  expect(trigger.getAttribute('aria-expanded')).toEqual('false')
  expect(inner(host, 'label').getAttribute('for')).toEqual('control')
  expect(inner(host, '.glyph').textContent).toEqual(ROCKET)
  expect(inner(host, '#value').textContent).toEqual('rocket')
  expect(trigger.getAttribute('aria-describedby')).toContain('value')
})

test('an empty emojiPicker shows its placeholder and no clear button', () => {
  const host = mounted(emojiPicker({ label: 'Icon', placeholder: 'No emoji' }))
  expect(inner(host, '#value').textContent).toEqual('No emoji')
  expect(inner(host, '#value').classList.contains('placeholder')).toEqual(true)
  expect(inner(host, '.clear').hidden).toEqual(true)
})

test('the trigger opens a named dialog with search, categories and the full set', async () => {
  const host = mounted(emojiPicker({ label: 'Icon' }))
  const panel = inner(host, '#panel')
  expect(panel.getAttribute('popover')).toEqual('auto')
  expect(panel.getAttribute('role')).toEqual('dialog')
  expect(panel.getAttribute('aria-label')).toEqual('Choose an emoji')
  invoke(triggerOf(host))
  await toggled()
  expect(isOpen(host)).toEqual(true)
  const search = inner(host, '.emoji-search')
  expect(search.getAttribute('aria-label')).toEqual('Search emoji')
  expect(focused(host)).toEqual(search)
  const categories = innerAll(host, '.emoji-category')
  expect(categories.length).toEqual(8)
  expect(categories[0].getAttribute('aria-label')).toEqual('Smileys')
  expect(innerAll(host, "[role='group']")[0].getAttribute('aria-label')).toEqual('Smileys')
  expect(innerAll(host, '.emoji-choice').length).toEqual(482)
  expect(innerAll(host, ".emoji-choice[tabindex='0']").length).toEqual(1)
})

test('search matches names and keywords, and hides the categories', async () => {
  const host = mounted(emojiPicker({ label: 'Icon' }))
  invoke(triggerOf(host))
  await toggled()
  const search = inner(host, '.emoji-search')
  type(search, 'coffee')
  expect(visibleChoices(host).map((choice) => choice.textContent)).toEqual(['\u{2615}'])
  expect(inner(host, '.emoji-categories').hidden).toEqual(true)
  type(search, 'thumbs up')
  expect(visibleChoices(host).map((choice) => choice.textContent)).toEqual([THUMBS_UP])
  type(search, 'zzqq')
  expect(visibleChoices(host).length).toEqual(0)
  expect(inner(host, '.emoji-empty').hidden).toEqual(false)
  expect(inner(host, '.emoji-empty').textContent).toEqual('No emoji found')
})

test('a click commits the emoji, closes the panel and returns the focus', async () => {
  let chosen
  mounted(stateHost((self) => {
    chosen = initState(self, 'demo.emoji', undefined)
    return emojiPicker({ value: chosen, label: 'Icon' })
  }))
  const host = document.querySelector('emoji-picker-state-host').shadowRoot.querySelector(
    'imp-emoji-picker',
  )
  invoke(triggerOf(host))
  await toggled()
  type(inner(host, '.emoji-search'), 'rocket')
  visibleChoices(host)[0].focus()
  invoke(visibleChoices(host)[0])
  expect(chosen.get()).toEqual(ROCKET)
  expect(isOpen(host)).toEqual(false)
  await toggled()
  expect(focused(host)).toEqual(triggerOf(host))
  expect(inner(host, '.clear').hidden).toEqual(false)
})

test('Enter in the search field picks the first match', async () => {
  const host = mounted(emojiPicker({ value: undefined, label: 'Icon' }))
  invoke(triggerOf(host))
  await toggled()
  const search = inner(host, '.emoji-search')
  type(search, 'pizza')
  press(search, 'Enter')
  expect(inner(host, '.glyph').textContent).toEqual('\u{1F355}')
  expect(isOpen(host)).toEqual(false)
})

test('arrow keys move through the grid and back to the search field', async () => {
  const host = mounted(emojiPicker({ label: 'Icon' }))
  invoke(triggerOf(host))
  await toggled()
  const search = inner(host, '.emoji-search')
  press(search, 'ArrowDown')
  const choices = innerAll(host, '.emoji-choice')
  expect(focused(host)).toEqual(choices[0])
  press(focused(host), 'ArrowRight')
  expect(focused(host)).toEqual(choices[1])
  press(focused(host), 'ArrowDown')
  expect(focused(host)).toEqual(choices[9])
  press(focused(host), 'ArrowLeft')
  expect(focused(host)).toEqual(choices[8])
  expect(innerAll(host, ".emoji-choice[tabindex='0']")).toEqual([choices[8]])
  press(focused(host), 'ArrowUp')
  press(focused(host), 'ArrowUp')
  expect(focused(host)).toEqual(search)
})

test('arrow keys mirror under dir=rtl', async () => {
  const host = mounted(emojiPicker({ label: 'Icon' }))
  invoke(triggerOf(host))
  await toggled()
  press(inner(host, '.emoji-search'), 'ArrowDown')
  spy(globalThis, 'getComputedStyle', () => ({ direction: 'rtl' }))
  const choices = innerAll(host, '.emoji-choice')
  press(focused(host), 'ArrowLeft')
  expect(focused(host)).toEqual(choices[1])
  press(focused(host), 'ArrowRight')
  expect(focused(host)).toEqual(choices[0])
})

test('emojis offers a specific set with no search and no categories', async () => {
  const host = mounted(emojiPicker({
    label: 'Health',
    emojis: [THUMBS_UP, { emoji: '\u{1F7E2}', name: 'On track', keywords: ['good'] }],
  }))
  invoke(triggerOf(host))
  await toggled()
  expect(inner(host, '.emoji-search')).toEqual(null)
  expect(inner(host, '.emoji-categories')).toEqual(null)
  const choices = innerAll(host, '.emoji-choice')
  expect(choices.map((choice) => choice.textContent)).toEqual([THUMBS_UP, '\u{1F7E2}'])
  expect(choices[1].getAttribute('title')).toEqual('On track')
  expect(focused(host)).toEqual(choices[0])
  invoke(choices[1])
  expect(inner(host, '#value').textContent).toEqual('On track')
})

test('a bad emojis entry is skipped with a warning', async () => {
  const warn = spy(console, 'warn', () => {})
  const host = mounted(emojiPicker({ label: 'Icon', emojis: [THUMBS_UP, 42] }))
  invoke(triggerOf(host))
  await toggled()
  expect(innerAll(host, '.emoji-choice').length).toEqual(1)
  expect(warn.calls.some(([first]) => String(first).includes("an entry of 'emojis'"))).toEqual(
    true,
  )
})

test('in a form, required blocks the submit and a pick fills the field', async () => {
  let values
  const reader = component('emoji-reader', {
    setup: (self) => {
      values = useState(self, 'imp.form')
      return document.createTextNode('')
    },
  })
  const host = mounted(form(
    { initialValues: { icon: undefined } },
    emojiPicker({ field: 'icon', label: 'Icon', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
    reader(),
  ))
  const picker = inner(host, 'imp-emoji-picker')
  expect(inner(picker, '.clear')).toEqual(null)
  invoke(inner(inner(host, 'imp-button'), 'button'))
  expect(inner(picker, '.error').textContent).toEqual('This field is required')
  invoke(triggerOf(picker))
  await toggled()
  invoke(innerAll(picker, '.emoji-choice')[0])
  expect(values.get()).toEqual({ icon: '\u{1F600}' })
  expect(inner(picker, '.error').textContent).toEqual('')
})

test('disabled is live and blocks the trigger', () => {
  let off
  mounted(stateHost((self) => {
    off = initState(self, 'demo.emoji.off', true)
    return emojiPicker({ value: ROCKET, label: 'Icon', disabled: off })
  }))
  const host = document.querySelector('emoji-picker-state-host').shadowRoot.querySelector(
    'imp-emoji-picker',
  )
  expect(triggerOf(host).disabled).toEqual(true)
  expect(inner(host, '.clear').hidden).toEqual(true)
  off.set(false)
  expect(triggerOf(host).disabled).toEqual(false)
  expect(inner(host, '.clear').hidden).toEqual(false)
})
