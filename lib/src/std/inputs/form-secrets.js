import { findProvided, provideOnHost } from '../../provide.js'
import { claimThroughSelf, resolveThroughSelf } from '../../component.js'
import { writePath } from '../shared/path.js'

const SECRETS_KIND = 'form-secrets'

const SECRETS = 'imp.form.secrets'

const isBlank = (value) => value === undefined || value === null || value === ''

const createSecretStore = () => {
  const held = new Map()
  const subscribers = new Set()
  const notify = () => {
    for (const subscriber of [...subscribers]) subscriber()
  }
  return Object.freeze({
    read: (path) => held.get(path),
    write: (path, value) => {
      held.set(path, value)
      notify()
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
    holdsAny: () => [...held.values()].some((value) => !isBlank(value)),
    mergeInto: (values) =>
      [...held].reduce((all, [path, value]) => writePath(all, path, value), values),
    clear: () => {
      if (held.size === 0) return
      held.clear()
      notify()
    },
  })
}

export const provideSecrets = (self) =>
  claimThroughSelf(self, SECRETS_KIND, 'form', SECRETS, (scope) => {
    const store = createSecretStore()
    provideOnHost(SECRETS_KIND, SECRETS, store, scope.host, scope)
    return store
  })

export const useSecrets = (self) =>
  resolveThroughSelf(
    self,
    SECRETS_KIND,
    'field',
    SECRETS,
    (scope) => findProvided(SECRETS_KIND, SECRETS, scope.host)?.value ?? null,
  )
