import { component } from 'imp'
import { div } from 'imp/html'
import { codeBlock } from 'imp/std/display'
import { MAIN_1, MAIN_2, MAIN_3 } from '../../lib/src/std/preview-look.js'
import { GEOMETRY_SQUARES, geometryStyles, markdownStyles } from './design-styles.js'

export { MAIN_1, MAIN_2, MAIN_3, markdownStyles }
const BARS_STYLES = `
  :host {
    display: block;
    position: relative;
    pointer-events: none;
  }

  .bars {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 6px;
    display: flex;
    gap: 6px;
  }

  .bar { inline-size: 10px }

  .main-1 {
    inline-size: 14px;
    background: ${MAIN_1};
  }

  .main-2 { background: ${MAIN_2} }
  .main-3 { background: ${MAIN_3} }
`

const geometrySquare = ({ tone, column, row, span = 1 }) =>
  div({ class: `square ${tone}`, style: `--column: ${column}; --row: ${row}; --span: ${span}` })

const geometryDefinition = {
  styles: geometryStyles(),
  setup: () =>
    div({ class: 'geometry' }, div({ class: 'grid' }), ...GEOMETRY_SQUARES.map(geometrySquare)),
}

const barsDefinition = {
  styles: BARS_STYLES,
  setup: () =>
    div(
      { class: 'bars' },
      div({ class: 'bar main-1' }),
      div({ class: 'bar main-2' }),
      div({ class: 'bar main-3' }),
    ),
}

export const swapCodeBlocks = (root) => {
  for (const block of root.querySelectorAll('pre > code')) {
    const language = block.className.match(/language-(\S+)/)?.[1]
    block.parentElement.replaceWith(codeBlock({ language, code: block.textContent }))
  }
  return root
}

export const markdownBody = (html, extraClass = null) => {
  const body = div({ class: extraClass === null ? 'md' : `md ${extraClass}` })
  body.innerHTML = html
  return swapCodeBlocks(body)
}

let createGeometry = null
let createBars = null

export const geometry = () => {
  createGeometry ??= component('imp-design-geometry', geometryDefinition)
  return createGeometry()
}

export const brandBars = () => {
  createBars ??= component('imp-design-bars', barsDefinition)
  return createBars()
}
