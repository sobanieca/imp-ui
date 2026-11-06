import { claimThroughSelf } from '../../component.js'
import { provideOnHost } from '../../provide.js'
import { useState } from '../../api/state.js'
import { impLogger } from '../../logger.js'
import { readPath, writePath } from '../shared/path.js'
import {
  ERRORS,
  FIELD_BINDER,
  FIELD_BINDER_KIND,
  SUBMITS,
  TOUCHED,
  VALIDATING,
  VALUES,
} from './form-state.js'
import { useSecrets } from './form-secrets.js'
import { CHECK_FAILED, dedupe, sameValue } from './field.js'

// The half of a field binding that only a form needs. form() provides it to the controls inside
// it, so an app with no form() does not bundle it.

const without = (current, path) => {
  if (!Object.hasOwn(current, path)) return current
  const rest = { ...current }
  delete rest[path]
  return rest
}

const valueSource = (path, values) => ({
  read: () => readPath(values.get(), path),
  watch: (fn) => values.watch(dedupe((all) => fn(readPath(all, path)))),
  write: (next) => values.set((all) => writePath(all, path, next)),
})

const secretSource = (name, path, values, self) => {
  const secrets = useSecrets(self)
  if (readPath(values.get(), path) !== undefined) {
    impLogger.warn(
      `${name}: field '${path}' is secret, so it starts empty and its value in 'initialValues' is not used - remove that value from 'initialValues'`,
    )
  }
  const read = () => secrets.read(path)
  return {
    read,
    watch: (fn) => {
      const push = dedupe(fn)
      push(read())
      return secrets.subscribe(() => push(read()))
    },
    write: (next) => secrets.write(path, next),
  }
}

const boundToForm = (name, props, validator, checkAsync, self) => {
  const path = props.field
  const values = useState(self, VALUES)
  const errors = useState(self, ERRORS)
  const touched = useState(self, TOUCHED)
  const submits = useState(self, SUBMITS)
  const validating = useState(self, VALIDATING)
  const context = () => ({ values: values.get() })

  const source = props.secret ? secretSource(name, path, values, self) : valueSource(path, values)
  const read = source.read
  const start = read()

  const storeError = (problem) => {
    errors.set((all) => {
      const current = all ?? {}
      if (!problem) {
        return without(current, path)
      }
      return { ...current, [path]: problem }
    })
  }

  const validateNow = () => {
    const problem = validator(read(), context())
    storeError(problem)
    return problem
  }

  const markChecking = (checking) => {
    validating.set((all) => {
      const current = all ?? {}
      if (checking) return current[path] ? current : { ...current, [path]: true }
      return without(current, path)
    })
  }

  let run = 0

  self.abortSignal.addEventListener('abort', () => {
    run += 1
    markChecking(false)
    storeError(null)
  })

  const check = async () => {
    const problem = validateNow()
    if (problem || !checkAsync) return problem
    const token = ++run
    markChecking(true)
    try {
      const outcome = await checkAsync(read(), context())
      if (token !== run) return null
      storeError(outcome)
      return outcome
    } catch (error) {
      if (token !== run) return null
      impLogger.error(`${name}: the check for '${path}' could not run`, error)
      storeError(CHECK_FAILED)
      return CHECK_FAILED
    } finally {
      if (token === run) markChecking(false)
    }
  }

  const touch = () => {
    touched.set((all) => (all?.[path] ? all : { ...(all ?? {}), [path]: true }))
  }

  return {
    path,
    read,
    watch: source.watch,
    commit: (next) => {
      source.write(next)
      validateNow()
    },
    touch,
    leave: () => {
      if (!sameValue(read(), start)) touch()
    },
    watchError: (fn) => errors.watch(dedupe((all) => fn(all?.[path] ?? null))),
    watchVisible: (fn) => {
      let isTouched = false
      let attempts = 0
      const push = dedupe(fn)
      const stopTouched = touched.watch((all) => {
        isTouched = Boolean(all?.[path])
        push(isTouched || attempts > 0)
      })
      const stopSubmits = submits.watch((count) => {
        attempts = count ?? 0
        push(isTouched || attempts > 0)
      })
      return () => {
        stopTouched()
        stopSubmits()
      }
    },
    watchSubmits: (fn) => submits.watch(fn),
    watchChecking: (fn) => validating.watch(dedupe((all) => fn(Boolean(all?.[path])))),
    validateNow,
    check,
  }
}

export const provideFieldBinder = (self) =>
  claimThroughSelf(self, FIELD_BINDER_KIND, 'form', FIELD_BINDER, (scope) => {
    provideOnHost(FIELD_BINDER_KIND, FIELD_BINDER, boundToForm, scope.host, scope)
    return boundToForm
  })
