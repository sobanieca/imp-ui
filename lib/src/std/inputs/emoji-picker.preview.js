import { emojiPicker, form, submitForm } from 'imp/std/inputs'
import { button } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Emoji picker'
export const group = groups.inputs

export const basic = {
  scenario: 'Basic, every emoji with search',
  component: emojiPicker({ value: '\u{1F680}', label: 'Project icon' }),
}

export const empty = {
  scenario: 'Empty, with a placeholder and help',
  component: emojiPicker({
    value: undefined,
    label: 'Status emoji',
    placeholder: 'No emoji',
    help: 'Type a word such as "coffee" or "party" to search',
  }),
}

export const ownSet = {
  scenario: 'A specific set of emoji',
  component: emojiPicker({
    value: undefined,
    label: 'Mood',
    emojis: ['\u{1F600}', '\u{1F642}', '\u{1F610}', '\u{1F641}', '\u{1F62D}', '\u{1F621}'],
  }),
}

export const namedSet = {
  scenario: 'A specific set with your own names',
  component: emojiPicker({
    value: '\u{1F7E2}',
    label: 'Project health',
    required: true,
    emojis: [
      { emoji: '\u{1F7E2}', name: 'On track', keywords: ['good', 'green'] },
      { emoji: '\u{1F7E1}', name: 'At risk', keywords: ['warning', 'yellow'] },
      { emoji: '\u{1F534}', name: 'Blocked', keywords: ['stop', 'red'] },
    ],
  }),
}

export const inForm = {
  scenario: 'In a form, required',
  component: form(
    { initialValues: { icon: undefined }, onSubmit: (values) => console.log(values) },
    emojiPicker({ field: 'icon', label: 'Channel icon', required: true }),
    button({ variant: 'primary', events: { click: submitForm } }, 'Save'),
  ),
}

export const disabled = {
  scenario: 'Disabled',
  component: emojiPicker({ value: '\u{1F389}', label: 'Icon', disabled: true }),
}
