import { defineComponent } from '../shared/define.js'
import { blockStep, inlineStep } from '../shared/roving.js'
import { caption, div, li, span, table, tbody, td, th, thead, tr, ul } from '../../api/html.js'
import { lang } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindText, bindValue, oneOf } from '../shared/args.js'
import { token } from '../shared/css.js'
import { buildModel } from './chart-model.js'
import { chartStyles } from './chart-styles.js'
import { activeLocale } from './locale.js'

const NAME = 'chart'

const TYPES = ['column', 'bar', 'line']

const KNOWN_PROPS = ['type', 'label', 'labels', 'series', 'stacked', 'legend', 'format']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const MAX_CATEGORY_LABELS = 12

const DENSE_POINT_COUNT = 24

const BAND_ROW_SIZE = 1.25

const percent = (value) => `${Number(value.toPrecision(12))}%`

const svgNode = (name, attributes) => {
  const node = document.createElementNS(SVG_NAMESPACE, name)
  for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value)
  return node
}

const seriesColor = (name) =>
  `color-mix(in oklab, ${token(`color-${name}`)} 88%, ${token('color-text')})`

const colorStyle = ({ color }) => ({ '--series-color': seriesColor(color) })

const linePath = (marks) => {
  const commands = []
  let drawing = false
  for (const [index, mark] of marks.entries()) {
    if (mark === null) {
      drawing = false
      continue
    }
    const across = Number(((index + 0.5) / marks.length * 100).toPrecision(12))
    commands.push(`${drawing ? 'L' : 'M'}${across} ${Number((100 - mark.at).toPrecision(12))}`)
    drawing = true
  }
  return commands.join(' ')
}

const lineKey = (entry) => {
  const key = svgNode('svg', { class: 'key-line', viewBox: '0 0 20 8', 'aria-hidden': 'true' })
  const stroke = svgNode('path', { class: `line pattern-${entry.pattern}`, d: 'M1 4 L19 4' })
  stroke.style.setProperty('--series-color', seriesColor(entry.color))
  key.append(stroke)
  return key
}

const seriesKey = (type, entry) =>
  type === 'line'
    ? lineKey(entry)
    : span({ class: ['key', `pattern-${entry.pattern}`], style: colorStyle(entry) })

const barOf = (entry, mark) =>
  div({
    class: ['bar', `pattern-${entry.pattern}`, mark.negative ? 'negative' : null],
    style: { ...colorStyle(entry), '--from': percent(mark.from), '--size': percent(mark.size) },
  })

const dotOf = (entry, mark) =>
  div({
    class: ['dot', `pattern-${entry.pattern}`],
    style: { ...colorStyle(entry), '--at': percent(mark.at) },
  })

const marksOfBand = (model, index) =>
  model.series.flatMap((entry, seriesIndex) => {
    const mark = model.marks[seriesIndex][index]
    return mark === null ? [] : [{ entry, mark }]
  })

const bandContent = (type, stacked, model, index) => {
  const drawn = marksOfBand(model, index)
  if (type === 'line') return drawn.map(({ entry, mark }) => dotOf(entry, mark))
  if (stacked) {
    return [div({ class: 'slot' }, ...drawn.map(({ entry, mark }) => barOf(entry, mark)))]
  }
  return model.series.map((entry, seriesIndex) => {
    const mark = model.marks[seriesIndex][index]
    return div({ class: 'slot' }, mark === null ? null : barOf(entry, mark))
  })
}

const numberFormatter = (custom) => {
  if (typeof custom === 'function') return (value) => String(custom(value))
  const numbers = new Intl.NumberFormat(activeLocale())
  return (value) => numbers.format(value)
}

