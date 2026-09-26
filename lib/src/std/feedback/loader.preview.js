import { component } from 'imp'
import { createHttpClient, initHttpClient } from 'imp/http'
import { div } from 'imp/html'
import { button, text } from 'imp/std'
import { loader } from 'imp/std/feedback'
import { flex, stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Loader'
export const group = groups.feedback

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

export const sizes = {
  scenario: 'Three sizes',
  component: flex(
    { gap: 4, verticalAlign: 'center' },
    loader({ label: 'Loading', size: 'sm' }),
    loader({ label: 'Loading' }),
    loader({ label: 'Loading', size: 'lg' }),
    loader({ label: 'Loading', color: 'teal' }),
  ),
}

export const besideWords = {
  scenario: 'Beside the words',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    loader({ label: 'Loading the report', size: 'sm' }),
    text({ tone: 'secondary' }, 'Loading the report...'),
  ),
}

export const loaderShapes = {
  scenario: 'The four loader shapes of a theme',
  component: flex(
    { gap: 4, verticalAlign: 'center' },
    ...['spinner', 'dots', 'bar', 'pulse'].map((shape) =>
      div({ style: { '--imp-loader': shape } }, loader({ label: `Loading, ${shape}` }))
    ),
  ),
}

export const whileClientIsBusy = {
  scenario: 'While an HTTP client is busy',
  component: component('loader-client-demo', {
    setup: (self) => {
      const api = initHttpClient(
        self,
        createHttpClient('preview.api', { onRequest: () => wait(1500) }),
      )
      const save = () => api.get(`${location.origin}/`).catch(() => null)
      return stack(
        { gap: 3 },
        text('The loader shows itself only while the client has a call in flight.'),
        flex(
          { gap: 3, verticalAlign: 'center' },
          button({ variant: 'primary', events: { click: save } }, 'Save'),
          loader({ label: 'Saving', size: 'sm', client: 'preview.api' }),
        ),
      )
    },
  })(),
}
