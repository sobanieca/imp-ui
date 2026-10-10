import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { isStateShaped } from '../../render.js'
import { luFaceSlightlySmilingPlus } from '../../icons/lucide-icons.js'
import { icon } from '../general/icon.js'
import { anchoredStyles } from '../shared/anchored.js'
import { bindValue } from '../shared/args.js'
import { focusRing, fontFamily, hiddenRule, token } from '../shared/css.js'
import { emojiKey } from '../shared/emoji-catalog.js'
import { createEmojiPanel, EMOJI_PANEL_MESSAGES, emojiPanelStyles } from '../shared/emoji-panel.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const NAME = 'reactions'

const KNOWN_PROPS = ['items', 'onReact', 'emojis', 'disabled', 'ariaLabel']

const LABEL_KEY = 'imp.reactions.label'

const ADD_KEY = 'imp.reactions.add'

const messages = {
  ...EMOJI_PANEL_MESSAGES,
  [LABEL_KEY]: 'Reactions',
  [ADD_KEY]: 'Add a reaction',
}

const styles = () => `
  ${hiddenRule}

  :host {
    display: block;
  }

  .reactions {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space-1')};
  }

  .chip,
  .add {
    display: inline-flex;
    align-items: center;
    gap: ${token('space-1')};
    box-sizing: border-box;
    block-size: 1.75rem;
    margin: 0;
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: 999px;
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: 1;
    cursor: pointer;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out;
  }

  .chip:hover:not(:disabled),
  .add:hover {
    background-color: ${token('color-surface-hover')};
  }

  .chip:focus-visible,
  .add:focus-visible {
    ${focusRing()}
  }

  .chip[aria-pressed='true'] {
    border-color: ${token('color-primary')};
    background-color: color-mix(in oklab, ${token('color-primary')} 12%, ${token('color-surface')});
  }

  .chip[aria-pressed='true'] .count {
    color: ${token('color-primary')};
  }

  .chip:disabled {
    cursor: default;
  }

  .glyph {
    font-size: 1rem;
  }

  .count {
    min-inline-size: 1ch;
    color: ${token('color-secondary')};
    font-weight: ${token('font-weight-bold')};
    font-variant-numeric: tabular-nums;
  }

  .add {
    color: ${token('color-secondary')};
  }

  ${anchoredStyles({ trigger: '.add', panel: '.panel', placement: 'block-end', align: 'start' })}

  @media (prefers-reduced-motion: reduce) {
    .chip, .add { transition: none }
  }

  @media (forced-colors: active) {
    .chip, .add { border-color: ButtonBorder }
    .chip[aria-pressed='true'] { border-color: Highlight }
  }
`

