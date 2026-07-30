const PROVIDER_LOOKUP_EVENT = 'ImpProviderLookup'

const NAMESPACED_NAME = /^[^\s.]+(\.[^\s.]+)+$/

export const isNamespacedName = (name) => NAMESPACED_NAME.test(name)

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

export const provideOnHost = (kind, name, value, providerNode, scope) => {
  const answerLookup = (event) => {
    if (event.detail?.kind !== kind || event.detail?.name !== name) return
    event.stopImmediatePropagation()
    event.detail.provide(value, providerNode)
  }
  providerNode.addEventListener(PROVIDER_LOOKUP_EVENT, answerLookup)
  scope.addCleanup(() => {
    providerNode.removeEventListener(PROVIDER_LOOKUP_EVENT, answerLookup)
  })
}
