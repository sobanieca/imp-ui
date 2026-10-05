import { focusRing, fontFamily, hiddenRule, token, visuallyHidden } from '../shared/css.js'

const dataEndRadius = () => `min(${token('radius-item')}, 4px)`

const hatch = (angle, line, gap) =>
  `repeating-linear-gradient(${angle}deg, CanvasText 0 ${line}px, transparent ${line}px ${gap}px)`

const forcedColorRules = () => `
  @media (forced-colors: active) {
    .bar, .key, .dot {
      forced-color-adjust: none;
      border: 1px solid CanvasText !important;
      background-color: Canvas;
    }

    .pattern-0 { background-color: CanvasText }
    .pattern-1 { background-image: ${hatch(45, 2, 6)} }
    .pattern-3 { background-image: ${hatch(135, 2, 6)} }
    .pattern-4 { background-image: ${hatch(45, 1, 5)}, ${hatch(135, 1, 5)} }
    .pattern-5 { background-image: ${hatch(45, 1, 3)} }

    .line {
      forced-color-adjust: none;
      stroke: CanvasText;
    }

    .line.pattern-1 { stroke-dasharray: 6 4 }
    .line.pattern-2 { stroke-dasharray: 1 5 }
    .line.pattern-3 { stroke-dasharray: 10 4 1 4 }
    .line.pattern-4 { stroke-dasharray: 14 6 }
    .line.pattern-5 { stroke-dasharray: 3 3 }

    .grid-line { border-color: GrayText }
    .grid-line.zero { border-color: CanvasText }
    .band.active { outline: 1px solid Highlight }
    .readout { border-color: CanvasText }
  }
`

