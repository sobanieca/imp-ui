import { impLogger } from '../../logger.js'
import { isStateShaped, splitArgsByType } from '../../render.js'

const quoted = (values) => values.map((value) => `'${value}'`).join(', ')

export const splitArgs = (name, args) => {
  const { props, children } = splitArgsByType(args, `${name}()`)
  return { props: props ?? {}, children }
}

export const warnUnknownProps = (name, props, knownProps) => {
  for (const key of Object.keys(props)) {
    if (!knownProps.includes(key)) {
      impLogger.warn(`${name}: unknown prop '${key}' - supported props are ${quoted(knownProps)}`)
    }
  }
}

export const oneOf = (name, prop, value, allowed, fallback) => {
  if (value === undefined || value === null) return fallback
  if (allowed.includes(value)) return value
  impLogger.warn(
    `${name}: '${prop}' must be one of ${quoted(allowed)} - got '${value}', using '${fallback}'`,
  )
  return fallback
}

export const stopOnRemove = (self, stop) => {
  self.abortSignal.addEventListener('abort', stop, { once: true })
}

export const bindValue = (self, value, apply) => {
  if (isStateShaped(value)) value.watch(self, apply)
  else apply(value)
}

export const bindText = (self, value) => {
  const node = document.createTextNode('')
  bindValue(self, value, (current) => {
    const next = current === null || current === undefined ? '' : String(current)
    if (node.data !== next) node.data = next
  })
  return node
}

export const bindContent = (self, value) => (value instanceof Node ? value : bindText(self, value))
