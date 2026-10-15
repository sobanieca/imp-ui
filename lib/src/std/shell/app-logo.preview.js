import { appLogo } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox, luChartColumn } from 'imp/icons'
import { groups } from '../preview-groups.js'

export const name = 'AppLogo'
export const group = groups.shell

const disc = (fill) =>
  'data:image/svg+xml;utf8,'
  + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`,
  )

const mark = disc('#2563eb')

const wordmark = (ink) =>
  'data:image/svg+xml;utf8,'
  + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><circle cx="16" cy="16" r="12" fill="#2563eb"/><text x="36" y="23" font-family="Georgia, serif" font-size="22" font-style="italic" fill="${ink}">Acme</text></svg>`,
  )

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
export const aWholeLogoImage = {
  scenario: 'A whole logo image',
  component: appLogo({ label: 'Acme', image: wordmark('#0f172a') }),
}
export const aWholeLogoImagePerScheme = {
  scenario: 'A whole logo image per scheme',
  component: appLogo({
    label: 'Acme',
    image: { light: wordmark('#0f172a'), dark: wordmark('#f8fafc') },
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
