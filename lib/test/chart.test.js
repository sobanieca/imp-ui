import { component, mount } from 'imp'
import { chart } from 'imp/std/data'
import { initState } from 'imp/state'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const stateHost = component('chart-state-host', { setup: (self, render) => render(self) })

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const shadow = (host, selector) => host.shadowRoot.querySelector(selector)

const all = (host, selector) => [...host.shadowRoot.querySelectorAll(selector)]

const press = (node, key) =>
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))

const hover = (node) => node.dispatchEvent(new Event('pointerenter'))

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

const custom = (node, name) => node.style.getPropertyValue(name)

const quarters = () => ['Q1', 'Q2', 'Q3', 'Q4']

const revenue = () => [
  { name: 'Product', values: [12, 18, 9, 22], color: 'blue' },
  { name: 'Services', values: [5, 7, 11, 8] },
]

const texts = (host, selector) => all(host, selector).map(renderedText)

beforeEach(() => {
  document.body.replaceChildren()
})

test('chart names the plot as an image and mirrors the data in a table', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  expect(host.localName).toEqual('imp-chart')
  const plot = shadow(host, '.plot')
  expect(plot.getAttribute('role')).toEqual('img')
  expect(plot.getAttribute('aria-label')).toEqual('Revenue')
  expect(plot.tabIndex).toEqual(0)
  expect(renderedText(shadow(host, 'caption'))).toEqual('Revenue')
  expect(texts(host, 'thead th')).toEqual(['Product', 'Services'])
  expect(texts(host, 'tbody th')).toEqual(quarters())
  expect(texts(host, 'tbody tr:first-child td')).toEqual(['12', '5'])
})

test('chart draws grouped columns from a zero baseline with rounded ticks', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  expect(shadow(host, '.root').classList.contains('type-column')).toBeTruthy()
  expect(texts(host, '.tick-label')).toEqual(['0', '5', '10', '15', '20', '25'])
  expect(all(host, '.band').length).toEqual(4)
  expect(all(host, '.band:first-child .slot').length).toEqual(2)
  const [product, services] = all(host, '.band:first-child .bar')
  expect(custom(product, '--from')).toEqual('0%')
  expect(custom(product, '--size')).toEqual('48%')
  expect(custom(services, '--size')).toEqual('20%')
  expect(custom(product, '--series-color')).toContain('--imp-color-blue')
  expect(custom(services, '--series-color')).toContain('--imp-color-orange')
})

test('chart sizes the band padding to one band, so dense columns keep their width', () => {
  const labels = Array.from({ length: 30 }, (_, index) => `T${index}`)
  const values = labels.map((_, index) => index + 1)
  const host = mounted(chart({ label: 'Load', labels, series: [{ name: 'Load', values }] }))
  expect(custom(shadow(host, '.root'), '--band-count')).toEqual('30')
})

test('chart stacks the series of one category in one slot', () => {
  const host = mounted(
    chart({ label: 'Revenue', labels: quarters(), series: revenue(), stacked: true }),
  )
  expect(shadow(host, '.root').classList.contains('stacked')).toBeTruthy()
  expect(all(host, '.band:first-child .slot').length).toEqual(1)
  const [product, services] = all(host, '.band:first-child .bar')
  expect(texts(host, '.tick-label').at(-1)).toEqual('30')
  expect(custom(product, '--from')).toEqual('0%')
  expect(custom(product, '--size')).toEqual('40%')
  expect(custom(services, '--from')).toEqual('40%')
})

test('chart keeps a negative value under the zero line', () => {
  const host = mounted(
    chart({ label: 'Cash', labels: ['a', 'b'], series: [{ name: 'Net', values: [10, -10] }] }),
  )
  const [raised, lowered] = all(host, '.bar')
  expect(texts(host, '.tick-label')).toEqual(['-10', '-5', '0', '5', '10'])
  expect(custom(raised, '--from')).toEqual('50%')
  expect(lowered.classList.contains('negative')).toBeTruthy()
  expect(custom(lowered, '--from')).toEqual('0%')
  expect(custom(lowered, '--size')).toEqual('50%')
  expect(all(host, '.grid-line.zero').length).toEqual(1)
})

