import { appMap, component, mount } from 'imp'
import { button, div, p } from 'imp/html'
import { navigate, router } from 'imp/router'
import { onAnalytics, zone } from 'imp/analytics'
import { datePicker } from 'imp/std/inputs'
import { tabs } from 'imp/std/layout'

document.documentElement.dir = new URLSearchParams(location.search).get('dir') ?? 'ltr'
history.replaceState(null, '', '/analytics')

globalThis.analyticsRecords = []
globalThis.onAnalytics = onAnalytics
globalThis.navigate = navigate
globalThis.failLater = (message) =>
  setTimeout(() => {
    throw new Error(message)
  })
onAnalytics((record) => void globalThis.analyticsRecords.push(record))

const app = appMap({
  analytics: { done: {}, slow: {} },
})

const start = () =>
  div(
    button({ id: 'before' }, 'before'),
    zone({ name: 'demo.due-date' }, datePicker({ ariaLabel: 'Due date', value: '2026-09-15' })),
    button({ id: 'after' }, 'after'),
    button({ id: 'leave', events: { click: () => navigate('/analytics/done') } }, 'leave'),
    tabs({
      label: 'Invoice',
      items: [
        {
          id: 'details',
          label: 'Details',
          content: zone({ name: 'demo.invoice-details' }, p('The details of the invoice.')),
        },
        {
          id: 'history',
          label: 'History',
          content: zone({ name: 'demo.invoice-history' }, p('The history of the invoice.')),
        },
      ],
    }),
    div({ style: { blockSize: '300dvb' } }),
    zone({ name: 'demo.payment-options' }, p({ id: 'payment' }, 'Payment options')),
  )

const slow = component('analytics-never-ready', {
  setup: () => new Promise(() => {}),
})

const done = () =>
  div(button({ id: 'back', events: { click: () => navigate('/analytics') } }, 'back'))

mount(
  '#app',
  router({
    map: app,
    screens: {
      [app.analytics]: start,
      [app.analytics.done]: done,
      [app.analytics.slow]: () => slow(),
    },
  }),
)
