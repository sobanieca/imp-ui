import { impLogger } from '../../logger.js'

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte']

const UNIT_STEP = 1000

const TYPES_BY_EXTENSION = { heic: 'image/heic', heif: 'image/heif' }

export const fileTypeOf = (file) => {
  const type = String(file.type ?? '').toLowerCase()
  if (type) return type
  const extension = String(file.name ?? '')
    .toLowerCase()
    .match(/\.([^./]+)$/)?.[1]
  return TYPES_BY_EXTENSION[extension] ?? ''
}

export const readAccept = (name, accept) => {
  if (accept === undefined || accept === null) return []
  if (typeof accept !== 'string') {
    impLogger.warn(`${name}: 'accept' must be a string like 'image/*,.pdf' - ignoring it`)
    return []
  }
  return accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
}

const matchesRule = (rule, file) => {
  const fileName = String(file.name ?? '').toLowerCase()
  const fileType = fileTypeOf(file)
  if (rule.startsWith('.')) return fileName.endsWith(rule)
  if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1))
  return fileType === rule
}

export const acceptsFile = (rules, file) =>
  rules.length === 0 || rules.some((rule) => matchesRule(rule, file))

const numberFormat = (locale, unit) => {
  const options = {
    style: 'unit',
    unit,
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: 1,
  }
  try {
    return new Intl.NumberFormat(locale, options)
  } catch (failure) {
    impLogger.debug(`fileUpload: '${locale}' is not a language tag Intl reads`, failure)
    return new Intl.NumberFormat(undefined, options)
  }
}

export const formatFileSize = (bytes, locale) => {
  let amount = bytes
  let unit = 0
  while (amount >= UNIT_STEP && unit < UNITS.length - 1) {
    amount /= UNIT_STEP
    unit += 1
  }
  return numberFormat(locale, UNITS[unit]).format(amount)
}
