// Themable by default (essence #17). Design tokens are --imp-* CSS variables
// on :root, driven by the reactive `theme` signal. Swapping the theme writes
// the variables in one pass — every css`` rule referencing them re-skins with
// no re-render. A theme carries mode (light/dark → color-scheme +
// data-imp-mode) and direction (ltr/rtl → <html dir>).
//
// Stdlib rule: logical CSS properties only (margin-inline-*, inset-inline-*,
// text-align: start/end) so direction flips mirror layouts for free.

import { effect, signal } from './signals.js'
import { locale } from './i18n.js'

const shared = {
  'radius-none': '0',
  'radius-sm': '4px',
  'radius-md': '8px',
  'radius-lg': '14px',
  'radius-full': '9999px',
  'space-4': '4px',
  'space-8': '8px',
  'space-12': '12px',
  'space-16': '16px',
  'space-24': '24px',
  'space-32': '32px',
  'space-48': '48px',
  'space-64': '64px',
  'font-family': "system-ui, -apple-system, 'Segoe UI', sans-serif",
  'font-family-mono': "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace",
  'font-size-xs': '12px',
  'font-size-sm': '14px',
  'font-size-md': '16px',
  'font-size-lg': '18px',
  'font-size-xl': '24px',
  'font-size-2xl': '32px',
  'font-weight-normal': '400',
  'font-weight-medium': '500',
  'font-weight-bold': '700',
}

const lightColors = {
  'color-bg': '#f5f6f8',
  'color-surface': '#ffffff',
  'color-surface-alt': '#eceef2',
  'color-text': '#1a1f27',
  'color-text-muted': '#5b6472',
  'color-primary': '#2563eb',
  'color-on-primary': '#ffffff',
  'color-secondary': '#64748b',
  'color-accent': '#7c3aed',
  'color-danger': '#dc2626',
  'color-warning': '#b45309',
  'color-success': '#15803d',
  'color-border': '#d8dce3',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.08)',
  'shadow-md': '0 2px 8px rgb(0 0 0 / 0.12)',
  'shadow-lg': '0 8px 24px rgb(0 0 0 / 0.16)',
}

const darkColors = {
  'color-bg': '#11151c',
  'color-surface': '#1a202b',
  'color-surface-alt': '#232b38',
  'color-text': '#e7ebf2',
  'color-text-muted': '#9aa4b2',
  'color-primary': '#3b82f6',
  'color-on-primary': '#ffffff',
  'color-secondary': '#94a3b8',
  'color-accent': '#a78bfa',
  'color-danger': '#f87171',
  'color-warning': '#fbbf24',
  'color-success': '#4ade80',
  'color-border': '#313b4b',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.4)',
  'shadow-md': '0 2px 8px rgb(0 0 0 / 0.5)',
  'shadow-lg': '0 8px 24px rgb(0 0 0 / 0.6)',
}

const themes = new Map()

export const theme = signal(null)

// A new theme starts from the built-in token set of its mode; `tokens`
// overrides individual entries — copy-and-tweak, no full token list needed.
export function defineTheme(name, { mode = 'light', direction = 'ltr', tokens = {} } = {}) {
  themes.set(name, {
    name,
    mode,
    direction,
    tokens: { ...shared, ...(mode === 'dark' ? darkColors : lightColors), ...tokens },
  })
}

export function setTheme(name) {
  const next = themes.get(name)
  if (!next) throw new Error('imp: unknown theme: ' + name)
  theme.set(next)
}

export const themeNames = () => [...themes.keys()]

defineTheme('light', { mode: 'light' })
defineTheme('dark', { mode: 'dark' })

// 'ltr' | 'rtl' | 'auto' (derive from locale) | null (use the theme's own)
const dirOverride = signal(null)
export const setDirection = (dir) => dirOverride.set(dir)

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ckb', 'dv', 'ug', 'yi'])

function resolveDirection(t) {
  const o = dirOverride()
  if (!o) return t.direction
  if (o !== 'auto') return o
  const loc = locale()
  try {
    const l = new Intl.Locale(loc)
    const info = l.getTextInfo?.() ?? l.textInfo
    if (info?.direction) return info.direction
  } catch { /* unknown locale tag — fall back to the lang list */ }
  return RTL_LANGS.has(loc.split('-')[0]) ? 'rtl' : 'ltr'
}

// Top-level effect (never disposed — themes outlive everything).
effect(() => {
  const t = theme()
  if (!t || typeof document === 'undefined') return
  const root = document.documentElement
  for (const [k, v] of Object.entries(t.tokens)) {
    root.style.setProperty('--imp-' + k, String(v))
  }
  root.style.setProperty('color-scheme', t.mode)
  root.setAttribute('data-imp-mode', t.mode)
  root.setAttribute('dir', resolveDirection(t))
})

setTheme('light')

// setMode('light' | 'dark' | 'system') — convenience over setTheme. 'system'
// follows prefers-color-scheme live. Picks the registered theme named after
// the mode, else the first theme with that mode.
let mql = null
let mqlHandler = null

function applyMode(mode) {
  if (themes.has(mode)) return setTheme(mode)
  for (const [name, t] of themes) {
    if (t.mode === mode) return setTheme(name)
  }
}

export function setMode(mode) {
  if (mql) {
    mql.removeEventListener('change', mqlHandler)
    mql = null
  }
  if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    mqlHandler = () => applyMode(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', mqlHandler)
    applyMode(mql.matches ? 'dark' : 'light')
  } else {
    applyMode(mode)
  }
}
