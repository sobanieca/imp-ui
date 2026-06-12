// Feedback components: spinner, progressBar, alert, toast, modal, drawer.

import { button, css, div, h3, scopeSignal, span, t, when } from '../imp/imp.js'
import { cx, isSignal, read, split } from './util.js'

css.global`@keyframes imp-spin { to { transform: rotate(360deg); } }`

const spinnerCss = css`
  display: inline-block;
  border: 3px solid var(--imp-color-border);
  border-block-start-color: var(--imp-color-primary);
  border-radius: var(--imp-radius-full);
  animation: imp-spin 0.7s linear infinite;
`

export function spinner({ size = 24, class: extra, ...rest } = {}) {
  return span({
    ...rest,
    class: cx(spinnerCss, extra),
    role: 'status',
    'aria-label': () => t('imp.loading'),
    style: { inlineSize: size + 'px', blockSize: size + 'px' },
  })
}

const progressCss = css`
  inline-size: 100%;
  block-size: 8px;
  border-radius: var(--imp-radius-full);
  background: var(--imp-color-surface-alt);
  overflow: hidden;
  & > div {
    block-size: 100%;
    background: var(--imp-color-primary);
    border-radius: inherit;
    transition: inline-size 0.2s;
  }
`

// value: number or signal, 0..max
export function progressBar({ value = 0, max = 100, class: extra, ...rest } = {}) {
  const pct = () => Math.min(100, Math.max(0, (read(value) / read(max)) * 100)) + '%'
  return div({
    ...rest,
    class: cx(progressCss, extra),
    role: 'progressbar',
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-valuenow': typeof value === 'function' ? value : String(value),
  }, div({ style: { inlineSize: typeof value === 'function' ? pct : pct() } }))
}

const alertCss = css`
  padding: var(--imp-space-12) var(--imp-space-16);
  border-radius: var(--imp-radius-sm);
  border-inline-start: 3px solid var(--imp-color-primary);
  background: var(--imp-color-surface-alt);
  color: var(--imp-color-text);
  font-size: var(--imp-font-size-sm);
  &[data-kind="danger"] {
    border-color: var(--imp-color-danger);
  }
  &[data-kind="warning"] {
    border-color: var(--imp-color-warning);
  }
  &[data-kind="success"] {
    border-color: var(--imp-color-success);
  }
`

// kind: info (default) | danger | warning | success
export function alert(...args) {
  const [{ kind = 'info', class: extra, ...rest }, children] = split(args)
  return div({ ...rest, class: cx(alertCss, extra), role: 'alert', 'data-kind': kind }, children)
}

// --- toast --------------------------------------------------------------

const toastHostCss = css`
  position: fixed;
  inset-block-end: var(--imp-space-16);
  inset-inline-end: var(--imp-space-16);
  display: flex;
  flex-direction: column;
  gap: var(--imp-space-8);
  z-index: 1000;
`
const toastCss = css`
  padding: var(--imp-space-12) var(--imp-space-16);
  border-radius: var(--imp-radius-sm);
  background: var(--imp-color-text);
  color: var(--imp-color-bg);
  font-size: var(--imp-font-size-sm);
  box-shadow: var(--imp-shadow-md);
  transition: opacity 0.2s;
  &[data-kind="danger"] {
    background: var(--imp-color-danger);
    color: var(--imp-color-on-primary);
  }
  &[data-kind="success"] {
    background: var(--imp-color-success);
    color: var(--imp-color-on-primary);
  }
`

let toastHost = null

// toast('Saved') · toast('Failed', { kind: 'danger', duration: 5000 })
export function toast(message, { kind = 'info', duration = 3000 } = {}) {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = div({ class: toastHostCss })
    document.body.appendChild(toastHost)
  }
  const item = div({ class: toastCss, 'data-kind': kind }, message)
  toastHost.appendChild(item)
  setTimeout(() => {
    item.style.opacity = '0'
    setTimeout(() => item.remove(), 200)
  }, duration)
  return item
}

// --- modal / drawer -------------------------------------------------------

const overlayCss = css`
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`
const panelCss = css`
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  border-radius: var(--imp-radius-md);
  box-shadow: var(--imp-shadow-lg);
  padding: var(--imp-space-24);
  min-inline-size: 320px;
  max-inline-size: min(560px, 90vw);
  max-block-size: 85vh;
  overflow: auto;
`
const panelHeadCss = css`
  display: flex;
  align-items: center;
  gap: var(--imp-space-16);
  margin-block-end: var(--imp-space-16);
  & > h3 {
    margin: 0;
    flex: 1;
    font-size: var(--imp-font-size-lg);
  }
`
const closeBtnCss = css`
  border: none;
  background: none;
  color: var(--imp-color-text-muted);
  font-size: var(--imp-font-size-lg);
  cursor: pointer;
  padding: 0 var(--imp-space-4);
  border-radius: var(--imp-radius-sm);
  &:hover {
    color: var(--imp-color-text);
    background: var(--imp-color-surface-alt);
  }
`

function panelChrome(title, close, children) {
  return [
    div({ class: panelHeadCss }, [
      h3(title ?? ''),
      button({
        class: closeBtnCss,
        'aria-label': () => t('imp.close'),
        events: { click: close },
      }, '×'),
    ]),
    children,
  ]
}

// modal({ open, title }, ...content) — `open` is a boolean signal the modal
// flips back to false on backdrop click, ×, or Escape. events.close fires too.
export function modal(...args) {
  const [{ open, title, events = {} }, children] = split(args)
  const close = () => {
    if (isSignal(open)) open.set(false)
    events.close?.()
  }
  return when(open, (visible) => {
    if (!visible) return null
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
    }, { signal: scopeSignal() })
    return div(
      {
        class: overlayCss,
        events: {
          click: (e) => {
            if (e.target === e.currentTarget) close()
          },
        },
      },
      div(
        { class: panelCss, role: 'dialog', 'aria-modal': 'true' },
        panelChrome(title, close, children),
      ),
    )
  })
}

const drawerOverlayCss = css`
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.45);
  display: flex;
  justify-content: flex-end;
  z-index: 900;
  &[data-side="start"] {
    justify-content: flex-start;
  }
`
const drawerPanelCss = css`
  background: var(--imp-color-surface);
  color: var(--imp-color-text);
  box-shadow: var(--imp-shadow-lg);
  padding: var(--imp-space-24);
  inline-size: min(360px, 85vw);
  block-size: 100%;
  overflow: auto;
`

// drawer({ open, title, side: 'end' | 'start' }, ...content)
export function drawer(...args) {
  const [{ open, title, side = 'end', events = {} }, children] = split(args)
  const close = () => {
    if (isSignal(open)) open.set(false)
    events.close?.()
  }
  return when(open, (visible) => {
    if (!visible) return null
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
    }, { signal: scopeSignal() })
    return div(
      {
        class: drawerOverlayCss,
        'data-side': side,
        events: {
          click: (e) => {
            if (e.target === e.currentTarget) close()
          },
        },
      },
      div(
        { class: drawerPanelCss, role: 'dialog', 'aria-modal': 'true' },
        panelChrome(title, close, children),
      ),
    )
  })
}
