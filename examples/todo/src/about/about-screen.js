import { component } from 'imp'
import { div } from 'imp/html'
import { useHttpClient } from 'imp/http'
import { text } from 'imp/std'
import { card, markdown } from 'imp/std/display'
import { bugReport } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'
import { sendBugReport } from '../todos/todo-api.js'
import { tr, translated } from '../translate.js'
import { hero } from '../ui/hero.js'
import { pageStyles } from '../ui/page-styles.js'

export const aboutScreen = component('todo-about-screen', {
  styles: pageStyles,
  setup: (self) => {
    const api = useHttpClient(self, 'todo.api')
    return div(
      { class: 'page' },
      hero({ eyebrow: tr('app.tagline'), title: tr('about.title') }),
      card(markdown({ text: translated('about.body') })),
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
