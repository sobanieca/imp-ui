import { impLogger } from '../../logger.js'
import { isPlainObject } from '../../render.js'
import { emptyState } from '../display/empty-state.js'

export const emptyNode = (name, prop, value, variant) => {
  if (value instanceof Node) return value
  if (value !== undefined && !isPlainObject(value)) {
    impLogger.warn(
      `${name}: '${prop}' must be the props of emptyState or a DOM node - drawing the default`,
    )
  }
  return emptyState({ ...(isPlainObject(value) ? value : {}), variant })
}
