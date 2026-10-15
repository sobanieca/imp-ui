import { defineComponent } from '../shared/define.js'
import { div, el, span } from '../../api/html.js'
import { lang } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { colorNames, progressStyles, RATIO } from './progress-css.js'

const NAME = 'progress'

const KNOWN_PROPS = ['label', 'value', 'max', 'shape', 'size', 'color', 'showValue', 'format']

const SHAPES = ['bar', 'ring', 'gauge']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const RING_VIEW = '0 0 36 36'

const GAUGE_VIEW = '0 0 36 20'

const GAUGE_ARC = 'M 2 18 A 16 16 0 0 1 34 18'

const svgNode = (tag, attributes) => {
  const node = document.createElementNS(SVG_NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  return node
}

const strokes = (tag, geometry) =>
  ['track', 'meter'].map((name) => svgNode(tag, { ...geometry, class: name, pathLength: '100' }))

const drawing = (shape) => {
  const svg = svgNode('svg', {
    viewBox: shape === 'gauge' ? GAUGE_VIEW : RING_VIEW,
    'aria-hidden': 'true',
  })
  svg.append(
    ...(shape === 'gauge'
      ? strokes('path', { d: GAUGE_ARC })
      : strokes('circle', { cx: '18', cy: '18', r: '16' })),
  )
  return svg
}

const percent = (value, max) =>
  new Intl.NumberFormat(lang.get(), { style: 'percent', maximumFractionDigits: 0 }).format(
    value / max,
  )

const maxOf = (given) => {
  if (given === undefined || given === null) return 100
  if (typeof given === 'number' && Number.isFinite(given) && given > 0) return given
  impLogger.warn(`${NAME}: 'max' must be a number above 0 - got '${given}', using 100`)
  return 100
}

const amountOf = (given, max) => {
  if (given === undefined || given === null) return 0
  if (typeof given === 'number' && Number.isFinite(given)) return Math.min(Math.max(given, 0), max)
  impLogger.warn(`${NAME}: 'value' must be a number - showing 0`)
  return 0
}

const barParts = (showValue) => {
  const control = el('progress', { class: 'bar' })
  const label = span({ class: 'label', 'aria-hidden': 'true' })
  const value = showValue ? span({ class: 'value', 'aria-hidden': 'true' }) : null
  const head = div({ class: 'head' }, label, value)
  return {
    named: control,
    value,
    nodes: [head, control],
    caption: (words) => {
      label.textContent = words
      head.hidden = words === '' && value === null
    },
    paint: (amount, text) => {
      control.setAttribute('value', String(amount))
      control.setAttribute('aria-valuetext', text)
    },
  }
}

const dialParts = (shape, showValue, max) => {
  const gauge = shape === 'gauge'
  const svg = drawing(shape)
  const value = showValue || gauge ? span({ class: 'value', 'aria-hidden': 'true' }) : null
  const label = gauge ? span({ class: 'caption', 'aria-hidden': 'true' }) : null
  const dial = div(
    {
      class: 'dial',
      role: gauge ? 'meter' : 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': String(max),
    },
    svg,
    value,
  )
  return {
    named: dial,
    value,
    nodes: [dial, label],
    caption: (words) => {
      if (label !== null) label.textContent = words
    },
    paint: (amount, text) => {
      dial.setAttribute('aria-valuenow', String(amount))
      dial.setAttribute('aria-valuetext', text)
      dial.style.setProperty(RATIO, String(amount / max))
    },
  }
}

const definition = {
  styles: progressStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the words as 'label'`)
    }
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it is what names the progress for a screen reader`)
    }
    if (props.value === undefined) {
      impLogger.warn(`${NAME}: pass a 'value' - for a wait with no measure, render 'loader'`)
    }
    const shape = oneOf(NAME, 'shape', props.shape, SHAPES, 'bar')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const color = oneOf(NAME, 'color', props.color, colorNames(), 'primary')
    const max = maxOf(props.max)
    const format = typeof props.format === 'function' ? props.format : percent
    const cramped = shape === 'ring' && size === 'sm' && Boolean(props.showValue)
    if (cramped) {
      impLogger.warn(`${NAME}: a 'sm' ring has no room for the value - use 'md' or 'lg'`)
    }
    const showValue = Boolean(props.showValue) && !cramped
    const parts = shape === 'bar' ? barParts(showValue) : dialParts(shape, showValue, max)
    if (shape === 'bar') parts.named.setAttribute('max', String(max))

    let amount = 0
    const paint = () => {
      const text = String(format(amount, max))
      parts.paint(amount, text)
      if (parts.value !== null) parts.value.textContent = text
    }
    bindValue(self, props.value, (next) => {
      amount = amountOf(next, max)
      paint()
    })
    lang.watch(self, paint)
    bindValue(self, props.label, (next) => {
      const words = next === undefined || next === null ? '' : String(next)
      parts.named.setAttribute('aria-label', words)
      parts.caption(words)
    })

    return div(
      { class: ['root', `shape-${shape}`, `size-${size}`, `color-${color}`] },
      ...parts.nodes,
    )
  },
}

export const progress = (...args) => defineComponent(NAME, () => definition)(...args)
