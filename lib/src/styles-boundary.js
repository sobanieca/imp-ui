import { impLogger } from './logger.js'

const creators = new WeakMap()
const reportedRules = new Set()

let creator = null

export const withCreator = (host, render) => {
  const previous = creator
  creator = host
  try {
    return render()
  } finally {
    creator = previous
  }
}

export const bindCreator = (render) => {
  const captured = creator
  return captured === null ? render : (...args) => withCreator(captured, () => render(...args))
}

export const noteCreator = (node) => {
  if (creator !== null) creators.set(node, creator)
}

export const noteCreators = (nodes) => {
  for (const element of elementsWithin(nodes)) noteCreator(element)
}

const PSEUDO_ELEMENT = /::[\w-]+(\([^)]*\))?/g
const USER_ACTION_PSEUDO_CLASS = /:(hover|active|focus|focus-visible|focus-within)\b/g

const plainSelector = (selector) =>
  selector.replaceAll(PSEUDO_ELEMENT, '').replaceAll(USER_ACTION_PSEUDO_CLASS, '')

const nestedSelector = (selector, parent) =>
  selector.includes('&') ? selector.replaceAll('&', `:is(${parent})`) : `:is(${parent}) ${selector}`

const matches = (element, selector) => {
  try {
    return element.matches(plainSelector(selector))
  } catch {
    return false
  }
}

const matchingSelector = (element, rules, parent) => {
  for (const rule of rules) {
    if (typeof rule.selectorText === 'string') {
      const selector = parent === null
        ? rule.selectorText
        : nestedSelector(rule.selectorText, parent)
      if (matches(element, selector)) return rule.selectorText
      if (rule.cssRules?.length) {
        const nested = matchingSelector(element, rule.cssRules, selector)
        if (nested !== null) return nested
      }
    } else if (rule.cssRules) {
      const grouped = matchingSelector(element, rule.cssRules, parent)
      if (grouped !== null) return grouped
    }
  }
  return null
}

const lostSelector = (element, creatorHost) => {
  for (const sheet of creatorHost.shadowRoot.adoptedStyleSheets) {
    const selector = matchingSelector(element, sheet.cssRules, null)
    if (selector !== null) return selector
  }
  return null
}

function* elementsWithin(nodes) {
  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    yield node
    yield* node.querySelectorAll('*')
  }
}

export const reportLostStyles = (owner, nodes) => {
  if (owner === null) return
  for (const element of elementsWithin(nodes)) {
    const creatorHost = creators.get(element)
    if (creatorHost === undefined || creatorHost === owner) continue
    const selector = lostSelector(element, creatorHost)
    if (selector === null) continue
    const key = `${creatorHost.localName} ${owner.localName} ${selector}`
    if (reportedRules.has(key)) continue
    reportedRules.add(key)
    impLogger.warn(
      `component '${creatorHost.localName}': its styles rule '${selector}' matches a <${element.localName}> that is now in the shadow root of '${owner.localName}', where the styles of '${creatorHost.localName}' do not reach - give the element its own component, use a standard component, or set an inline style`,
    )
  }
}

export const shadowOwnerOf = (node) => {
  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}