export const chartStyles = () => `
  :host {
    display: block;
  }

  .root {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    margin: 0;
    min-inline-size: 0;
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    color: ${token('color-secondary')};
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space-1')} ${token('space-4')};
    margin: 0;
    padding: 0;
    list-style: none;
    color: ${token('color-text')};
  }

  .legend li {
    display: inline-flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .key {
    flex: none;
    box-sizing: border-box;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: 2px;
    background-color: var(--series-color);
  }

  .key-line {
    flex: none;
    inline-size: 1.25rem;
    block-size: 0.5rem;
    overflow: visible;
  }

  .frame {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: var(--imp-chart-block-size, 16rem) auto;
    column-gap: ${token('space-2')};
    row-gap: ${token('space-1')};
    padding-block-start: 0.5em;
  }

  .type-bar .frame {
    grid-template-columns: fit-content(40%) minmax(0, 1fr);
    grid-template-rows: var(--imp-chart-block-size, var(--chart-auto-size, 16rem)) auto;
  }

  .values {
    position: relative;
    grid-column: 1;
    grid-row: 1;
    font-variant-numeric: tabular-nums;
  }

  .type-bar .values {
    grid-column: 2;
    grid-row: 2;
    block-size: 1.25em;
  }

  .sizer {
    block-size: 0;
    overflow: hidden;
    visibility: hidden;
    white-space: nowrap;
  }

  .type-bar .sizer {
    display: none;
  }

  .tick-label {
    position: absolute;
    inset-inline-end: 0;
    inset-block-end: var(--at);
    translate: 0 50%;
    line-height: 1;
    white-space: nowrap;
  }

  .type-bar .tick-label {
    display: flex;
    justify-content: center;
    inset-inline-end: auto;
    inset-inline-start: var(--at);
    inset-block-end: auto;
    inset-block-start: 0;
    inline-size: 0;
    translate: none;
    line-height: inherit;
  }

  .type-bar .tick-label:first-of-type { justify-content: flex-start }

  .type-bar .tick-label:last-of-type { justify-content: flex-end }

  .tick-label > span {
    flex: none;
  }

  .plot {
    position: relative;
    grid-column: 2;
    grid-row: 1;
    min-inline-size: 0;
    border-radius: ${token('radius-item')};
  }

  .plot:focus-visible {${focusRing()}}

  .grid-line {
    position: absolute;
    inset-inline: 0;
    inset-block-end: var(--at);
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .type-bar .grid-line {
    inset-inline: var(--at) auto;
    inset-block: 0;
    border-block-start: none;
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .grid-line.zero {
    border-color: ${token('color-secondary')};
  }

  .lines {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .lines:dir(rtl) {
    scale: -1 1;
  }

  .line {
    fill: none;
    stroke: var(--series-color);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .bands {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .type-bar .bands {
    flex-direction: column;
  }

  .band {
    position: relative;
    display: flex;
    flex: 1 1 0;
    justify-content: center;
    gap: 2px;
    box-sizing: border-box;
    min-inline-size: 0;
    min-block-size: 0;
    padding-inline: clamp(1px, calc(12% / var(--band-count, 1)), 1rem);
  }

  .type-bar .band {
    flex-direction: column;
    padding-inline: 0;
    padding-block: 0.25rem;
  }

  .type-line .band {
    padding-inline: 0;
  }

  .band.active {
    background-color: color-mix(in oklab, ${token('color-text')} 7%, transparent);
  }

  .slot {
    position: relative;
    flex: 1 1 0;
    max-inline-size: 1.5rem;
  }

  .type-bar .slot {
    max-inline-size: none;
    max-block-size: 1.5rem;
  }

  .bar {
    position: absolute;
    box-sizing: border-box;
    background-color: var(--series-color);
    background-clip: padding-box;
  }

  .type-column .bar {
    inset-inline: 0;
    inset-block-end: var(--from);
    block-size: var(--size);
    border-start-start-radius: ${dataEndRadius()};
    border-start-end-radius: ${dataEndRadius()};
  }

  .type-column .bar.negative {
    border-radius: 0;
    border-end-start-radius: ${dataEndRadius()};
    border-end-end-radius: ${dataEndRadius()};
  }

  .type-bar .bar {
    inset-block: 0;
    inset-inline-start: var(--from);
    inline-size: var(--size);
    border-start-end-radius: ${dataEndRadius()};
    border-end-end-radius: ${dataEndRadius()};
  }

  .type-bar .bar.negative {
    border-radius: 0;
    border-start-start-radius: ${dataEndRadius()};
    border-end-start-radius: ${dataEndRadius()};
  }

  .type-column.stacked .bar { border-block-start: 2px solid transparent }

  .type-column.stacked .bar.negative {
    border-block-start: none;
    border-block-end: 2px solid transparent;
  }

  .type-bar.stacked .bar { border-inline-end: 2px solid transparent }

  .type-bar.stacked .bar.negative {
    border-inline-end: none;
    border-inline-start: 2px solid transparent;
  }

  .dot {
    position: absolute;
    box-sizing: border-box;
    inset-inline-start: calc(50% - 4px);
    inset-block-end: calc(var(--at) - 4px);
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background-color: var(--series-color);
  }

  .dense .dot { opacity: 0 }

  .dense .band.active .dot { opacity: 1 }

  .categories {
    display: flex;
    grid-column: 2;
    grid-row: 2;
    min-inline-size: 0;
  }

  .type-bar .categories {
    flex-direction: column;
    grid-column: 1;
    grid-row: 1;
  }

  .category {
    flex: 1 1 0;
    min-inline-size: 0;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thinned .category {
    display: flex;
    justify-content: center;
    overflow: visible;
  }

  .thinned .category > span {
    flex: none;
  }

  .type-bar .category {
    display: flex;
    align-items: center;
    min-block-size: 0;
    text-align: start;
  }

  .type-bar .category > span {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .spoken {${visuallyHidden}}

  .readout {
    position: absolute;
    z-index: 1;
    inset-block-start: 0;
    box-sizing: border-box;
    inline-size: max-content;
    max-inline-size: 60%;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    pointer-events: none;
  }

  .readout.after { inset-inline-start: min(calc(var(--band-end) + 4px), 40%) }

  .readout.before { inset-inline-end: min(calc(100% - var(--band-start) + 4px), 40%) }

  .type-bar .readout {
    inset-inline: auto 0;
  }

  .type-bar .readout.after { inset-block-start: var(--band-end) }

  .type-bar .readout.before {
    inset-block-start: auto;
    inset-block-end: calc(100% - var(--band-start));
  }

  .readout-title {
    margin-block-end: ${token('space-1')};
    overflow: hidden;
    color: ${token('color-secondary')};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-row {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
  }

  .readout-name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-value {
    margin-inline-start: ${token('space-3')};
    font-variant-numeric: tabular-nums;
    font-weight: ${token('font-weight-bold')};
  }

  .data {${visuallyHidden}}

  ${hiddenRule}

  ${forcedColorRules()}
`
