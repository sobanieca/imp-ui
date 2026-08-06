import { computed } from 'imp/state'
import { lang, t } from 'imp/i18n'
import { heading, link, text } from 'imp/std'
import { flex } from 'imp/std/layout'

export const words = (key, values) => lang.text(() => t(key, values))

export const message = (key, values) => computed([lang], () => t(key, values))

export const messagePanel = (key, detail = null) =>
  flex(
    { direction: 'column', gap: 3 },
    heading({ level: 2 }, words(key)),
    detail && text({ tone: 'secondary' }, detail),
    link({ href: '/' }, words('app.home')),
  )

export const loadingPanel = () => text({ tone: 'secondary' }, words('app.loading'))
