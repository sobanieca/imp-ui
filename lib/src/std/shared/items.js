import { impLogger } from '../../logger.js'

export const itemId = (entry, index) => (entry.id === undefined ? String(index) : String(entry.id))

export const nodeOrNull = (value) => (value === undefined || value === null ? null : value)

export const handlerOrNull = (value) => (typeof value === 'function' ? value : null)

export const hrefOrNull = (value) => (typeof value === 'string' && value !== '' ? value : null)

export const normalizeItems = (
  name,
  value,
  { prop = 'items', shape, key = 'label', noun = 'an item', item },
) => {
  if (!Array.isArray(value)) {
    impLogger.warn(`${name}: '${prop}' must be an array of ${shape} - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || entry instanceof Node || entry[key] === undefined) {
      impLogger.warn(`${name}: ${noun} is not an object with a '${key}' - skipping it`)
      return []
    }
    const normalized = item(entry, index)
    return normalized === null ? [] : [normalized]
  })
}
