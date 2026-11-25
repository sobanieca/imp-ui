import { component } from 'imp'
import { initState } from 'imp/state'
import { text } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { appLogo, tenantSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'TenantSelect'
export const group = groups.shell

const mark = (fill) =>
  'data:image/svg+xml;utf8,'
  + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/></svg>`,
  )

const TENANTS = [
  {
    id: 'acme',
    name: 'Acme Corporation',
    description: 'Owner',
    picture: mark('#2563eb'),
    tag: { text: 'Admin', color: 'violet' },
  },
  { id: 'globex', name: 'Globex', description: 'Member', tag: { text: 'Member', color: 'gray' } },
  { id: 'initech', name: 'Initech', description: 'Billing admin', picture: mark('#16a34a') },
]

export const threeTenants = {
  scenario: 'Three tenants',
  component: tenantSelect({ tenants: TENANTS, selected: 'globex' }),
}

export const namesOnly = {
  scenario: 'Names only',
  component: tenantSelect({
    tenants: [
      { id: 'acme', name: 'Acme' },
      { id: 'globex', name: 'Globex' },
    ],
  }),
}

export const compactForARail = {
  scenario: 'Compact',
  component: tenantSelect({ tenants: TENANTS, selected: 'initech', compact: true }),
}

export const besideTheLogo = {
  scenario: 'Beside the logo, as the tenant slot of a shell shows it',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    appLogo({ label: 'Acme', tagline: 'Console' }),
    tenantSelect({ tenants: TENANTS, selected: 'acme', size: 'sm' }),
  ),
}

export const withACreateButton = {
  scenario: 'With a held create item first in the menu',
  component: component('tenant-select-create-demo', {
    setup: (self) => {
      const log = initState(self, 'demo.createLog', 'Open the menu and hold Create workspace.')
      return stack(
        { gap: 3, horizontalAlign: 'start' },
        tenantSelect({
          tenants: TENANTS,
          selected: 'acme',
          onCreateClick: () => log.set('onCreateClick: open the form of a new workspace'),
        }),
        text(
          { tone: 'secondary', size: 'sm' },
          log.text((entry) => entry),
        ),
      )
    },
  })(),
}

export const drivenByAState = {
  scenario: 'Driven by a state, reporting the choice',
  component: component('tenant-select-state-demo', {
    setup: (self) => {
      const current = initState(self, 'demo.tenant', 'acme')
      const log = initState(self, 'demo.log', 'Pick another workspace.')
      return stack(
        { gap: 3, horizontalAlign: 'start' },
        tenantSelect({
          tenants: TENANTS,
          selected: current,
          events: { select: (event) => log.set(`select: ${event.detail.tenant.name}`) },
        }),
        text(
          { tone: 'secondary' },
          current.text((id) => `Current: ${id}`),
        ),
        text(
          { tone: 'secondary', size: 'sm' },
          log.text((entry) => entry),
        ),
      )
    },
  })(),
}

export const emptyWarns = { scenario: 'No tenants warns', component: tenantSelect({ tenants: [] }) }
