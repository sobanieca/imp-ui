import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { bindValue } from './args.js'

export const createToggle = (name, { prop, source, node, event, detail, paint }) => {
  const state = isStateShaped(source) ? source : null
  let value = false
  const change = (next, { notify }) => {
    const wanted = Boolean(next)
    if (wanted === value) return
    value = wanted
    paint(value)
    if (!notify) return
    if (state) {
      if (typeof state.set === 'function') state.set(value)
      else {
        impLogger.warn(
          `${name}: '${prop}' is a read-only state - pass a writable state so ${name} can write it back`,
        )
      }
    }
    node.dispatchEvent(
      new CustomEvent(event, { bubbles: true, composed: true, detail: { [detail]: value } }),
    )
  }
  return {
    get: () => value,
    change,
    follow: (self) => bindValue(self, source, (next) => change(next, { notify: false })),
  }
}
