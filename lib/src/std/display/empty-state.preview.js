import { emptyState } from 'imp/std/display'
import { button } from 'imp/std'
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
