import { t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { pathProblem, readPath, writePath } from '../shared/path.js'
import { ERRORS, SUBMITS, TOUCHED, VALIDATING, VALUES } from './form-state.js'
import { useState } from '../../api/state.js'

const MISSING = Symbol('imp.field.missing')

export const describeError = (error) => {
  if (!error) return ''
  return error.key === undefined ? error.message : t(error.key, error.params)
}

const asError = (result) => {
  if (!result) return null
  if (typeof result === 'string') return { message: result }
  return result
}

const isBlank = (value) => value === undefined || value === null || value === ''

const without = (current, path) => {
  if (!Object.hasOwn(current, path)) return current
  const rest = { ...current }
  delete rest[path]
  return rest
}

const buildValidator = (name, props, { emptyWhen = isBlank } = {}) => {
  const checks = []
  if (props.required) {
    checks.push((value) => emptyWhen(value) ? { key: 'imp.form.required' } : null)
  }
  if (props.minLength !== undefined) {
    checks.push((value) =>
      !isBlank(value) && String(value).length < props.minLength
        ? { key: 'imp.form.minLength', params: { min: props.minLength } }
        : null
    )
  }
  if (props.maxLength !== undefined) {
    checks.push((value) =>
      !isBlank(value) && String(value).length > props.maxLength
        ? { key: 'imp.form.maxLength', params: { max: props.maxLength } }
        : null
    )
  }
  if (props.min !== undefined) {
    checks.push((value) =>
      !isBlank(value) && Number(value) < props.min
        ? { key: 'imp.form.min', params: { min: props.min } }
        : null
    )
  }
  if (props.max !== undefined) {
    checks.push((value) =>
      !isBlank(value) && Number(value) > props.max
        ? { key: 'imp.form.max', params: { max: props.max } }
        : null
    )
  }
  if (props.pattern !== undefined) {
    const pattern = props.pattern instanceof RegExp ? props.pattern : new RegExp(props.pattern)
    checks.push((value) =>
      !isBlank(value) && !pattern.test(String(value)) ? { key: 'imp.form.pattern' } : null
    )
  }
  if (props.validate !== undefined) {
    if (typeof props.validate !== 'function') {
      impLogger.warn(
        `${name}: 'validate' must be a function returning a message or null - ignoring it`,
      )
    } else {
      checks.push((value) => asError(props.validate(value)))
    }
  }
  return (value) => {
    for (const check of checks) {
      const problem = check(value)
      if (problem) return problem
    }
    return null
  }
}

const buildAsyncValidator = (name, props) => {
  if (props.validateAsync === undefined) return null
  if (typeof props.validateAsync !== 'function') {
    impLogger.warn(
      `${name}: 'validateAsync' must be a function returning a promise of a message or null - ignoring it`,
    )
    return null
  }
  return async (value) => asError(await props.validateAsync(value))
}

const CHECK_FAILED = { key: 'imp.form.checkFailed' }

const createLocalSignal = () => {
  const subscribers = new Set()
  return {
    notify: (value) => {
      for (const subscriber of [...subscribers]) subscriber(value)
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
}

const dedupe = (fn) => {
  let last = MISSING
  return (value) => {
    if (Object.is(value, last)) return
    last = value
    fn(value)
  }
}

const boundToForm = (name, props, validator, checkAsync, self) => {
  const path = props.field
  const problem = pathProblem(path)
  if (problem) throw new Error(`imp: ${name}: 'field' ${problem}`)
  let values
  try {
    values = useState(self, VALUES)
  } catch {
    throw new Error(
      `imp: ${name}: field '${path}' has no form around it - a control with 'field' must be rendered inside form({ initialValues }), which owns the '${VALUES}' state it writes into`,
    )
  }
  const errors = useState(self, ERRORS)
  const touched = useState(self, TOUCHED)
  const submits = useState(self, SUBMITS)
  const validating = useState(self, VALIDATING)

  const read = () => readPath(values.get(), path)

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
    const problem = validator(read())
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
  })

  const check = async () => {
    const problem = validateNow()
    if (problem || !checkAsync) return problem
    const token = ++run
    markChecking(true)
    try {
      const outcome = await checkAsync(read())
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

  return {
    path,
    read,
    watch: (fn) => values.watch(dedupe((all) => fn(readPath(all, path)))),
    commit: (next) => {
      values.set((all) => writePath(all, path, next))
      validateNow()
    },
    touch: () => {
      touched.set((all) => (all?.[path] ? all : { ...(all ?? {}), [path]: true }))
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

const standalone = (name, props, validator, checkAsync) => {
  const bound = isStateShaped(props.value) ? props.value : null
  const isPlainList = Array.isArray(props.value)
  if (props.value !== undefined && !bound && typeof props.value === 'object' && !isPlainList) {
    impLogger.warn(
      `${name}: 'value' is an object that is not a state - pass a state or a plain value`,
    )
  }
  let local = bound ? undefined : props.value
  const values = createLocalSignal()
  const problems = createLocalSignal()
  const visibility = createLocalSignal()
  const checking = createLocalSignal()
  let problem = null
  let touched = false
  let isChecking = false
  let run = 0

  const read = () => (bound ? bound.get() : local)

  const validateNow = () => {
    problem = validator(read())
    problems.notify(problem)
    return problem
  }

  return {
    path: null,
    read,
    watch: (fn) => {
      const notify = dedupe(fn)
      if (bound) return bound.watch(notify)
      const stop = values.subscribe(notify)
      notify(local)
      return stop
    },
    commit: (next) => {
      if (bound) {
        if (typeof bound.set !== 'function') {
          impLogger.warn(
            `${name}: 'value' is a read-only state ('${bound.name}'), so what the user types cannot be kept - pass a state with 'set', or a 'field' inside a form`,
          )
          return
        }
        bound.set(next)
      } else {
        local = next
        values.notify(next)
      }
      validateNow()
    },
    touch: () => {
      if (touched) return
      touched = true
      visibility.notify(true)
    },
    watchError: (fn) => {
      const stop = problems.subscribe(fn)
      fn(problem)
      return stop
    },
    watchVisible: (fn) => {
      const stop = visibility.subscribe(fn)
      fn(touched)
      return stop
    },
    watchSubmits: () => () => {},
    watchChecking: (fn) => {
      const stop = checking.subscribe(fn)
      fn(isChecking)
      return stop
    },
    validateNow,
    check: async () => {
      const found = validateNow()
      if (found || !checkAsync) return found
      const token = ++run
      isChecking = true
      checking.notify(true)
      try {
        const outcome = await checkAsync(read())
        if (token !== run) return null
        problem = outcome
        problems.notify(problem)
        return outcome
      } catch (error) {
        if (token !== run) return null
        impLogger.error(`${name}: the check could not run`, error)
        problem = CHECK_FAILED
        problems.notify(problem)
        return CHECK_FAILED
      } finally {
        if (token === run) {
          isChecking = false
          checking.notify(false)
        }
      }
    },
  }
}

export const createFieldBinding = (name, props, options = {}) => {
  const validator = buildValidator(name, props, options)
  const checkAsync = buildAsyncValidator(name, props)
  if (props.field !== undefined) {
    if (props.value !== undefined) {
      impLogger.warn(
        `${name}: 'field' and 'value' are alternatives - using 'field' ('${props.field}')`,
      )
    }
    return boundToForm(name, props, validator, checkAsync, options.self)
  }
  return standalone(name, props, validator, checkAsync)
}
