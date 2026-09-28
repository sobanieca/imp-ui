import { component } from 'imp'
import { div } from 'imp/html'
import { useHttpClient } from 'imp/http'
import { url } from 'imp/router'
import { link, text } from 'imp/std'
import { card, markdown, qrCode } from 'imp/std/display'
import { bugReport } from 'imp/std/feedback'
import { flex, stack } from 'imp/std/layout'
import { sendBugReport } from '../todos/todo-api.js'
import { tr, translated } from '../translate.js'
import { hero } from '../ui/hero.js'
import { pageStyles } from '../ui/page-styles.js'

export const aboutScreen = component('todo-about-screen', {
  styles: pageStyles,
  setup: (self) => {
    const api = useHttpClient(self, 'todo.api')
    const address = new URL(url('/'), location.origin).href
    return div(
      { class: 'page' },
      hero({ eyebrow: tr('app.tagline'), title: tr('about.title') }),
      card(markdown({ text: translated('about.body') })),
      card(
        flex(
          { gap: 4, verticalAlign: 'center', wrap: true },
          qrCode({ value: address, label: translated('about.qrLabel'), size: 'sm' }),
          stack(
            { gap: 1 },
            text({ tone: 'secondary' }, tr('about.phone')),
            link({ href: '/' }, address),
          ),
        ),
      ),
      card(
        flex(
          { horizontalAlign: 'justify', verticalAlign: 'center', wrap: true },
          text({ tone: 'secondary' }, tr('about.report')),
          bugReport({ onSubmit: (report) => sendBugReport(api, report) }),
        ),
      ),
    )
  },
})
