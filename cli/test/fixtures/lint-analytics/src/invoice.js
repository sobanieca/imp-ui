import { div } from 'imp/html'
import { track, zone } from 'imp/analytics'

export const invoice = () =>
  zone(
    { name: 'myapp.summary' },
    div({ events: { click: () => track('myapp.invoice-sent') } }, 'invoice'),
    zone({ name: `myapp.summary` }, div('again')),
  )
