import { el, isPlainObject } from './render.js'
import { impLogger } from './logger.js'
import { analyticsNameProblem, zoneConnected, zoneDisconnected } from './analytics-bus.js'

const ZONE_TAG = 'imp-zone'

const zoneNames = new WeakMap()

export const zoneNameOf = (zone) => zoneNames.get(zone) ?? null

const defineZone = () => {
  if (customElements.get(ZONE_TAG)) return
  customElements.define(
    ZONE_TAG,
    class extends HTMLElement {
      connectedCallback() {
        zoneConnected(this)
      }

      disconnectedCallback() {
        zoneDisconnected(this)
      }
    },
  )
}

export const zone = (props, ...children) => {
  if (!isPlainObject(props) || props.name === undefined) {
    throw new Error(
      "imp: zone({ name }, ...children) - the first argument is the props, like zone({ name: 'myapp.invoice-summary' }, summaryCard())",
    )
  }
  const unknown = Object.keys(props).filter((key) => key !== 'name')
  if (unknown.length) {
    throw new Error(`imp: zone({ name }) takes a name only - remove ${unknown.join(', ')}`)
  }
  defineZone()
  const node = el(ZONE_TAG, ...children)
  node.style.display = 'contents'
  const problem = analyticsNameProblem(props.name, 'zone', 'myapp.invoice-summary')
  if (problem) {
    impLogger.error(`${problem} - the zone records nothing`)
    return node
  }
  node.setAttribute('name', props.name)
  zoneNames.set(node, props.name)
  return node
}
