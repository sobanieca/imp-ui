import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { defaultMessages, lang } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { luMinus, luPlus } from '../../icons/lucide-icons.js'
import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { bindValue, oneOf, stopOnRemove } from '../shared/args.js'
import { focusRing, fontFamily, hiddenRule, token } from '../shared/css.js'
import { ownEvents } from '../shared/own-events.js'
import { translatedLabel } from '../shared/translated-label.js'

const NAME = 'map'

const KNOWN_PROPS = ['label', 'center', 'zoom', 'maxZoom', 'detail', 'pins', 'events']

const ANCHORS = ['center', 'bottom']

const DETAILS = ['low', 'medium', 'high']

const ROAD_KINDS = ['major', 'secondary']

const MOVE_EVENT = 'move'

const SELECT_EVENT = 'select'

const DEFAULT_MAX_ZOOM = 6

const MAX_LATITUDE = 85.0511

const TILE_SIZE = 256

const PLACE_ZOOM_BIAS = 1

const WHEEL_ZOOM_PER_NOTCH = 0.5

const KEY_PAN_FRACTION = 0.25

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const messages = {
  'imp.map.zoomIn': 'Zoom in',
  'imp.map.zoomOut': 'Zoom out',
}

const waterColor = () =>
  `color-mix(in oklab, ${token('color-primary')} 16%, ${token('color-surface-sunken')})`

const styles = () => `
  ${hiddenRule}

  :host {
    display: block;
    block-size: 24rem;
    min-inline-size: 0;
  }

  .root {
    position: relative;
    block-size: 100%;
  }

  .viewport {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${waterColor()};
    ${fontFamily()}
    color: ${token('color-text')};
    touch-action: none;
    user-select: none;
    cursor: grab;
  }

  .viewport:focus-visible {${focusRing()}}

  .viewport.dragging {
    cursor: grabbing;
  }

  .canvas {
    position: absolute;
    inset: 0;
    direction: ltr;
  }

  .world,
  .places,
  .pins {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform-origin: 0 0;
  }

  .world {
    display: block;
    overflow: visible;
  }

  .land {
    fill: ${token('color-surface')};
    fill-rule: evenodd;
    stroke: ${token('color-border')};
    stroke-width: 1;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .lake {
    fill: ${waterColor()};
  }

  .road {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .road.major {
    stroke: color-mix(in oklab, ${token('color-text')} 45%, ${token('color-surface')});
    stroke-width: 1.5;
  }

  .road.secondary {
    stroke: color-mix(in oklab, ${token('color-text')} 28%, ${token('color-surface')});
    stroke-width: 1;
  }

  .places {
    pointer-events: none;
  }

  .place {
    position: absolute;
    display: flex;
    align-items: center;
    gap: ${token('space-1')};
    font-size: ${token('font-size-sm')};
    line-height: 1;
    white-space: nowrap;
    transform: translate(var(--x), var(--y)) translate(-4px, -50%);
  }

  .place[hidden] {
    display: none;
  }

  .place::before {
    content: '';
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background-color: ${token('color-text')};
  }

  .pin {
    position: absolute;
    transform: translate(var(--x), var(--y)) translate(-50%, -50%);
  }

  .pin.anchor-bottom {
    transform: translate(var(--x), var(--y)) translate(-50%, -100%);
  }

  .marker {
    display: block;
    box-sizing: border-box;
    inline-size: 16px;
    block-size: 16px;
    margin: 0;
    padding: 0;
    border: 2px solid ${token('color-surface')};
    border-radius: 50%;
    background-color: ${token('color-primary')};
    box-shadow: 0 1px 3px ${token('color-shadow')};
    cursor: pointer;
  }

  .marker:focus-visible {${focusRing()}}

  .controls {
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-end: ${token('space-2')};
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
  }

  @media (forced-colors: active) {
    .viewport { background-color: Canvas }
    .land { fill: Canvas; stroke: CanvasText }
    .lake { fill: Canvas; stroke: CanvasText; vector-effect: non-scaling-stroke }
    .road.major { stroke: CanvasText }
    .road.secondary { stroke: GrayText }
    .place::before { background-color: CanvasText }
    .marker { background-color: ButtonText; border-color: ButtonFace; forced-color-adjust: none }
  }
`

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

const decodePoints = (text, closed) => {
  const points = []
  const position = [0, 0]
  let index = 0
  let axis = 0
  while (index < text.length) {
    let result = 0
    let shift = 0
    let chunk
    do {
      chunk = text.charCodeAt(index++) - 63
      result |= (chunk & 0x1f) << shift
      shift += 5
    } while (chunk >= 0x20)
    position[axis] += result & 1 ? ~(result >> 1) : result >> 1
    if (axis === 1) points.push(`${position[0]} ${position[1]}`)
    axis = 1 - axis
  }
  return `M${points.join(' ')}${closed ? 'Z' : ''}`
}

