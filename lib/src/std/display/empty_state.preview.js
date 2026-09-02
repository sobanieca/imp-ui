import { emptyState } from 'imp/std/display'
import { button } from 'imp/std'

export const name = 'Empty state'
export const group = 'Display'
export const description =
  "Run 'imp skill std/emptyState' to learn what emptyState can do before using it."

export const withoutTranslations = emptyState()
export const noResults = emptyState({ variant: 'noResults' })
export const withDescription = emptyState({
  title: 'No invoices',
  description: 'Invoices appear here once you send one.',
})
export const withAction = emptyState(
  { title: 'No invoices' },
  button({ variant: 'primary' }, 'New invoice'),
)
