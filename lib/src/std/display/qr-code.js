import { defineComponent } from '../shared/define.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { SIZES } from '../shared/css.js'
import { EC_LEVELS, encodeQr } from './qr-encode.js'

const NAME = 'qrCode'

const KNOWN_PROPS = ['value', 'label', 'errorCorrection', 'size']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const QUIET_ZONE = 4

const LABEL_KEY = 'imp.qrCode.label'

const messages = { [LABEL_KEY]: 'QR code' }

const styles = () => `
  :host {
    display: inline-block;
    line-height: 0;
  }

  svg {
    display: block;
    block-size: auto;
    shape-rendering: crispEdges;
    forced-color-adjust: none;
  }

  svg[hidden] { display: none }

  .size-sm { inline-size: 6rem }

  .size-md { inline-size: 10rem }

  .size-lg { inline-size: 16rem }

  .ground { fill: #ffffff }

  .modules { fill: #111111 }
`

const svgNode = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NAMESPACE, name)
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value)
  return node
}

const darkRuns = (row) => {
  const runs = []
  let x = 0
  while (x < row.length) {
    if (!row[x]) {
      x++
      continue
    }
    const start = x
    while (x < row.length && row[x]) x++
    runs.push({ start, length: x - start })
  }
  return runs
}

const modulePath = ({ modules }) => {
  const parts = []
  let previous = null
  modules.forEach((row, y) => {
    for (const { start, length } of darkRuns(row)) {
      parts.push(
        previous === null
          ? `M${start + QUIET_ZONE} ${y + QUIET_ZONE}`
          : `m${start - previous.x} ${y - previous.y}`,
        `h${length}v1h-${length}z`,
      )
      previous = { x: start, y }
    }
  })
  return parts.join('')
}

const paint = (svg, ground, path, value, level) => {
  const text = value === null || value === undefined ? '' : String(value)
  const code = text === '' ? null : encodeQr(text, { level })
  if (text !== '' && code === null) {
    impLogger.warn(
      `${NAME}: the value is too long for a QR code at error correction '${level}' - `
        + 'use a shorter value, such as a link, or a lower level',
    )
  }
  svg.toggleAttribute('hidden', code === null)
  if (code === null) {
    path.setAttribute('d', '')
    return
  }
  const side = code.size + QUIET_ZONE * 2
  svg.setAttribute('viewBox', `0 0 ${side} ${side}`)
  ground.setAttribute('width', String(side))
  ground.setAttribute('height', String(side))
  path.setAttribute('d', modulePath(code))
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the text to encode as 'value'`)
    }
    if (props.value === undefined) {
      impLogger.warn(`${NAME}: needs a 'value' - it is the text that the code holds`)
    }
    const level = oneOf(NAME, 'errorCorrection', props.errorCorrection, EC_LEVELS, 'M')
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const svg = svgNode('svg', { class: `size-${size}`, role: 'img' })
    const ground = svgNode('rect', { class: 'ground' })
    const path = svgNode('path', { class: 'modules' })
    svg.append(ground, path)
    bindValue(self, props.value, (value) => paint(svg, ground, path, value, level))
    if (props.label === undefined) {
      lang.watch(self, () => svg.setAttribute('aria-label', t(LABEL_KEY)))
    } else {
      bindValue(self, props.label, (value) => svg.setAttribute('aria-label', String(value)))
    }
    return svg
  },
}

export const qrCode = (...args) =>
  defineComponent(
    NAME,
    () => definition,
    () => defaultMessages(messages),
  )(...args)
