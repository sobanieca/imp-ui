import { component } from 'imp'
import { div, p } from 'imp/html'
import { initState } from 'imp/state'
import { router } from 'imp/router'
import { button, heading, text } from 'imp/std'
import { appLogo, shell } from 'imp/std/shell'
import { app } from './app-map.js'

const counter = component('app-counter', {
  setup: (self) => {
    const clicks = initState(self, 'app.clicks', 0)
    return div(
      heading('Hello from imp'),
      text('Edit src/app.js and the page reloads itself.'),
      text(
        'Now point your AI agent at ',
        text({ inline: true, weight: 'bold' }, 'imp skill'),
        ' and start building!',
      ),
      p(
        { id: 'clicks' },
        clicks.text((value) => `Clicks: ${value}`),
      ),
      button(
        { variant: 'primary', events: { click: () => clicks.set((value) => value + 1) } },
        'Click me',
      ),
    )
  },
})

export const root = component('app-root', {
  setup: () =>
    shell(
      { map: app, logo: appLogo({ label: '{{TITLE_QUOTED}}' }) },
      router({ map: app, screens: { [app]: () => counter() } }),
    ),
})