const decodeShape = (rings) => rings.map((ring) => decodePoints(ring, true)).join('')

const worldSources = {
  low: () => import('./map-world-110m.js'),
  medium: () => import('./map-world-50m.js'),
  high: () => import('./map-world-50m.js'),
}

const roadLayers = (roads) => {
  const layers = new Map()
  for (const [kind, minZoom, line] of roads) {
    const key = `${kind}:${minZoom}`
    const layer = layers.get(key) ?? { kind: ROAD_KINDS[kind], minZoom, d: '' }
    layer.d += decodePoints(line, false)
    layers.set(key, layer)
  }
  return [...layers.values()]
}

const drawings = new Map()

const loadDrawing = (detail) => {
  const cached = drawings.get(detail)
  if (cached) return cached
  const loading = Promise.all([
    worldSources[detail](),
    detail === 'high' ? import('./map-roads-10m.js') : null,
  ]).then(([world, roads]) => ({
    grid: world.WORLD_GRID,
    countries: world.worldCountries.map(decodeShape),
    lakes: world.worldLakes.map(decodeShape),
    places: world.worldPlaces,
    roads: roads === null ? [] : roadLayers(roads.worldRoads),
  }))
  drawings.set(detail, loading)
  return loading
}

const svgNode = (name, attributes) => {
  const node = document.createElementNS(SVG_NAMESPACE, name)
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value)
  return node
}

const worldNode = () =>
  svgNode('svg', { class: 'world', preserveAspectRatio: 'none', 'aria-hidden': 'true' })

const drawWorld = (world, { grid, countries, lakes, roads }) => {
  world.setAttribute('viewBox', `0 0 ${grid} ${grid}`)
  for (const d of countries) world.append(svgNode('path', { class: 'land', d }))
  for (const d of lakes) world.append(svgNode('path', { class: 'lake', d }))
  return roads.map(({ kind, minZoom, d }) => {
    const node = svgNode('path', { class: `road ${kind}`, d, hidden: '' })
    world.append(node)
    return { node, minZoom }
  })
}

const toWorld = ([latitude, longitude]) => {
  const radians = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180
  return {
    x: clamp((longitude + 180) / 360, 0, 1),
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2,
  }
}

const toCoordinates = ({ x, y }) => {
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI
  return [Number(latitude.toFixed(5)), Number((x * 360 - 180).toFixed(5))]
}

const isCoordinates = (value) =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)