test('chart draws a line per series and a dot per point', () => {
  const host = mounted(
    chart({ type: 'line', label: 'Latency', labels: ['a', 'b', 'c'], series: revenue() }),
  )
  const paths = all(host, '.lines path')
  expect(paths.length).toEqual(2)
  expect(paths[0].getAttribute('d').startsWith('M')).toBeTruthy()
  expect(all(host, '.dot').length).toEqual(6)
  expect(all(host, '.bar').length).toEqual(0)
})

test('chart breaks a line at a missing value', () => {
  const host = mounted(
    chart({
      type: 'line',
      label: 'Latency',
      labels: ['a', 'b', 'c', 'd'],
      series: [{ name: 'p50', values: [1, null, 3, 4] }],
    }),
  )
  const moves = shadow(host, '.lines path').getAttribute('d').match(/M/g)
  expect(moves.length).toEqual(2)
  expect(all(host, '.dot').length).toEqual(3)
})

test('chart shows the legend only for more than one series unless told', () => {
  const two = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  expect(shadow(two, '.legend').hidden).toEqual(false)
  expect(texts(two, '.legend li')).toEqual(['Product', 'Services'])
  const one = mounted(chart({ label: 'Revenue', labels: quarters(), series: [revenue()[0]] }))
  expect(shadow(one, '.legend').hidden).toEqual(true)
  const forced = mounted(
    chart({ label: 'Revenue', labels: quarters(), series: [revenue()[0]], legend: true }),
  )
  expect(shadow(forced, '.legend').hidden).toEqual(false)
})

test('chart formats ticks, the readout and the table with format', () => {
  const host = mounted(
    chart({
      label: 'Revenue',
      labels: quarters(),
      series: revenue(),
      format: (value) => `${value}k`,
    }),
  )
  expect(texts(host, '.tick-label').at(1)).toEqual('5k')
  expect(texts(host, 'tbody tr:first-child td')).toEqual(['12k', '5k'])
  hover(all(host, '.band')[1])
  expect(texts(host, '.readout-value')).toEqual(['18k', '7k'])
})

test('chart shows a readout of every series for the hovered category', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  const readout = shadow(host, '.readout')
  expect(readout.hidden).toEqual(true)
  hover(all(host, '.band')[2])
  expect(readout.hidden).toEqual(false)
  expect(readout.getAttribute('aria-hidden')).toEqual('true')
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q3')
  expect(texts(host, '.readout-name')).toEqual(['Product', 'Services'])
  expect(texts(host, '.readout-value')).toEqual(['9', '11'])
  expect(all(host, '.band')[2].classList.contains('active')).toBeTruthy()
  expect(readout.classList.contains('before')).toBeTruthy()
  shadow(host, '.plot').dispatchEvent(new Event('pointerleave'))
  expect(readout.hidden).toEqual(true)
})

test('chart moves the readout with the arrow keys, Home, End and Escape', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  const plot = shadow(host, '.plot')
  const title = () => renderedText(shadow(host, '.readout-title'))
  press(plot, 'ArrowRight')
  expect(title()).toEqual('Q1')
  press(plot, 'ArrowRight')
  expect(title()).toEqual('Q2')
  press(plot, 'ArrowLeft')
  expect(title()).toEqual('Q1')
  press(plot, 'ArrowLeft')
  expect(title()).toEqual('Q1')
  press(plot, 'End')
  expect(title()).toEqual('Q4')
  press(plot, 'Home')
  expect(title()).toEqual('Q1')
  press(plot, 'Escape')
  expect(shadow(host, '.readout').hidden).toEqual(true)
})

