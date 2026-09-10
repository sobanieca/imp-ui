const PROVIDER_LOOKUP_EVENT = 'ImpProviderLookup'

const NAMESPACED_NAME = /^[^\s.]+(\.[^\s.]+)+$/

const isNamespacedName = (name) => NAMESPACED_NAME.test(name)

export const namespacedNameProblem = (name, label, example) => {
  if (typeof name !== 'string') return `${label} must be a namespaced string like '${example}'`
  if (!isNamespacedName(name)) {
    return `${label} '${name}' must include a namespace - use dot-separated segments like '${example}'`
  }
  return null
}

export const findProvided = (kind, name, origin) => {
  let found = null
  const detail = {
    kind,
    name,
    provide: (value, provider) => {
      found = { value, provider }
    },
  }
  origin.dispatchEvent(
    new CustomEvent(PROVIDER_LOOKUP_EVENT, { detail, bubbles: true, composed: true }),
  )
  return found
}

export const collectProvided = (kind, origin) => {
  const found = []
  const named = new Set()
  const detail = {
    kind,
    collect: (name, value, provider) => {
      if (named.has(name)) return
      named.add(name)
      found.push({ name, value, provider })
    },
  }
  origin.dispatchEvent(
    new CustomEvent(PROVIDER_LOOKUP_EVENT, { detail, bubbles: true, composed: true }),
  )
  return found
}

export const providedOn = (kind, node) => {
  const found = []
  const detail = {
    kind,
    collect: (name, value, provider) => {
      found.push({ name, value, provider })
    },
  }
  node.dispatchEvent(new CustomEvent(PROVIDER_LOOKUP_EVENT, { detail, bubbles: false }))
  return found
}

export const provideOnHost = (kind, name, value, providerNode, scope) => {
  const answerLookup = (event) => {
    const detail = event.detail
    if (detail?.kind !== kind) return
    if (detail.collect) {
      detail.collect(name, value, providerNode)
      return
    }
    if (detail.name !== name) return
    event.stopImmediatePropagation()
    detail.provide(value, providerNode)
  }
  providerNode.addEventListener(PROVIDER_LOOKUP_EVENT, answerLookup)
  scope.addCleanup(() => {
    providerNode.removeEventListener(PROVIDER_LOOKUP_EVENT, answerLookup)
  })
}
