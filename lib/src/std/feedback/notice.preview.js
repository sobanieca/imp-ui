import { component } from 'imp'
import { createHttpClient, initHttpClient } from 'imp/http'
import { luRocket } from 'imp/icons'
import { button, text } from 'imp/std'
import { notice, progress } from 'imp/std/feedback'
import { flex, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Notice'
export const group = groups.feedback

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

export const kinds = {
  scenario: 'Kinds',
  component: stack(
    { gap: 3 },
    notice({ title: 'A new version is ready' }, 'Reload the page to get it.'),
    notice({ kind: 'success', title: 'Invoice sent' }, 'Ada Lovelace gets it by e-mail.'),
    notice(
      { kind: 'warning', title: 'Your trial ends in 3 days' },
      'Add a payment method to keep your projects.',
    ),
    notice({ kind: 'error', title: 'Could not save' }, 'The server did not answer. Try again.'),
  ),
}

export const titleOnly = {
  scenario: 'Title only',
  component: notice({ kind: 'success', title: 'All 214 records are imported' }),
}

export const withActions = {
  scenario: 'With actions',
  component: notice(
    { kind: 'warning', title: 'Your trial ends in 3 days' },
    'Add a payment method to keep your projects.',
    button({ variant: 'link', size: 'sm' }, 'Add payment'),
    button({ variant: 'link', size: 'sm' }, 'Compare plans'),
  ),
}

export const ownIcon = {
  scenario: 'Own icon',
  component: notice(
    { icon: luRocket, title: 'Deploys are faster now' },
    'A build reuses the cache of the last one.',
  ),
}

export const dismissible = {
  scenario: 'Dismissible',
  component: notice(
    { kind: 'info', title: 'Tip: press / to search', dismissible: true },
    'The shortcut works on every page.',
  ),
}

export const stateDriven = {
  scenario: 'Open from a state',
  component: component('notice-open-demo', {
    setup: (self) => {
      const open = initState(self, 'notice.open', false)
      return stack(
        { gap: 3 },
        flex(
          { gap: 2 },
          button({ events: { click: () => open.set(true) } }, 'Fail the save'),
          button({ variant: 'ghost', events: { click: () => open.set(false) } }, 'Clear'),
        ),
        notice(
          { kind: 'error', title: 'Could not save', open, dismissible: true },
          'Your changes are still in the form.',
        ),
        text(
          { tone: 'secondary', size: 'sm' },
          open.text((value) => `open: ${value}`),
        ),
      )
    },
  })(),
}

export const lastErrorOfClient = {
  scenario: 'Last error of an HTTP client',
  component: component('notice-client-demo', {
    setup: (self) => {
      const api = initHttpClient(
        self,
        createHttpClient('preview.api', {
          onRequest: async () => {
            await wait(900)
            throw new Error('the server is not reachable')
          },
        }),
      )
      const save = () => api.post('/invoices', { body: { total: 120 } }).catch(() => null)
      return stack(
        { gap: 3 },
        flex(
          { gap: 3, verticalAlign: 'center' },
          button({ variant: 'primary', events: { click: save } }, 'Save the invoice'),
          progress({ label: 'Saving', shape: 'ring', size: 'sm', client: 'preview.api' }),
        ),
        notice({ client: 'preview.api' }),
        notice({ client: 'preview.api', title: 'Could not save the invoice' }),
      )
    },
  })(),
}
