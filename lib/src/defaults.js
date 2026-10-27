import { impLogger } from './logger.js'
import { isPlainObject } from './render.js'

const STD_COMPONENTS = [
  'accordion',
  'accountMenu',
  'appLogo',
  'avatar',
  'breadcrumbs',
  'bugReport',
  'button',
  'calendar',
  'card',
  'chart',
  'checkbox',
  'codeBlock',
  'codeEditor',
  'colorPicker',
  'comboBox',
  'copyButton',
  'datePicker',
  'dateRangePicker',
  'descriptionList',
  'dialog',
  'drawer',
  'emojiPicker',
  'emptyState',
  'fileUpload',
  'flex',
  'form',
  'gantt',
  'heading',
  'icon',
  'imageUpload',
  'langSelect',
  'link',
  'list',
  'loader',
  'map',
  'markdown',
  'menuButton',
  'notice',
  'notifications',
  'orgSelect',
  'progress',
  'qrCode',
  'radioGroup',
  'reactions',
  'richTextEditor',
  'segmented',
  'select',
  'shell',
  'skeleton',
  'slider',
  'splitPane',
  'stack',
  'steps',
  'table',
  'tabs',
  'tag',
  'text',
  'textField',
  'themeSelect',
  'timeline',
  'toast',
  'toggle',
  'tooltip',
  'tree',
  'treeSelect',
  'userCard',
]

let componentDefaults = {}

const knownDefaults = new Map()

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

export const setDefaults = (defaults) => {
  if (!isPlainObject(defaults)) {
    throw new Error(
      `imp: init({ defaults }) needs an object keyed by component name, like { emptyState: { icon: luInbox } }`,
    )
  }
  for (const [name, props] of Object.entries(defaults)) {
    if (!STD_COMPONENTS.includes(name)) {
      throw new Error(
        `imp: init({ defaults }) got unknown component '${name}' - name a standard component such as 'button' or 'emptyState'`,
      )
    }
    if (!isPlainObject(props)) {
      throw new Error(
        `imp: init({ defaults }) needs a props object for '${name}', like { size: 'sm' }`,
      )
    }
  }
  componentDefaults = { ...defaults }
  knownDefaults.clear()
}

const keepKnownProps = (name, knownProps) => {
  const kept = {}
  for (const [key, value] of Object.entries(componentDefaults[name] ?? {})) {
    if (knownProps.includes(key)) kept[key] = value
    else {
      impLogger.warn(
        `init({ defaults }): unknown prop '${key}' for '${name}' - supported props are ${quoted(knownProps)}`,
      )
    }
  }
  return kept
}

const givenKeys = (props) => Object.keys(props).filter((key) => props[key] !== undefined)

const ownCopy = (value) => (value instanceof Node ? value.cloneNode(true) : value)

export const withDefaults = (name, knownProps, exclusiveProps, props) => {
  if (!knownDefaults.has(name)) knownDefaults.set(name, keepKnownProps(name, knownProps))
  const defaults = knownDefaults.get(name)
  const given = givenKeys(props)
  const overridden = new Set(given)
  for (const group of exclusiveProps) {
    if (group.some((key) => given.includes(key))) for (const key of group) overridden.add(key)
  }
  const merged = {}
  for (const [key, value] of Object.entries(defaults)) {
    if (!overridden.has(key)) merged[key] = ownCopy(value)
  }
  for (const key of given) merged[key] = props[key]
  return merged
}