const readItems = (value) => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'items' must be an array of { emoji, count, reacted } - showing none`)
    return []
  }
  return value.filter((item) => {
    const valid = typeof item?.emoji === 'string' && Number.isInteger(item.count) && item.count >= 0
    if (!valid) {
      impLogger.warn(`${NAME}: an item needs an 'emoji' and a whole 'count' - skipping it`)
    }
    return valid && item.count > 0
  })
}

const sameEmoji = (emoji) => (item) => emojiKey(item.emoji) === emojiKey(emoji)

const applyReaction = (items, emoji, reacted) => {
  const index = items.findIndex(sameEmoji(emoji))
  const found = items[index]
  if (reacted) {
    if (!found) return [...items, { emoji, count: 1, reacted: true }]
    if (found.reacted) return items
    return items.with(index, { ...found, count: found.count + 1, reacted: true })
  }
  if (!found?.reacted) return items
  if (found.count <= 1) return items.toSpliced(index, 1)
  return items.with(index, { ...found, count: found.count - 1, reacted: false })
}

const formatCount = (count) => {
  try {
    return new Intl.NumberFormat(lang.get(), { notation: 'compact' }).format(count)
  } catch {
    return String(count)
  }
}

const readOnReact = (onReact) => {
  if (onReact === undefined || typeof onReact === 'function') return onReact ?? null
  impLogger.warn(`${NAME}: 'onReact' must be a function of (emoji, reacted)`)
  return null
}

const definition = {
  styles: () => `${emojiPanelStyles()}\n${styles()}`,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const source = isStateShaped(props.items) ? props.items : null
    if (source !== null && typeof source.set !== 'function') {
      impLogger.warn(`${NAME}: 'items' is a read-only state - a reaction shows until it changes`)
    }
    const onReact = readOnReact(props.onReact)
    let items = readItems(source === null ? props.items : source.get())
    let disabled = false

    const chips = new Map()
    const bar = div({ class: 'bar', role: 'group' })

    const write = (next) => {
      if (source !== null && typeof source.set === 'function') source.set(next)
      else {
        items = next
        paint()
      }
    }

    const react = (emoji, reacted) => {
      const next = applyReaction(items, emoji, reacted)
      if (next === items) return
      write(next)
      const sent = onReact?.(emoji, reacted)
      if (typeof sent?.then !== 'function') return
      sent.then(null, (failure) => {
        impLogger.warn(`${NAME}: 'onReact' failed - taking the reaction back`, failure)
        write(applyReaction(items, emoji, !reacted))
      })
    }

    const chipOf = (emoji) => {
      const key = emojiKey(emoji)
      if (chips.has(key)) return chips.get(key)
      const count = span({ class: 'count' })
      const chip = el(
        'button',
        {
          type: 'button',
          class: 'chip',
          events: {
            click: () => {
              const item = items.find(sameEmoji(emoji))
              react(emoji, !item?.reacted)
            },
          },
        },
        span({ class: 'glyph' }, emoji),
        count,
      )
      const entry = { chip, count }
      chips.set(key, entry)
      return entry
    }

    const emojiPanel = createEmojiPanel({
      self,
      name: NAME,
      emojis: props.emojis,
      onPick: (emoji) => {
        panel.hidePopover()
        react(emoji, true)
      },
    })
    const panel = div({ class: 'panel', role: 'dialog', popover: 'auto' }, emojiPanel.root)
    const add = el('button', {
      type: 'button',
      class: 'add',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
    }, icon(luFaceSlightlySmilingPlus, { size: 'sm' }))
    add.popoverTargetElement = panel
    closeOnTabOut(panel)

    let heldFocus = false
    panel.addEventListener('beforetoggle', (event) => {
      const open = event.newState === 'open'
      add.setAttribute('aria-expanded', String(open))
      heldFocus = !open && panel.contains(panel.getRootNode().activeElement)
      if (open) emojiPanel.reset()
    })
    panel.addEventListener('toggle', (event) => {
      if (event.newState === 'open') emojiPanel.focusStart()
      else if (heldFocus) add.focus()
    })

    function paint() {
      const focused = bar.getRootNode().activeElement
      const hadFocus = focused !== null && bar.contains(focused)
      const shown = items.map((item) => {
        const { chip, count } = chipOf(item.emoji)
        count.textContent = formatCount(item.count)
        chip.setAttribute('aria-pressed', String(Boolean(item.reacted)))
        chip.disabled = disabled || !(item.reacted || emojiPanel.allows(item.emoji))
        return chip
      })
      for (const [key, { chip }] of chips) {
        if (!shown.includes(chip)) chips.delete(key)
      }
      add.hidden = disabled
      const wanted = [...shown, add]
      for (const child of [...bar.children]) {
        if (!wanted.includes(child)) child.remove()
      }
      wanted.forEach((node, index) => {
        if (bar.children[index] !== node) bar.insertBefore(node, bar.children[index] ?? null)
      })
      if (!hadFocus || disabled) return
      const kept = bar.contains(focused) && !focused.disabled
      if (kept && bar.getRootNode().activeElement === focused) return
      if (kept) focused.focus()
      else add.focus()
    }

    if (source !== null) {
      source.watch(self, (value) => {
        items = readItems(value)
        paint()
      })
    }
    bindValue(self, props.disabled, (value) => {
      disabled = Boolean(value)
      if (disabled && panel.matches(':popover-open')) panel.hidePopover()
      paint()
    })
    lang.watch(self, () => {
      add.setAttribute('aria-label', t(ADD_KEY))
      panel.setAttribute('aria-label', t(ADD_KEY))
      if (props.ariaLabel === undefined) bar.setAttribute('aria-label', t(LABEL_KEY))
      paint()
    })
    if (props.ariaLabel !== undefined) {
      bindValue(self, props.ariaLabel, (value) => bar.setAttribute('aria-label', String(value)))
    }

    const content = children.length > 0 ? div({ class: 'content' }, ...children) : null
    return div({ class: 'reactions' }, content, bar, panel)
  },
}

export const reactions = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
