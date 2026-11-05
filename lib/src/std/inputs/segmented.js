import { defineComponent } from '../shared/define.js'
import { rovingMove, rovingPick } from '../shared/roving.js'
import { div, el } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { iconOrNull } from '../shared/items.js'
import { createFieldBinding } from './field.js'
import { FORM_MESSAGES } from './form-state.js'
import { isEmptyList, normalizeOptions, valueKey } from './options.js'
import { BINDING_PROPS, createShell, SHELL_PROPS, shellStyles } from './shell.js'
import {
  controlBoxRules,
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  groupSeamRules,
  seamKeep,
  seamLift,
  SIZES,
  token,
} from '../shared/css.js'

const NAME = 'segmented'

const KNOWN_PROPS = [
  ...BINDING_PROPS,
  ...SHELL_PROPS,
  'options',
  'multiple',
  'size',
  'block',
  'validate',
  'validateAsync',
]

const ICON_SIZE = '1.25em'

const tint = (amount) =>
  `color-mix(in oklab, ${token('color-primary')} ${amount}, ${token('color-surface')})`

const styles = () => `
  ${shellStyles()}

  .row {
    display: inline-flex;
    flex-wrap: wrap;
    row-gap: ${token('space-1')};
    align-items: stretch;
    align-self: flex-start;
    max-inline-size: 100%;
  }

  .row.block {
    display: flex;
    align-self: stretch;
  }

  .block .segment {
    flex: 1 1 0;
    min-inline-size: 0;
  }

  ${groupSeamRules('.row')}

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    margin: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  ${controlBoxRules()}

  .segment:hover:not(:disabled) {
    background-color: ${token('color-surface-hover')};
  }

  ${seamLift('.segment')}

  ${seamKeep(".segment[aria-checked='true'], .segment[aria-pressed='true']")}

  .segment[aria-checked='true'],
  .segment[aria-pressed='true'] {
    border-color: ${token('color-primary')};
    background-color: ${tint('12%')};
    color: color-mix(in oklab, ${token('color-primary')} 62%, ${token('color-text')});
  }

  .segment[aria-checked='true']:hover:not(:disabled),
  .segment[aria-pressed='true']:hover:not(:disabled) {
    background-color: ${tint('20%')};
  }

  .segment:focus-visible {
    ${focusRing()}
    z-index: 3;
  }

  .segment:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .field[aria-invalid='true'] .segment:not([aria-checked='true']):not([aria-pressed='true']) {
    border-color: ${token('color-danger')};
  }

  @media (prefers-reduced-motion: reduce) {
    .segment { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .segment[aria-checked='true'],
    .segment[aria-pressed='true'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }
`

const buildSegment = ({ self, option, size, multiple, choose }) => {
  const iconOnly = option.icon !== null
  const node = el(
    'button',
    {
      type: 'button',
      class: ['segment', `size-${size}`, iconOnly && 'square'],
      ...(multiple ? { 'aria-pressed': 'false' } : { role: 'radio', 'aria-checked': 'false' }),
      events: { click: () => choose(option, { focus: false }) },
    },
    iconOnly ? iconOrNull(option.icon, { size: ICON_SIZE }) : bindText(self, option.label),
  )
  if (iconOnly) {
    bindValue(self, option.label, (label) => {
      node.setAttribute('aria-label', String(label))
      node.title = String(label)
    })
  }
  return node
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the choices as 'options'`)
    }
    const multiple = Boolean(props.multiple)
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const options = normalizeOptions(NAME, props.options ?? [])
    const binding = createFieldBinding(NAME, props, {
      self,
      emptyWhen: multiple ? isEmptyList : undefined,
    })
    const stateAttribute = multiple ? 'aria-pressed' : 'aria-checked'
    const selectedKeys = (value) => {
      if (multiple) return new Set(Array.isArray(value) ? value.map(valueKey) : [])
      return new Set(value === undefined ? [] : [valueKey(value)])
    }
    let groupDisabled = false

    function choose(option, { focus }) {
      binding.touch()
      const entry = entries.find((candidate) => candidate.option === option)
      if (focus) entry.node.focus()
      if (multiple) {
        const chosen = selectedKeys(binding.read())
        if (!chosen.delete(option.value)) chosen.add(option.value)
        binding.commit(options.filter(({ value }) => chosen.has(value)).map(({ raw }) => raw))
      } else if (!selectedKeys(binding.read()).has(option.value)) {
        binding.commit(option.raw)
      }
      binding.check()
    }

    const entries = options.map((option) => ({
      option,
      node: buildSegment({ self, option, size, multiple, choose }),
    }))

    const isUsable = ({ option }) => !groupDisabled && !option.disabled

    const paint = (value) => {
      const selected = selectedKeys(value)
      const tabStop =
        entries.find(({ option }) => selected.has(option.value) && !option.disabled)
        ?? entries.find(({ option }) => !option.disabled)
      for (const entry of entries) {
        entry.node.setAttribute(stateAttribute, String(selected.has(entry.option.value)))
        if (!multiple) entry.node.tabIndex = entry === tabStop ? 0 : -1
      }
    }

    const row = div(
      {
        class: ['row', props.block && 'block'],
        events: {
          keydown: (event) => {
            if (multiple) return
            const move = rovingMove(event.key, { orientation: 'both', element: row, edges: false })
            if (move === null) return
            const focused = row.getRootNode().activeElement
            const from = entries.findIndex(({ node }) => node === focused)
            if (from === -1) return
            const target = rovingPick(move, entries, from, isUsable)
            if (target) choose(target.option, { focus: true })
            event.preventDefault()
          },
        },
      },
      ...entries.map(({ node }) => node),
    )

    bindValue(self, props.disabled, (value) => {
      groupDisabled = Boolean(value)
      for (const { node, option } of entries) node.disabled = groupDisabled || option.disabled
    })
    stopOnRemove(self, binding.watch(paint))

    const shell = createShell(self, props, row, { grouping: true })
    if (!multiple) shell.root.setAttribute('role', 'radiogroup')
    shell.attach(binding)
    return shell.root
  },
}

export const segmented = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(FORM_MESSAGES),
  )(...args)
