import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { createState } from '../../state.js'
import { bindContent, bindValue, oneOf } from '../shared/args.js'
import { ownEvents } from '../shared/own-events.js'
import { anchoredStyles } from '../shared/anchored.js'
import { handlerOrNull, itemId, nodeOrNull, normalizeItems } from '../shared/items.js'
import { MENU_OPTION, menuStyles, wireMenu } from '../shared/menu.js'
import { translatedLabel } from '../shared/translated-label.js'
import { checkIcon, chevronDownIcon, moreIcon } from '../shared/icons.js'
import { button, VARIANTS } from './button.js'
import { forcedColors, hiddenRule, SIZES } from '../shared/css.js'

const NAME = 'menuButton'

const KNOWN_PROPS = ['items', 'trigger', 'variant', 'size', 'disabled', 'label', 'events']

const TRIGGERS = ['more', 'arrow']

const PANEL_ID = 'panel'

const SELECT_EVENT = 'select'

const MORE_KEY = 'imp.menuButton.more'

const CHOOSE_KEY = 'imp.menuButton.choose'

const messages = {
  [MORE_KEY]: 'More actions',
  [CHOOSE_KEY]: 'Choose an action',
}

const styles = () => `
  ${hiddenRule}

  .box {
    display: inline-flex;
    align-items: stretch;
  }

  ${anchoredStyles({ trigger: '.box', panel: '.panel', placement: 'block-end', align: 'end' })}

  ${menuStyles()}

  ${forcedColors}
`

const normalizeMenuItems = (value) =>
  normalizeItems(NAME, value, {
    shape: '{ id, label, onClick }',
    item: (entry, index) => ({
      id: itemId(entry, index),
      label: entry.label,
      icon: nodeOrNull(entry.icon),
      onClick: handlerOrNull(entry.onClick),
      disabled: Boolean(entry.disabled),
      checked: entry.checked,
    }),
  })

const reportChoice = (box, item) =>
  box.dispatchEvent(
    new CustomEvent(SELECT_EVENT, {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { id: item.id, item },
    }),
  )

const buildPanel = ({ self, box, panel, opener, items, expanded }) => {
  const choose = (item) => {
    menu.close()
    if (reportChoice(box, item)) item.onClick?.({ id: item.id, item })
  }
  const options = items.map((item) => {
    const choice = item.checked !== undefined
    const option = el(
      'button',
      {
        ...MENU_OPTION,
        ...(choice ? { role: 'menuitemradio' } : {}),
        type: 'button',
        disabled: item.disabled,
        events: { click: () => choose(item) },
      },
      item.icon === null ? null : span({ class: 'icon' }, bindContent(self, item.icon)),
      bindContent(self, item.label),
      choice ? checkIcon('check') : null,
    )
    if (choice) {
      bindValue(self, item.checked, (value) => {
        option.setAttribute('aria-checked', String(Boolean(value)))
      })
    }
    return option
  })
  const menu = wireMenu({ panel, opener, options, onToggle: (open) => expanded.set(open) })
  return menu
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const variant = oneOf(NAME, 'variant', props.variant, VARIANTS, 'default')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const trigger = oneOf(NAME, 'trigger', props.trigger, TRIGGERS, 'more')
    const items = normalizeMenuItems(props.items ?? [])
    if (items.length === 0) {
      impLogger.warn(`${NAME}: 'items' holds no usable entry - rendering the trigger with no menu`)
    }
    const iconOnly = children.length === 0
    const panel = div({ id: PANEL_ID, class: 'panel', role: 'menu', popover: 'auto' })
    const expanded = createState('imp.menuButton.expanded', false)
    const opener = button(
      {
        variant,
        size,
        square: iconOnly,
        disabled: props.disabled,
        label: props.label ??
          (iconOnly
            ? translatedLabel(self, trigger === 'arrow' ? CHOOSE_KEY : MORE_KEY)
            : undefined),
        haspopup: 'menu',
        expanded,
        popoverTarget: panel,
      },
      ...(iconOnly ? [] : children),
      trigger === 'arrow' ? chevronDownIcon() : moreIcon(),
    )
    opener.classList.add('trigger')
    const box = div(
      { class: 'box', events: ownEvents(props.events, [SELECT_EVENT]) },
      opener,
      items.length > 0 ? panel : null,
    )
    if (items.length > 0) {
      const menu = buildPanel({ self, box, panel, opener, items, expanded })
      bindValue(self, props.disabled, (value) => {
        if (value) menu.close()
      })
    }
    return box
  },
}

export const menuButton = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
