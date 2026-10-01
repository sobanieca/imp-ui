import { MAIN_1, MAIN_2, MAIN_3 } from '../../lib/src/std/preview-look.js'

const INK = 'var(--imp-color-text, #101010)'

const CELL = 'var(--cell)'

const FLUID_CELL = 'round(clamp(16px, 10px + 1.524dvi, 32px), 4px)'

export const GEOMETRY_SQUARES = [
  { tone: 'ink', column: 0, row: 0, span: 2 },
  { tone: 'main-3', column: 2, row: 0 },
  { tone: 'main-2', column: 2, row: 1 },
  { tone: 'main-1', column: 2, row: 2 },
  { tone: 'outline', column: 0, row: 3 },
  { tone: 'faint', column: 4, row: 1 },
]

export const geometryStyles = (host = ':host') => `
  ${host} {
    display: block;
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .geometry {
    --cell: ${FLUID_CELL};
    position: absolute;
    inset-inline-end: 0;
    inset-block-end: 0;
    inline-size: min(36dvi, 400px);
    block-size: min(38dvb, 320px);
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(${INK} 1px, transparent 1px),
      linear-gradient(90deg, ${INK} 1px, transparent 1px);
    background-size: ${CELL} ${CELL};
    background-position: right bottom;
    mask-image: radial-gradient(
      110% 110% at 100% 100%,
      black 0%,
      rgb(0 0 0 / 55%) 30%,
      transparent 62%
    );
    opacity: 0.16;
  }

  .square {
    box-sizing: border-box;
    position: absolute;
    inset-inline-end: calc(var(--column) * ${CELL});
    inset-block-end: calc(var(--row) * ${CELL});
    inline-size: calc(var(--span, 1) * ${CELL});
    block-size: calc(var(--span, 1) * ${CELL});
  }

  .ink { background: ${INK} }
  .main-1 { background: ${MAIN_1} }
  .main-2 { background: ${MAIN_2} }
  .main-3 { background: ${MAIN_3} }
  .outline { border: 1.5px solid ${INK} }

  .faint {
    background: ${INK};
    opacity: 0.3;
  }

  @media (width < 48rem) {
    .geometry {
      inline-size: 60dvi;
      block-size: 30dvb;
    }
  }
`

export const markdownStyles = `
  .md {
    max-inline-size: 80ch;
    color: var(--imp-color-text, #0f172a);
    font-family: var(--imp-font-family, system-ui, sans-serif);
    font-weight: var(--imp-font-weight-normal, 400);
    font-size: var(--imp-font-size-md, 1rem);
    line-height: var(--imp-line-height-normal, 1.6);
  }

  .md > :first-child {
    margin-block-start: 0;
  }

  .md > :last-child {
    margin-block-end: 0;
  }

  .md h1,
  .md h2,
  .md h3,
  .md h4 {
    margin-block: var(--imp-space-5, 24px) var(--imp-space-3, 12px);
    color: var(--imp-color-heading, var(--imp-color-text, inherit));
    font-weight: var(--imp-font-weight-bold, 600);
    line-height: var(--imp-line-height-tight, 1.25);
  }

  .md h1 {
    font-size: var(--imp-font-size-xl, 1.5rem);
  }

  .md h2 {
    font-size: var(--imp-font-size-lg, 1.25rem);
  }

  .md h3,
  .md h4 {
    font-size: var(--imp-font-size-md, 1rem);
  }

  .md p,
  .md ul,
  .md ol,
  .md table,
  .md pre,
  .md blockquote {
    margin-block: 0 var(--imp-space-3, 12px);
  }

  .md ul,
  .md ol {
    padding-inline-start: var(--imp-space-5, 24px);
  }

  .md li {
    margin-block-end: var(--imp-space-1, 4px);
  }

  .md a {
    color: var(--imp-color-primary, #2563eb);
  }

  .md code {
    padding-inline: 0.3em;
    border-radius: var(--imp-radius-item, 6px);
    background: var(--imp-color-surface-sunken, #f8fafc);
    font-family: var(--imp-font-family-mono, ui-monospace, monospace);
    font-size: 0.9em;
  }

  .md imp-code-block {
    margin-block: var(--imp-space-3, 12px);
  }

  .md table {
    display: block;
    overflow: auto;
    border-collapse: collapse;
    font-size: var(--imp-font-size-sm, 0.875rem);
  }

  .md th,
  .md td {
    padding-block: var(--imp-space-1, 4px);
    padding-inline: var(--imp-space-2, 8px);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    text-align: start;
    vertical-align: top;
  }

  .md th {
    font-weight: var(--imp-font-weight-bold, 600);
  }

  .md blockquote {
    padding-inline-start: var(--imp-space-3, 12px);
    border-inline-start: 3px solid var(--imp-color-border, #cbd5e1);
    color: var(--imp-color-secondary, #64748b);
  }
`
