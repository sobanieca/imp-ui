import { luChartColumn, luUsers } from 'imp/icons'
import { button, heading, icon, text } from 'imp/std'
import { notify, toast } from 'imp/std/feedback'
import { flex, stack } from 'imp/std/layout'
import { appLogo, notifications, shell, userCard } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'Notifications'
export const group = groups.shell
export const description = `
  The bell lists what \`notify\` raised. Press a button, then open the bell.

  Only the scenario inside a \`shell\` frame mounts a \`toast()\` region, so only that scenario
  shows the popups. The other scenarios show that the list needs no region.
`

const raise = (label, data) => button({ events: { click: () => notify(data) } }, label)

const samples = () =>
  flex(
    { gap: 2, wrap: true },
    raise('Report sent', { kind: 'success', title: 'Report sent', description: 'To 4 people.' }),
    raise('Overdue invoice', {
      kind: 'warning',
      title: 'Invoice 1042 is overdue',
      description: 'The payment was due three days ago.',
      link: { href: '#invoice-1042', label: 'Open the invoice' },
      actions: [{ id: 'remind', label: 'Send a reminder' }, { id: 'ignore', label: 'Ignore' }],
    }),
    raise('Server error', { kind: 'error', title: 'The server did not answer' }),
  )

const embedded = (host) => {
  host.style.blockSize = '30rem'
  return host
}

export const theBell = {
  scenario: 'The bell',
  component: stack({ gap: 3 }, notifications(), samples()),
}

export const insideAShellFrame = {
  scenario: 'Inside a shell frame',
  component: embedded(
    shell(
      {
        logo: appLogo({ label: 'Acme', href: null }),
        sidebar: {
          items: [
            { id: 'reports', label: 'Reports', href: '#reports', icon: icon(luChartColumn) },
            { id: 'people', label: 'People', href: '#people', icon: icon(luUsers) },
          ],
        },
        extras: [
          notifications({ variant: 'ghost' }),
          userCard({ signedIn: true, name: 'Ada Lovelace', description: 'ada@example.com' }),
        ],
      },
      toast(),
      stack(
        { gap: 3 },
        heading({ level: 1 }, 'Reports'),
        text({ tone: 'secondary' }, 'Raise a notification, then open the bell in the bar.'),
        samples(),
      ),
    ),
  ),
}

export const ghostAndSmall = {
  scenario: 'Ghost and small',
  component: stack({ gap: 3 }, notifications({ variant: 'ghost', size: 'sm' }), samples()),
}
