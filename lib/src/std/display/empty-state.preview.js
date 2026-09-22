import { emptyState } from 'imp/std/display'
import { button } from 'imp/std'
import { luCircleCheck, luCircleX, luInbox, luTriangleAlert } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'Empty state'
export const group = groups.display

export const withoutTranslations = { scenario: 'Without translations', component: emptyState() }
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
