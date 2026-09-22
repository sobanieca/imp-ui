import { component } from 'imp'
import { createHttpClient, initHttpClient } from 'imp/http'
import { button, text } from 'imp/std'
import { progress } from 'imp/std/feedback'
import { flex, stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Progress'
export const group = groups.feedback

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

export const bar = {
  scenario: 'Bar',
  component: stack(
    { gap: 4 },
    progress({ label: 'Uploading invoices.zip', value: 40, showValue: true }),
    progress({ label: 'Storage', value: 412, max: 512, color: 'warning', showValue: true }),
    progress({ label: 'Import finished', value: 100, color: 'success', size: 'sm' }),
    progress({
      label: 'Disk almost full',
      value: 96,
      color: 'danger',
      size: 'lg',
      showValue: true,
    }),
  ),
}

export const indeterminateBar = {
  scenario: 'Bar with no known value',
  component: progress({ label: 'Connecting to the printer' }),
}

export const spinner = {
  scenario: 'The spinner',
  component: flex(
    { gap: 4, verticalAlign: 'center' },
    progress({ label: 'Loading', shape: 'ring', size: 'sm' }),
    progress({ label: 'Loading', shape: 'ring' }),
    progress({ label: 'Loading', shape: 'ring', size: 'lg' }),
    progress({ label: 'Loading', shape: 'ring', color: 'teal' }),
  ),
}

export const ring = {
  scenario: 'Ring',
  component: flex(
    { gap: 4, verticalAlign: 'center' },
    progress({ label: 'Profile complete', shape: 'ring', size: 'sm', value: 25 }),
    progress({ label: 'Profile complete', shape: 'ring', value: 60, showValue: true }),
    progress({
      label: 'Storage',
      shape: 'ring',
      size: 'lg',
      value: 412,
      max: 512,
      showValue: true,
      color: 'violet',
    }),
  ),
}

export const gauge = {
  scenario: 'Gauge as a stat',
  component: flex(
    { gap: 5, wrap: true, verticalAlign: 'bottom' },
    progress({ label: 'CPU', shape: 'gauge', value: 72, color: 'amber' }),
    progress({
      label: 'Memory',
      shape: 'gauge',
      value: 5.2,
      max: 16,
      format: (used) => `${used} GB`,
    }),
    progress({ label: 'Uptime', shape: 'gauge', value: 99.2, color: 'success', size: 'lg' }),
    progress({
      label: 'Open tickets',
      shape: 'gauge',
      size: 'sm',
      value: 18,
      max: 50,
      color: 'danger',
      format: (open) => String(open),
    }),
  ),
}

export const liveValue = {
  scenario: 'Live value',
  component: component('progress-live-demo', {
    setup: (self) => {
      const done = initState(self, 'progress.done', 20)
      const step = (amount) => done.set(Math.min(100, Math.max(0, done.get() + amount)))
      return stack(
        { gap: 4 },
        progress({ label: 'Migrating records', value: done, showValue: true }),
        flex(
          { gap: 4, verticalAlign: 'center' },
          progress({
            label: 'Migrating records',
            shape: 'ring',
            size: 'lg',
            value: done,
            showValue: true,
          }),
          progress({ label: 'Records', shape: 'gauge', value: done }),
        ),
        flex(
          { gap: 2 },
          button({ events: { click: () => step(-10) } }, 'Back 10'),
          button({ variant: 'primary', events: { click: () => step(10) } }, 'Forward 10'),
          button({ variant: 'ghost', events: { click: () => done.set(undefined) } }, 'Unknown'),
        ),
      )
    },
  })(),
}

export const whileClientIsBusy = {
  scenario: 'While an HTTP client is busy',
  component: component('progress-client-demo', {
    setup: (self) => {
      const api = initHttpClient(
        self,
        createHttpClient('preview.api', { onRequest: () => wait(1500) }),
      )
      const save = () => api.get(`${location.origin}/`).catch(() => null)
      return stack(
        { gap: 3 },
        text('The bar and the ring show themselves only while the client has a call in flight.'),
        flex(
          { gap: 3, verticalAlign: 'center' },
          button({ variant: 'primary', events: { click: save } }, 'Save'),
          progress({ label: 'Saving', shape: 'ring', size: 'sm', client: 'preview.api' }),
        ),
        progress({ label: 'Saving', client: 'preview.api' }),
      )
    },
  })(),
}
