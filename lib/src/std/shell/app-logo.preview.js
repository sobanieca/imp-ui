import { appLogo } from 'imp/std/shell'
import { icon } from 'imp/std'
import { luBox, luChartColumn } from 'imp/icons'

export const name = 'AppLogo'
export const group = 'Shell'
export const description =
  "Run 'imp skill std/appLogo' to learn what appLogo can do before using it."

const mark = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%232563eb"/></svg>',
  )

export const nameOnly = appLogo({ label: 'Acme' })
export const withAnIconMark = appLogo({ label: 'Acme', icon: icon(luBox, { size: 'lg' }) })
export const withATagline = appLogo({
  label: 'Acme',
  tagline: 'Operations console',
  icon: icon(luChartColumn, { size: 'lg' }),
})
export const withAnImage = appLogo({ label: 'Acme', src: mark })
export const compactForARail = appLogo({
  label: 'Acme',
  compact: true,
  icon: icon(luBox, { size: 'lg' }),
})
export const notALink = appLogo({ label: 'Acme', href: null, icon: icon(luBox) })
