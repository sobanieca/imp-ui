import { appLogo } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox, luChartColumn } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'AppLogo'
export const group = groups.shell

const disc = (fill) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`,
  )

const mark = disc('#2563eb')

export const nameOnly = { scenario: 'Name only', component: appLogo({ label: 'Acme' }) }
export const withAnIconMark = {
  scenario: 'With an icon mark',
  component: appLogo({ label: 'Acme', icon: icon(luBox, { size: 'lg' }) }),
}
export const withATagline = {
  scenario: 'With a tagline',
  component: appLogo({
    label: 'Acme',
    tagline: 'Operations console',
    icon: icon(luChartColumn, { size: 'lg' }),
  }),
}
export const withAnImage = {
  scenario: 'With an image',
  component: appLogo({ label: 'Acme', src: mark }),
}
export const withAnImagePerScheme = {
  scenario: 'With an image per scheme',
  component: appLogo({
    label: 'Acme',
    src: { light: disc('#0f3a5d'), dark: disc('#f9a51e') },
  }),
}
export const compactForARail = {
  scenario: 'Compact for a rail',
  component: appLogo({
    label: 'Acme',
    compact: true,
    icon: icon(luBox, { size: 'lg' }),
  }),
}
export const notALink = {
  scenario: 'Not a link',
  component: appLogo({ label: 'Acme', href: null, icon: icon(luBox) }),
}
