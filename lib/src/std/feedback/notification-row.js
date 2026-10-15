import { div, img, p, span } from '../../api/html.js'
import { luCircleCheck, luCircleX, luInfo, luTriangleAlert, luX } from '../../icons/lucide-icons.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { link } from '../general/link.js'
import { fontFamily, token } from '../shared/css.js'
import { chooseAction, leaveCorner } from './notification-store.js'

export const DISMISS_KEY = 'imp.toast.dismiss'

export const ROW_MESSAGES = { [DISMISS_KEY]: 'Dismiss' }

const KIND_ICONS = {
  info: luInfo,
  success: luCircleCheck,
  warning: luTriangleAlert,
  error: luCircleX,
}

const KIND_COLORS = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
}

const kindRules = () =>
  Object.entries(KIND_COLORS)
    .map(([kind, color]) => `  .kind-${kind} { --row-color: ${token(`color-${color}`)} }`)
    .join('\n')

export const rowStyles = () => `
  .row {
    display: flex;
    align-items: flex-start;
    gap: ${token('space-3')};
    box-sizing: border-box;
    min-inline-size: 0;
    padding: ${token('space-3')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-inline-start: 0.25rem solid var(--row-color);
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

${kindRules()}

  .mark {
    display: flex;
    flex: none;
  }

  .image {
    display: block;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: ${token('radius-item')};
    object-fit: cover;
  }

  .words {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 0;
  }

  .words p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .title {
    font-size: ${token('font-size-md')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  .unread .title::before {
    content: '';
    display: inline-block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    margin-inline-end: ${token('space-2')};
    border-radius: 50%;
    background-color: ${token('color-primary')};
  }

  .description,
  .choice {
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .time,
  .choice {
    color: ${token('color-secondary')};
  }

  .time {
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space-2')};
    margin-block-start: ${token('space-1')};
  }

  .dismiss {
    display: flex;
    flex: none;
  }

  @media (forced-colors: active) {
    .row { border-color: CanvasText }
    .unread .title::before { background-color: Highlight }
  }
`

const markNode = (entry) =>
  span(
    { class: 'mark' },
    entry.image === undefined
      ? icon({ icon: entry.icon ?? KIND_ICONS[entry.kind], color: KIND_COLORS[entry.kind] })
      : img({ class: 'image', src: entry.image, alt: '' }),
  )

const linkNode = (entry, onFollow) =>
  div(
    { class: 'link' },
    link(
      {
        href: entry.link.href,
        external: entry.link.external,
        size: 'sm',
        events: {
          click: () => {
            leaveCorner(entry.id, { read: true })
            onFollow?.()
          },
        },
      },
      entry.link.label,
    ),
  )

const actionsNode = (entry) =>
  div(
    { class: 'actions' },
    ...entry.actions.map(({ id, label, variant }) =>
      button({ size: 'sm', variant, events: { click: () => chooseAction(entry.id, id) } }, label),
    ),
  )

const answerNode = (entry) => {
  if (entry.actions === undefined) return null
  if (entry.choice === null) return actionsNode(entry)
  const chosen = entry.actions.find(({ id }) => id === entry.choice)
  return p({ class: 'choice' }, chosen?.label ?? entry.choice)
}

export const notificationRow = (
  entry,
  { dismissLabel, onDismiss, onFollow, time = null, unread = false },
) =>
  div(
    {
      class: ['row', `kind-${entry.kind}`, unread && 'unread'],
      role: 'group',
      'aria-label': entry.title,
    },
    markNode(entry),
    div(
      { class: 'words' },
      p({ class: 'title' }, entry.title),
      entry.description === undefined ? null : p({ class: 'description' }, entry.description),
      time === null ? null : p({ class: 'time' }, time),
      entry.link === undefined ? null : linkNode(entry, onFollow),
      answerNode(entry),
    ),
    span(
      { class: 'dismiss' },
      button(
        {
          variant: 'ghost',
          size: 'sm',
          square: true,
          label: dismissLabel,
          events: { click: () => onDismiss(entry) },
        },
        icon({ icon: luX, size: 'sm' }),
      ),
    ),
  )