const round = (value) => Number(value.toFixed(2))

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the markers as 'pins'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it is the accessible name of the map`)
    }
    const detail = oneOf(NAME, 'detail', props.detail, DETAILS, 'low')
    let maxZoom = DEFAULT_MAX_ZOOM
    if (props.maxZoom !== undefined) {
      if (Number.isFinite(props.maxZoom) && props.maxZoom >= 0) maxZoom = props.maxZoom
      else impLogger.warn(`${NAME}: 'maxZoom' must be a number of 0 or more - using ${maxZoom}`)
    }

    const view = { x: 0.5, y: 0.5, zoom: 0 }
    const home = { x: 0.5, y: 0.5, zoom: 0 }
    const box = { width: 0, height: 0 }
    let placedSize = -1
    let committed = { center: null, zoom: null }
    const pinEntries = []

    const world = worldNode()
    const places = div({ class: 'places', 'aria-hidden': 'true' })
    const placeEntries = []
    const roadEntries = []
    const pins = div({ class: 'pins' })
    const canvas = div({ class: 'canvas' }, world, places, pins)
    const viewport = div(
      { class: 'viewport', role: 'application', tabindex: '0' },
      canvas,
    )
    const zoomInLabel = translatedLabel(self, 'imp.map.zoomIn')
    const zoomOutLabel = translatedLabel(self, 'imp.map.zoomOut')
    const controls = div(
      { class: 'controls' },
      button({
        square: true,
        size: 'sm',
        label: zoomInLabel,
        events: { click: () => zoomBy(1) },
      }, icon(luPlus)),
      button({
        square: true,
        size: 'sm',
        label: zoomOutLabel,
        events: { click: () => zoomBy(-1) },
      }, icon(luMinus)),
    )
    const root = div(
      { class: 'root', events: ownEvents(props.events, [MOVE_EVENT, SELECT_EVENT]) },
      viewport,
      controls,
    )

    const worldSize = () => Math.max(box.width, box.height) * 2 ** view.zoom

    const position = (node, size, x, y) => {
      node.style.setProperty('--x', `${x * size}px`)
      node.style.setProperty('--y', `${y * size}px`)
    }

    const placeAll = (size) => {
      const standardZoom = Math.log2(size / TILE_SIZE)
      for (const entry of roadEntries) {
        entry.node.toggleAttribute('hidden', standardZoom < entry.minZoom)
      }
      for (const entry of placeEntries) {
        entry.node.hidden = standardZoom + PLACE_ZOOM_BIAS < entry.minZoom
        if (!entry.node.hidden) position(entry.node, size, entry.x, entry.y)
      }
      for (const entry of pinEntries) position(entry.node, size, entry.x, entry.y)
    }

    loadDrawing(detail).then((data) => {
      if (self.abortSignal.aborted) return
      roadEntries.push(...drawWorld(world, data))
      for (const [name, x, y, minZoom] of data.places) {
        const node = span({ class: 'place', hidden: true }, name)
        places.append(node)
        placeEntries.push({ node, x: x / data.grid, y: y / data.grid, minZoom })
      }
      if (placedSize > 0) placeAll(placedSize)
    })

    const render = () => {
      const size = worldSize()
      if (size === 0) return
      view.zoom = clamp(view.zoom, 0, maxZoom)
      const halfWidth = box.width / 2 / size
      const halfHeight = box.height / 2 / size
      view.x = clamp(view.x, halfWidth, 1 - halfWidth)
      view.y = clamp(view.y, halfHeight, 1 - halfHeight)
      const shiftX = box.width / 2 - view.x * size
      const shiftY = box.height / 2 - view.y * size
      world.style.inlineSize = `${size}px`
      world.style.blockSize = `${size}px`
      for (const layer of [world, places, pins]) {
        layer.style.transform = `translate(${shiftX}px, ${shiftY}px)`
      }
      if (size !== placedSize) {
        placedSize = size
        placeAll(size)
      }
    }

    const measure = () => {
      const rect = viewport.getBoundingClientRect()
      box.width = rect.width
      box.height = rect.height
    }

    const report = (name, detail) => {
      root.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }))
    }

    const commit = () => {
      const center = toCoordinates(view)
      const zoom = round(view.zoom)
      committed = { center, zoom }
      if (typeof props.center?.set === 'function') props.center.set(center)
      if (typeof props.zoom?.set === 'function') props.zoom.set(zoom)
      report(MOVE_EVENT, { center, zoom })
    }

    const pointOf = (event) => {
      const rect = viewport.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const zoomAt = (point, zoom) => {
      const size = worldSize()
      if (size === 0) return
      const anchorX = view.x + (point.x - box.width / 2) / size
      const anchorY = view.y + (point.y - box.height / 2) / size
      view.zoom = clamp(zoom, 0, maxZoom)
      const next = worldSize()
      view.x = anchorX - (point.x - box.width / 2) / next
      view.y = anchorY - (point.y - box.height / 2) / next
      render()
    }

    const zoomBy = (delta) => {
      zoomAt({ x: box.width / 2, y: box.height / 2 }, view.zoom + delta)
      commit()
    }

    const panBy = (dx, dy) => {
      const size = worldSize()
      if (size === 0) return
      view.x -= dx / size
      view.y -= dy / size
      render()
    }

    const pointers = new Map()
    let gesture = null

    const startGesture = () => {
      const [first, second] = [...pointers.values()]
      if (!second) {
        gesture = { x: first.x, y: first.y }
        return
      }
      const size = worldSize()
      const midX = (first.x + second.x) / 2
      const midY = (first.y + second.y) / 2
      gesture = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        zoom: view.zoom,
        anchorX: view.x + (midX - box.width / 2) / size,
        anchorY: view.y + (midY - box.height / 2) / size,
      }
    }

    const moveGesture = () => {
      const [first, second] = [...pointers.values()]
      if (!second) {
        panBy(first.x - gesture.x, first.y - gesture.y)
        gesture = { x: first.x, y: first.y }
        return
      }
      const distance = Math.hypot(second.x - first.x, second.y - first.y)
      view.zoom = clamp(gesture.zoom + Math.log2(distance / gesture.distance), 0, maxZoom)
      const size = worldSize()
      const midX = (first.x + second.x) / 2
      const midY = (first.y + second.y) / 2
      view.x = gesture.anchorX - (midX - box.width / 2) / size
      view.y = gesture.anchorY - (midY - box.height / 2) / size
      render()
    }

    const listen = (type, handler, options) => {
      viewport.addEventListener(type, handler, { ...options, signal: self.abortSignal })
    }

    listen('pointerdown', (event) => {
      if (event.button !== 0 || pins.contains(event.target)) return
      viewport.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, pointOf(event))
      viewport.classList.add('dragging')
      startGesture()
    })
    listen('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, pointOf(event))
      moveGesture()
    })
    const endPointer = (event) => {
      if (!pointers.has(event.pointerId)) return
      pointers.delete(event.pointerId)
      if (pointers.size > 0) return startGesture()
      viewport.classList.remove('dragging')
      commit()
    }
    listen('pointerup', endPointer)
    listen('pointercancel', endPointer)
    listen('wheel', (event) => {
      event.preventDefault()
      const pixels = event.deltaMode === 0 ? event.deltaY : event.deltaY * 40
      const notches = clamp(-pixels / 100, -1, 1)
      zoomAt(pointOf(event), view.zoom + notches * WHEEL_ZOOM_PER_NOTCH)
      commit()
    }, { passive: false })
    listen('keydown', (event) => {
      if (event.target !== viewport) return
      const panX = box.width * KEY_PAN_FRACTION
      const panY = box.height * KEY_PAN_FRACTION
      const actions = {
        ArrowLeft: () => panBy(panX, 0),
        ArrowRight: () => panBy(-panX, 0),
        ArrowUp: () => panBy(0, panY),
        ArrowDown: () => panBy(0, -panY),
        '+': () => zoomAt({ x: box.width / 2, y: box.height / 2 }, view.zoom + 1),
        '=': () => zoomAt({ x: box.width / 2, y: box.height / 2 }, view.zoom + 1),
        '-': () => zoomAt({ x: box.width / 2, y: box.height / 2 }, view.zoom - 1),
        Home: () => {
          Object.assign(view, home)
          render()
        },
      }
      const action = actions[event.key]
      if (!action) return
      event.preventDefault()
      action()
      commit()
    })

    const direction = () => getComputedStyle(self.host).direction

    const markerOf = (pin) =>
      el('button', {
        type: 'button',
        class: 'marker',
        'aria-label': String(pin.label ?? pin.id),
        events: { click: () => report(SELECT_EVENT, { id: pin.id, pin }) },
      })

    const renderPins = (list) => {
      pinEntries.length = 0
      pins.replaceChildren()
      if (list === undefined || list === null) return
      if (!Array.isArray(list)) {
        impLogger.warn(`${NAME}: 'pins' must be an array of { id, lat, lng } - showing none`)
        return
      }
      const dir = direction()
      list.forEach((pin, index) => {
        if (!pin || typeof pin !== 'object' || !isCoordinates([pin.lat, pin.lng])) {
          impLogger.warn(`${NAME}: pin ${index} needs a numeric 'lat' and 'lng' - skipping it`)
          return
        }
        const id = pin.id ?? index
        const anchor = oneOf(NAME, 'anchor', pin.anchor, ANCHORS, 'center')
        if (pin.content !== undefined && !(pin.content instanceof Node)) {
          impLogger.warn(`${NAME}: 'content' of pin '${id}' must be a node - using a marker`)
        }
        const content = pin.content instanceof Node ? pin.content : markerOf({ ...pin, id })
        const node = div({ class: ['pin', `anchor-${anchor}`], dir }, content)
        pins.append(node)
        pinEntries.push({ node, ...toWorld([pin.lat, pin.lng]) })
      })
      if (placedSize > 0) placeAll(placedSize)
    }

    const sameCenter = (value) =>
      committed.center !== null && value[0] === committed.center[0] &&
      value[1] === committed.center[1]

    bindValue(self, props.label, (value) => {
      viewport.setAttribute('aria-label', value === undefined ? '' : String(value))
    })
    bindValue(self, props.center, (value) => {
      if (value === undefined || value === null || sameCenter(value)) return
      if (!isCoordinates(value)) {
        impLogger.warn(`${NAME}: 'center' must be [latitude, longitude] - ignoring it`)
        return
      }
      Object.assign(view, toWorld(value))
      Object.assign(home, { x: view.x, y: view.y })
      render()
    })
    bindValue(self, props.zoom, (value) => {
      if (value === undefined || value === null || value === committed.zoom) return
      if (!Number.isFinite(value)) {
        impLogger.warn(`${NAME}: 'zoom' must be a number - ignoring it`)
        return
      }
      view.zoom = clamp(value, 0, maxZoom)
      home.zoom = view.zoom
      render()
    })
    bindValue(self, props.pins, renderPins)
    lang.watch(self, () => {
      const dir = direction()
      for (const entry of pinEntries) entry.node.dir = dir
    })

    const observer = new ResizeObserver(() => {
      measure()
      render()
    })
    observer.observe(viewport)
    stopOnRemove(self, () => observer.disconnect())
    requestAnimationFrame(() => {
      measure()
      render()
    })

    return root
  },
}

export const map = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
