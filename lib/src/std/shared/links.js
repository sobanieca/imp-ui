import { navigate } from '../../router.js'
import { impLogger } from '../../logger.js'

const RELATIVE_BASE = 'https://relative.invalid/'

const LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

const schemeOf = (href) => URL.parse(href, RELATIVE_BASE)?.protocol ?? null

export const isSafeLink = (href) => LINK_SCHEMES.includes(schemeOf(href))

const IMAGE_SCHEMES = ['http:', 'https:']

const EMBEDDED_IMAGE = 'data:image/'

export const isSafeImage = (src) => {
  if (typeof src !== 'string' || src === '') return false
  if (src.startsWith(EMBEDDED_IMAGE)) return true
  return IMAGE_SCHEMES.includes(schemeOf(src))
}

export const safeHref = (name, href) => {
  if (typeof href !== 'string' || href === '') return null
  if (isSafeLink(href)) return href
  impLogger.warn(
    `${name}: an 'href' with the scheme '${
      schemeOf(href) ?? 'unknown'
    }' is not followed - use http:, https:, mailto:, tel:, a path or a '#' fragment`,
  )
  return null
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

export const leavesTheApp = (href) => ABSOLUTE_URL.test(href) || href.startsWith('//')

const opensElsewhere = (event) =>
  event.defaultPrevented
  || event.button !== 0
  || event.metaKey
  || event.ctrlKey
  || event.shiftKey
  || event.altKey

const BROWSER_SCHEMES = ['mailto:', 'tel:']

export const followHref = (href) => {
  if (BROWSER_SCHEMES.includes(schemeOf(href))) globalThis.location.assign(href)
  else navigate(href, { external: true })
}

export const onPlainClick = (node, run) => {
  node.addEventListener('click', (event) => {
    if (opensElsewhere(event)) return
    event.preventDefault()
    run()
  })
  return node
}
