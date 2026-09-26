import { emptyState } from 'imp/std/display'
import { button } from 'imp/std'
import { div } from 'imp/html'
import { luCircleCheck, luCircleX, luInbox, luTriangleAlert } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Empty state'
export const group = groups.display

const drawing = () => {
  const box = div()
  box.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">' +
    '<rect x="8" y="20" width="80" height="56" rx="8" fill="var(--imp-color-sky, #7dd3fc)"/>' +
    '<circle cx="34" cy="44" r="10" fill="var(--imp-color-surface, #fff)"/>' +
    '<path d="M16 72l24-22 16 12 12-8 20 18z" fill="var(--imp-color-blue, #2563eb)"/></svg>'
  return box.firstElementChild
}

const photo = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" rx="10" fill="#f4d06f"/><circle cx="52" cy="40" r="18" fill="#fff"/><path d="M20 80l40-34 30 22 20-14 30 26z" fill="#d97706"/></svg>',
  )

export const withoutTranslations = {
  scenario: 'Without translations, with the imp mark',
  component: emptyState(),
}
export const withADrawing = {
  scenario: 'With a drawing of the app',
  component: emptyState(
    { image: drawing(), title: 'No photos yet', description: 'Upload one to start the album.' },
    button({ variant: 'primary' }, 'Upload a photo'),
  ),
}
export const withAnImageUrl = {
  scenario: 'With an image URL',
  component: emptyState({ image: photo, title: 'The album is empty' }),
}
export const noResults = { scenario: 'No results', component: emptyState({ variant: 'noResults' }) }
export const withDescription = {
  scenario: 'With a description',
  component: emptyState({
    title: 'No invoices',
    description: 'Invoices appear here once you send one.',
  }),
}
export const withAction = {
  scenario: 'With an action',
  component: emptyState(
    { title: 'No invoices' },
    button({ variant: 'primary' }, 'New invoice'),
  ),
}
export const withIcon = {
  scenario: 'With an icon',
  component: emptyState(
    {
      icon: luInbox,
      title: 'No messages',
      description: 'New messages from your customers appear here.',
    },
    button({ variant: 'primary' }, 'Write a message'),
  ),
}
export const successResult = {
  scenario: 'Result: success',
  component: emptyState(
    {
      icon: luCircleCheck,
      kind: 'success',
      title: 'Payment received',
      description: 'We sent the receipt for order 2026-0142 to ada@example.com.',
    },
    button({ variant: 'primary' }, 'Back to orders'),
  ),
}
export const errorResult = {
  scenario: 'Result: error',
  component: emptyState(
    {
      icon: luCircleX,
      kind: 'error',
      title: 'Payment failed',
      description: 'The bank declined the card. No money left your account.',
    },
    button({ variant: 'primary' }, 'Try again'),
    button('Use another card'),
  ),
}
export const warningResult = {
  scenario: 'Result: warning',
  component: emptyState({
    icon: luTriangleAlert,
    kind: 'warning',
    title: 'The import finished with 3 skipped rows',
    description: 'The rows had no email address. Correct the file and import it again.',
  }),
}
