import { navigate } from '../../router.js'

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

export const leavesTheApp = (href) => ABSOLUTE_URL.test(href) || href.startsWith('//')

const opensElsewhere = (event) =>
  event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
  event.shiftKey || event.altKey

export const followHref = (href) => {
  if (leavesTheApp(href)) globalThis.location.assign(href)
  else navigate(href)
}

export const onPlainClick = (node, run) => {
  node.addEventListener('click', (event) => {
    if (opensElsewhere(event)) return
    event.preventDefault()
    run()
  })
  return node
}
