import { defineComponent } from '../shared/define.js'
import { div, p, span } from '../../api/html.js'
import { defaultMessages } from '../../api/i18n.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { fontFamily, token, visuallyHidden } from '../shared/css.js'
import { ownEvents } from '../shared/own-events.js'
import { createToggle } from '../shared/toggle.js'
import { translatedLabel } from '../shared/translated-label.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { luCircleCheck, luCircleX, luInfo, luTriangleAlert, luX } from '../../icons/lucide-icons.js'
import { resolveClient } from './client.js'

const NAME = 'notice'

const KNOWN_PROPS = ['kind', 'title', 'icon', 'dismissible', 'open', 'client', 'events']

const KINDS = ['info', 'success', 'warning', 'error']

const KIND_TOKENS = {
  info: 'color-info',
  success: 'color-success',
  warning: 'color-warning',
  error: 'color-danger',
}

const KIND_ICONS = {
  info: luInfo,
  success: luCircleCheck,
  warning: luTriangleAlert,
  error: luCircleX,
}

const ASSERTIVE_KINDS = ['warning', 'error']

const DISMISS_EVENT = 'dismiss'

const DISMISS_KEY = 'imp.notice.dismiss'

const messages = {
  [DISMISS_KEY]: 'Dismiss',
}

const kindRules = () =>
  KINDS.map((kind) => `  .kind-${kind} { --notice-color: ${token(KIND_TOKENS[kind])} }`).join('\n')

const styles = () => `
  .root {
    display: flex;
    align-items: flex-start;
    gap: ${token('space-3')};
    box-sizing: border-box;
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-4')};
    border: ${
  token('border-width')
} solid color-mix(in oklab, var(--notice-color) 35%, transparent);
    border-radius: ${token('radius-container')};
    background-color: color-mix(in oklab, var(--notice-color) 12%, transparent);
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
  }

${kindRules()}

  .icon {
    display: flex;
    flex: none;
    align-items: center;
    block-size: calc(1em * ${token('line-height-normal')});
    color: color-mix(in oklab, var(--notice-color) 80%, ${token('color-text')});
  }

  .region {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
  }

  p {
    margin: 0;
  }

  .title {
    font-weight: ${token('font-weight-bold')};
  }

  .detail {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
  }

  .description {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: ${token('space-3')};
    row-gap: ${token('space-1')};
    font-size: ${token('font-size-sm')};
  }

  .close {
    flex: none;
    margin-block: calc(-1 * ${token('space-1')});
    margin-inline-end: calc(-1 * ${token('space-2')});
  }

  .title[hidden],
  .description:empty,
  .closed > .icon,
  .closed > .close,
  .closed .content {
    display: none;
  }

  .root.closed {
    ${visuallyHidden}
    border: none;
  }

  @media (forced-colors: active) {
    .root { border-color: CanvasText }
    .icon { color: CanvasText }
  }
`

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    const following = props.client !== undefined
    const client = following ? resolveClient(NAME, self, props.client) : null
    const kind = oneOf(NAME, 'kind', props.kind, KINDS, following ? 'error' : 'info')
    const dismissible = Boolean(props.dismissible ?? following)

    const failureWords = document.createTextNode('')
    const ownTitle = props.title !== undefined
    const title = p(
      { class: 'title', hidden: !ownTitle && !following },
      ownTitle ? bindText(self, props.title) : failureWords,
    )
    const detail = following && ownTitle ? p({ class: 'detail' }, failureWords) : null
    const description = div({ class: 'description' }, ...children)
    const region = div(
      { class: 'region', role: ASSERTIVE_KINDS.includes(kind) ? 'alert' : 'status' },
      div({ class: 'content' }, title, detail, description),
    )

    let wanted = false
    let failure = null
    let dismissed = null
    const shown = () => wanted && (!following || (failure !== null && failure !== dismissed))
    const render = () => root.classList.toggle('closed', !shown())

    const dismiss = () => {
      if (!following) return opened.change(false, { notify: true })
      dismissed = failure
      render()
      root.dispatchEvent(
        new CustomEvent(DISMISS_EVENT, { bubbles: true, composed: true, detail: { open: false } }),
      )
      client?.clearError?.()
    }

    const root = div(
      { class: ['root', `kind-${kind}`], events: ownEvents(props.events, [DISMISS_EVENT]) },
      span(
        { class: 'icon', 'aria-hidden': 'true' },
        icon({ icon: props.icon ?? KIND_ICONS[kind], size: '1.25em' }),
      ),
      region,
      dismissible
        ? span(
          { class: 'close' },
          button(
            {
              variant: 'ghost',
              size: 'sm',
              square: true,
              label: translatedLabel(self, DISMISS_KEY),
              events: { click: dismiss },
            },
            icon({ icon: luX, size: 'sm' }),
          ),
        )
        : null,
    )

    const opened = createToggle(NAME, {
      prop: 'open',
      source: props.open ?? true,
      node: root,
      event: DISMISS_EVENT,
      detail: 'open',
      paint: (value) => {
        wanted = value
        render()
      },
    })
    opened.follow(self)
    if (client !== null) {
      bindValue(self, client.lastError, (next) => {
        failure = next ?? null
        if (failure !== null) failureWords.data = String(failure.message ?? '')
        render()
      })
    }
    render()
    return root
  },
}

export const notice = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
