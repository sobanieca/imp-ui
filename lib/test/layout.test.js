import { mount } from 'imp'
import { div } from 'imp/html'
import { column, flex } from 'imp/std/layout'
import { beforeEach, expect, spy, test } from 'imp/test'
import { renderedText } from './shadow.js'

const mounted = (host) => {
  mount(document.body, host)
  return host
}

const root = (host) => host.shadowRoot.querySelector('.root')

const classesOf = (host) => root(host).getAttribute('class')

const gapOf = (host) => root(host).style.getPropertyValue('--gap')

const warnings = () => spy(console, 'warn', () => {})

const warned = (warn, text) => warn.calls.some(([first]) => String(first).includes(text))

beforeEach(() => {
  document.body.replaceChildren()
})

test('flex renders a row carrying its children', () => {
  const host = mounted(flex(div('one'), div('two')))
  expect(host.localName).toEqual('imp-flex')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('onetwo')
})

test('flex defaults to left, stretch and no wrapping', () => {
  const classes = classesOf(mounted(flex()))
  expect(classes).toContain('horizontal-left')
  expect(classes).toContain('vertical-stretch')
  expect(classes).not.toContain('wrap')
})

test('flex applies its alignments and wrap as classes', () => {
  const host = mounted(flex({ horizontalAlign: 'justify', verticalAlign: 'center', wrap: true }))
  expect(classesOf(host)).toContain('horizontal-justify')
  expect(classesOf(host)).toContain('vertical-center')
  expect(classesOf(host)).toContain('wrap')
})

test('flex warns and falls back on an alignment outside its list', () => {
  const warn = warnings()
  const host = mounted(flex({ horizontalAlign: 'start', verticalAlign: 'baseline' }))
  expect(classesOf(host)).toContain('horizontal-left')
  expect(classesOf(host)).toContain('vertical-stretch')
  expect(warned(warn, "flex: 'horizontalAlign' must be one of")).toBeTruthy()
  expect(warned(warn, "flex: 'verticalAlign' must be one of")).toBeTruthy()
})

test('flex takes its gap from a spacing step', () => {
  expect(gapOf(mounted(flex({ gap: 5 })))).toEqual(
    'var(--imp-space-5, clamp(1rem, 0.793rem + 0.884vw, 1.5rem))',
  )
  expect(gapOf(mounted(flex({ gap: 0 })))).toEqual('0px')
})

test('flex leaves the default gap in the stylesheet when none is passed', () => {
  expect(gapOf(mounted(flex()))).toEqual('')
})

test('flex warns and falls back to step 3 on a gap that is not a step', () => {
  const warn = warnings()
  const host = mounted(flex({ gap: '1rem' }))
  expect(gapOf(host)).toContain('--imp-space-3')
  expect(warned(warn, "flex: 'gap' must be a spacing step")).toBeTruthy()
})

test('flex reports an unknown prop', () => {
  const warn = warnings()
  mounted(flex({ padding: 4 }))
  expect(warned(warn, "flex: unknown prop 'padding'")).toBeTruthy()
})

test('column renders a stack carrying its children', () => {
  const host = mounted(column(div('one'), div('two')))
  expect(host.localName).toEqual('imp-column')
  expect(root(host).localName).toEqual('div')
  expect(renderedText(host)).toEqual('onetwo')
})

test('column defaults to stretching its children across', () => {
  expect(classesOf(mounted(column()))).toContain('horizontal-stretch')
})

test('column applies its alignment as a class', () => {
  expect(classesOf(mounted(column({ horizontalAlign: 'center' })))).toContain('horizontal-center')
})

test('column warns and falls back on an alignment outside its list', () => {
  const warn = warnings()
  const host = mounted(column({ horizontalAlign: 'justify' }))
  expect(classesOf(host)).toContain('horizontal-stretch')
  expect(warned(warn, "column: 'horizontalAlign' must be one of")).toBeTruthy()
})

test('column takes its gap from a spacing step', () => {
  expect(gapOf(mounted(column({ gap: 2 })))).toEqual('var(--imp-space-2, 8px)')
})

test('column has no vertical alignment prop', () => {
  const warn = warnings()
  mounted(column({ verticalAlign: 'top' }))
  expect(warned(warn, "column: unknown prop 'verticalAlign'")).toBeTruthy()
})
