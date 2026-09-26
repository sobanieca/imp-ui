import { component } from 'imp'
import { initState } from 'imp/state'
import { text } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { appLogo, orgSelect } from 'imp/std/shell'
import { groups } from '../preview-groups.js'

export const name = 'OrgSelect'
export const group = groups.shell

const mark = (fill) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/></svg>`,
  )

const ORGS = [
  { id: 'acme', name: 'Acme Corporation', description: 'Owner', picture: mark('#2563eb') },
  { id: 'globex', name: 'Globex', description: 'Member' },
  { id: 'initech', name: 'Initech', description: 'Billing admin', picture: mark('#16a34a') },
]

export const threeOrganizations = {
  scenario: 'Three organizations',
  component: orgSelect({ orgs: ORGS, selected: 'globex' }),
}

export const namesOnly = {
  scenario: 'Names only',
  component: orgSelect({ orgs: [{ id: 'acme', name: 'Acme' }, { id: 'globex', name: 'Globex' }] }),
}

export const compactForARail = {
  scenario: 'Compact',
  component: orgSelect({ orgs: ORGS, selected: 'initech', compact: true }),
}

export const besideTheLogo = {
  scenario: 'Beside the logo, as the logo slot of a shell',
  component: flex(
    { gap: 2, verticalAlign: 'center' },
    appLogo({ label: 'Acme', tagline: 'Console' }),
    orgSelect({ orgs: ORGS, selected: 'acme', size: 'sm' }),
  ),
}

export const drivenByAState = {
  scenario: 'Driven by a state, reporting the choice',
  component: component('org-select-state-demo', {
    setup: (self) => {
      const current = initState(self, 'demo.org', 'acme')
      const log = initState(self, 'demo.log', 'Pick another organization.')
      return stack(
        { gap: 3, horizontalAlign: 'start' },
        orgSelect({
          orgs: ORGS,
          selected: current,
          events: { select: (event) => log.set(`select: ${event.detail.org.name}`) },
        }),
        text({ tone: 'secondary' }, current.text((id) => `Current: ${id}`)),
        text({ tone: 'secondary', size: 'sm' }, log.text((entry) => entry)),
      )
    },
  })(),
}

export const emptyWarns = { scenario: 'No organizations warns', component: orgSelect({ orgs: [] }) }
