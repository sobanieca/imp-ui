import { component } from 'imp'
import { button, div, span } from 'imp/html'
import { lang, t } from 'imp/i18n'
import { initState } from 'imp/state'

export const counter = component('demo-counter', {
  styles: `
    .counter { display: flex; align-items: center; gap: 8px; font: inherit }
  `,
  setup(self, props = {}) {
    const count = initState(self, 'demo.count', props.start ?? 0)
    return div(
      { class: 'counter' },
      button({ events: { click: () => count.set((current) => current - 1) } }, '-'),
      span({ id: 'label' }, lang.text(() => t('demo.total'))),
      span({ id: 'value' }, count.text()),
      span({ id: 'cancel' }, lang.text(() => t('imp.action.cancel'))),
      button({ events: { click: () => count.set((current) => current + 1) } }, '+'),
    )
  },
})
