import { createLogger } from '../../logger.js'
import { isPlainObject, isStateShaped } from '../../render.js'

const log = createLogger('imp')

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

export const splitArgs = (name, args) => {
  const [first, ...rest] = args
  const hasProps = isPlainObject(first)
  const children = hasProps ? rest : args
  if (children.some(isPlainObject)) {
    log.warn(
      `${name}: props go in a single object as the first argument — later objects render nothing`,
    )
  }
  return { props: hasProps ? first : {}, children }
}

export const warnUnknownProps = (name, props, knownProps) => {
  for (const key of Object.keys(props)) {
    if (!knownProps.includes(key)) {
      log.warn(`${name}: unknown prop '${key}' — supported props are ${quoted(knownProps)}`)
    }
  }
}

export const oneOf = (name, prop, value, allowed, fallback) => {
  if (value === undefined || value === null) return fallback
  if (allowed.includes(value)) return value
  log.warn(
    `${name}: '${prop}' must be one of ${quoted(allowed)} — got '${value}', using '${fallback}'`,
  )
  return fallback
}

export const bindValue = (value, apply) => {
  if (isStateShaped(value)) value.watch(apply)
  else apply(value)
}
