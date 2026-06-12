// Translatable by default (essence #18). `locale` is a signal; t()/n()/d()/rt()
// read it, so using them inside a function child (() => t('key')) re-localizes
// just that text node when the locale changes.
//
// Catalogs are flat objects: { 'todo.title': 'Todos' } — dots are plain
// characters, no nesting. A message may be a plural-forms object
// { zero?, one, two?, few?, many?, other } selected by params.count via
// Intl.PluralRules. {name} placeholders interpolate from params.

import { signal } from './signals.js'

export const locale = signal('en')
export const setLocale = (loc) => locale.set(loc)

let fallbackLocale = 'en'
export const setFallbackLocale = (loc) => {
  fallbackLocale = loc
}

const catalogs = new Map() // locale → flat message object

export function defineMessages(loc, messages) {
  catalogs.set(loc, { ...catalogs.get(loc), ...messages })
}

function lookup(loc, key) {
  const hit = catalogs.get(loc)?.[key]
  if (hit !== undefined) return hit
  const base = loc.split('-')[0]
  if (base !== loc) return catalogs.get(base)?.[key]
}

export function t(key, params) {
  const loc = locale()
  let msg = lookup(loc, key) ?? lookup(fallbackLocale, key) ?? key
  if (msg !== null && typeof msg === 'object') {
    const count = params?.count ?? 0
    const form = count === 0 && msg.zero !== undefined
      ? 'zero'
      : new Intl.PluralRules(loc).select(count)
    msg = msg[form] ?? msg.other ?? key
  }
  if (params) {
    msg = String(msg).replace(/\{(\w+)\}/g, (m, name) => {
      const v = params[name]
      if (v === undefined) return m
      return typeof v === 'number' ? v.toLocaleString(loc) : String(v)
    })
  }
  return msg
}

// Number formatting: n(1234.5) · n(0.13, { style: 'percent' })
export const n = (value, opts) => new Intl.NumberFormat(locale(), opts).format(value)

// Date formatting: d(date) · d(date, { dateStyle: 'long' })
export const d = (date, opts = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(locale(), opts).format(date)

// Relative time: rt(fiveMinAgo) → "5 minutes ago" (largest fitting unit)
const RT_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]
export function rt(date) {
  const secs = (new Date(date).getTime() - Date.now()) / 1000
  const fmt = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  for (const [unit, size] of RT_UNITS) {
    if (Math.abs(secs) >= size || unit === 'second') {
      return fmt.format(Math.round(secs / size), unit)
    }
  }
}