const definition = {
  styles: chartStyles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the data as 'labels' and 'series'`)
    }
    const type = oneOf(NAME, 'type', props.type, TYPES, 'column')
    if (props.stacked && type === 'line') {
      impLogger.warn(`${NAME}: 'stacked' needs type 'column' or 'bar' - ignoring it`)
    }
    const stacked = Boolean(props.stacked) && type !== 'line'
    if (props.label === undefined) {
      impLogger.warn(`${NAME}: pass a 'label' - it is the accessible name of the chart`)
    }
    if (props.format !== undefined && typeof props.format !== 'function') {
      impLogger.warn(`${NAME}: 'format' must be a function like (value) => \`\${value} %\``)
    }

    const legend = ul({ class: 'legend' })
    const values = div({ class: 'values', 'aria-hidden': 'true' })
    const gridLines = div({ class: 'grid-lines' })
    const lines = svgNode('svg', {
      class: 'lines',
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
    })
    const bands = div({ class: 'bands' })
    const readout = div({ class: 'readout', 'aria-hidden': 'true', hidden: true })
    const plot = div(
      { class: 'plot', role: 'img', tabindex: '0' },
      gridLines,
      type === 'line' ? lines : null,
      bands,
      readout,
    )
    const spoken = div({ class: 'spoken', role: 'status' })
    const categories = div({ class: 'categories', 'aria-hidden': 'true' })
    const dataCaption = caption(bindText(self, props.label))
    const dataTable = table()
    const root = div(
      { class: ['root', `type-${type}`, stacked ? 'stacked' : null] },
      legend,
      div({ class: 'frame' }, values, plot, categories),
      spoken,
      dataTable,
    )

    const current = { labels: [], series: [] }
    let model = buildModel({ type, stacked, labels: [], series: [] })
    let format = numberFormatter(props.format)
    let active = null
    let ready = false

    const paintActive = () => {
      const count = model.labels.length
      for (const [index, band] of [...bands.children].entries()) {
        band.classList.toggle('active', index === active)
      }
      if (active === null || active >= count) {
        readout.hidden = true
        spoken.textContent = ''
        return
      }
      spoken.textContent = [
        model.labels[active],
        ...marksOfBand(model, active).map(({ entry, mark }) =>
          `${entry.name} ${format(mark.value)}`
        ),
      ].join(', ')
      readout.hidden = false
      readout.classList.toggle('after', active < count / 2)
      readout.classList.toggle('before', active >= count / 2)
      readout.style.setProperty('--band-start', percent(active / count * 100))
      readout.style.setProperty('--band-end', percent((active + 1) / count * 100))
      readout.replaceChildren(
        div({ class: 'readout-title' }, model.labels[active]),
        ...marksOfBand(model, active).map(({ entry, mark }) =>
          div(
            { class: 'readout-row' },
            seriesKey(type, entry),
            span({ class: 'readout-name' }, entry.name),
            span({ class: 'readout-value' }, format(mark.value)),
          )
        ),
      )
    }

    const show = (index) => {
      active = index
      paintActive()
    }

    const drawAxes = () => {
      values.replaceChildren(
        ...model.ticks.map(({ value }) => div({ class: 'sizer' }, format(value))),
        ...model.ticks.map(({ value, at }) =>
          span({ class: 'tick-label', style: { '--at': percent(at) } }, span(format(value)))
        ),
      )
      gridLines.replaceChildren(
        ...model.ticks.map(({ value, at }) =>
          div({ class: ['grid-line', value === 0 ? 'zero' : null], style: { '--at': percent(at) } })
        ),
      )
      const every = type === 'bar' ? 1 : Math.ceil(model.labels.length / MAX_CATEGORY_LABELS)
      categories.classList.toggle('thinned', every > 1)
      categories.replaceChildren(
        ...model.labels.map((text, index) =>
          div({ class: 'category', title: text }, index % every === 0 ? span(text) : null)
        ),
      )
    }

    const drawMarks = () => {
      if (type === 'line') {
        lines.replaceChildren(
          ...model.series.map((entry, seriesIndex) => {
            const path = svgNode('path', {
              class: `line pattern-${entry.pattern}`,
              d: linePath(model.marks[seriesIndex]),
            })
            path.style.setProperty('--series-color', seriesColor(entry.color))
            return path
          }),
        )
      }
      bands.replaceChildren(
        ...model.labels.map((_, index) =>
          div(
            { class: 'band', events: { pointerenter: () => show(index) } },
            ...bandContent(type, stacked, model, index),
          )
        ),
      )
    }

    const drawLegend = () => {
      const shown = props.legend === undefined ? model.series.length > 1 : Boolean(props.legend)
      legend.hidden = !shown
      legend.replaceChildren(
        ...model.series.map((entry) => li(seriesKey(type, entry), span(entry.name))),
      )
    }

    const drawTable = () => {
      dataTable.replaceChildren(
        dataCaption,
        thead(tr(td(), ...model.series.map((entry) => th({ scope: 'col' }, entry.name)))),
        tbody(
          ...model.labels.map((text, index) =>
            tr(
              th({ scope: 'row' }, text),
              ...model.series.map(({ values: numbers }) =>
                td(numbers[index] === null ? '' : format(numbers[index]))
              ),
            )
          ),
        ),
      )
    }

    const draw = () => {
      if (!ready) return
      model = buildModel({ type, stacked, ...current })
      format = numberFormatter(props.format)
      const rowSize = (stacked ? 1 : Math.max(1, model.series.length)) * BAND_ROW_SIZE + 1
      root.style.setProperty('--chart-auto-size', `${model.labels.length * rowSize}rem`)
      root.classList.toggle('dense', model.labels.length > DENSE_POINT_COUNT)
      drawLegend()
      drawAxes()
      drawMarks()
      drawTable()
      if (active !== null && active >= model.labels.length) active = null
      paintActive()
    }

    bindValue(self, props.labels ?? [], (value) => {
      current.labels = value
      draw()
    })
    bindValue(self, props.series ?? [], (value) => {
      current.series = value
      draw()
    })
    bindValue(self, props.label, (value) => {
      if (value === undefined || value === null) plot.removeAttribute('aria-label')
      else plot.setAttribute('aria-label', String(value))
    })
    lang.watch(self, draw)
    ready = true
    draw()

    const move = (step) => {
      const count = model.labels.length
      if (count === 0) return
      const from = active ?? (step > 0 ? -1 : count)
      show(Math.min(count - 1, Math.max(0, from + step)))
    }

    plot.addEventListener('pointerleave', () => show(null))
    plot.addEventListener('blur', () => show(null))
    plot.addEventListener('focus', () => {
      if (active === null && model.labels.length > 0) show(0)
    })
    plot.addEventListener('keydown', (event) => {
      const step = type === 'bar' ? blockStep(event.key) : inlineStep(event.key, plot)
      if (step !== 0) move(step)
      else if (event.key === 'Home') show(model.labels.length > 0 ? 0 : null)
      else if (event.key === 'End') show(model.labels.length > 0 ? model.labels.length - 1 : null)
      else if (event.key === 'Escape') return show(null)
      else return
      event.preventDefault()
    })
    return root
  },
}

export const chart = (...args) => defineComponent(NAME, () => definition)(...args)