test('chart speaks the readout through a status region, because the plot is an image', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  const plot = shadow(host, '.plot')
  const spoken = shadow(host, '.spoken')
  expect(spoken.getAttribute('role')).toEqual('status')
  expect(plot.contains(spoken)).toEqual(false)
  expect(spoken.textContent).toEqual('')
  press(plot, 'ArrowRight')
  expect(spoken.textContent).toContain('Q1')
  expect(spoken.textContent).toContain(revenue()[0].name)
  press(plot, 'Escape')
  expect(spoken.textContent).toEqual('')
})

test('chart shows the first category on focus and hides the readout on blur', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  const plot = shadow(host, '.plot')
  plot.dispatchEvent(new Event('focus'))
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q1')
  plot.dispatchEvent(new Event('blur'))
  expect(shadow(host, '.readout').hidden).toEqual(true)
})

test('chart mirrors the arrow keys in a right-to-left page', () => {
  const host = mounted(chart({ label: 'Revenue', labels: quarters(), series: revenue() }))
  host.style.direction = 'rtl'
  const plot = shadow(host, '.plot')
  press(plot, 'ArrowLeft')
  press(plot, 'ArrowLeft')
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q2')
  press(plot, 'ArrowRight')
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q1')
})

test('chart of type bar moves through its rows with the vertical arrows', () => {
  const host = mounted(
    chart({ type: 'bar', label: 'Tickets', labels: quarters(), series: revenue() }),
  )
  expect(shadow(host, '.root').classList.contains('type-bar')).toBeTruthy()
  const plot = shadow(host, '.plot')
  press(plot, 'ArrowDown')
  press(plot, 'ArrowDown')
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q2')
  press(plot, 'ArrowUp')
  expect(renderedText(shadow(host, '.readout-title'))).toEqual('Q1')
})

test('chart redraws the plot when a series state changes and keeps the plot element', () => {
  let series
  const host = mounted(
    stateHost((self) => {
      series = initState(self, 'test.chart.series', revenue())
      const labels = initState(self, 'test.chart.labels', quarters())
      return chart({ label: 'Revenue', labels, series })
    }),
  )
  const inner = host.shadowRoot.querySelector('imp-chart')
  const plot = shadow(inner, '.plot')
  expect(all(inner, '.bar').length).toEqual(8)
  series.set([{ name: 'Product', values: [100, 200, 300, 400] }])
  expect(all(inner, '.bar').length).toEqual(4)
  expect(texts(inner, '.tick-label').at(-1)).toEqual('400')
  expect(texts(inner, 'tbody tr:first-child td')).toEqual(['100'])
  expect(shadow(inner, '.plot') === plot).toBeTruthy()
  expect(shadow(inner, '.legend').hidden).toEqual(true)
})

test('chart warns about a missing label, an unknown type and stacked lines', () => {
  const warn = warnings()
  mounted(chart({ type: 'pie', labels: quarters(), series: revenue() }))
  expect(warned(warn, "pass a 'label'")).toBeTruthy()
  expect(warned(warn, "'type' must be one of")).toBeTruthy()
  mounted(chart({ type: 'line', stacked: true, label: 'x', labels: quarters(), series: revenue() }))
  expect(warned(warn, "'stacked' needs type 'column' or 'bar'")).toBeTruthy()
})

test('chart warns about values that do not fit the labels or are not numbers', () => {
  const warn = warnings()
  const host = mounted(
    chart({
      label: 'Revenue',
      labels: quarters(),
      series: [{ name: 'Product', values: [1, 'two', 3] }],
    }),
  )
  expect(warned(warn, 'has 3 values for 4 labels')).toBeTruthy()
  expect(warned(warn, "the value 'two' at index 1, which is not a number")).toBeTruthy()
  expect(all(host, '.bar').length).toEqual(2)
})

test('chart warns about a color outside the palette and an unknown prop', () => {
  const warn = warnings()
  mounted(
    chart({
      label: 'Revenue',
      labels: quarters(),
      series: [{ name: 'Product', values: [1, 2, 3, 4], color: '#ff0000' }],
      axis: 'log',
    }),
  )
  expect(warned(warn, "'#ff0000'")).toBeTruthy()
  expect(warned(warn, "unknown prop 'axis'")).toBeTruthy()
})
