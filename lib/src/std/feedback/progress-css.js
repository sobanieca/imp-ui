import { paletteNames } from '../../theme-colors.js'
import { fontFamily, token } from '../shared/css.js'
import { spinnerStyles } from '../shared/spinner.js'

const ROLE_COLORS = ['primary', 'success', 'warning', 'danger', 'info']

export const RATIO = '--progress-ratio'

let names = null

export const colorNames = () => (names ??= [...ROLE_COLORS, ...paletteNames()])

const colorRules = () =>
  colorNames()
    .map((name) => `  .color-${name} { --progress-color: ${token(`color-${name}`)} }`)
    .join('\n')

export const progressStyles = () => `
  .root {
    --progress-track: color-mix(in oklab, var(--progress-color) 20%, transparent);
    box-sizing: border-box;
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

${colorRules()}

  .shape-bar {
    display: flex;
    flex-direction: column;
    gap: ${token('space-1')};
    min-inline-size: 6rem;
  }

  .shape-bar.size-sm { --progress-thickness: 4px }
  .shape-bar.size-md { --progress-thickness: 8px }
  .shape-bar.size-lg { --progress-thickness: 12px; font-size: ${token('font-size-md')} }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: ${token('space-3')};
  }

  .value {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    unicode-bidi: plaintext;
  }

  .head .value {
    margin-inline-start: auto;
    color: ${token('color-secondary')};
  }

  .bar {
    appearance: none;
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: var(--progress-thickness);
    border: none;
    border-radius: var(--progress-thickness);
    overflow: hidden;
    background-color: var(--progress-track);
    color: var(--progress-color);
  }

  .bar::-webkit-progress-bar {
    background-color: transparent;
  }

  .bar::-webkit-progress-value {
    border-radius: var(--progress-thickness);
    background-color: var(--progress-color);
    transition: inline-size ${token('duration-medium')} ease-out;
  }

  .bar::-moz-progress-bar {
    border-radius: var(--progress-thickness);
    background-color: var(--progress-color);
  }

  .bar:indeterminate {
    background-image: linear-gradient(var(--progress-color), var(--progress-color));
    background-repeat: no-repeat;
    background-size: 40% 100%;
    animation: imp-progress-slide 1400ms ease-in-out infinite;
  }

  .bar:indeterminate:dir(rtl) {
    animation-direction: reverse;
  }

  .bar:indeterminate::-webkit-progress-value {
    background-color: transparent;
  }

  .bar:indeterminate::-moz-progress-bar {
    background-color: transparent;
  }

  @keyframes imp-progress-slide {
    from { background-position: -66.667% 0 }
    to { background-position: 166.667% 0 }
  }

  .shape-ring,
  .shape-gauge {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: ${token('space-1')};
    vertical-align: middle;
  }

  .shape-ring.size-sm { --progress-size: 1.5rem; --progress-stroke: 4 }
  .shape-ring.size-md { --progress-size: 2.5rem; --progress-stroke: 3.5; font-size: 0.625rem }
  .shape-ring.size-lg { --progress-size: 4rem; --progress-stroke: 3 }

  .shape-gauge.size-sm { --progress-size: 5rem; --progress-stroke: 4 }
  .shape-gauge.size-md { --progress-size: 7rem; --progress-stroke: 3.5 }
  .shape-gauge.size-lg { --progress-size: 10rem; --progress-stroke: 3 }

  .dial {
    display: grid;
    place-items: center;
    inline-size: var(--progress-size);
  }

  .dial > * {
    grid-area: 1 / 1;
  }

  .dial svg {
    display: block;
    inline-size: 100%;
    overflow: visible;
  }

  .shape-gauge svg:dir(rtl) {
    transform: scaleX(-1);
  }

  .track,
  .meter {
    fill: none;
    stroke-width: var(--progress-stroke);
    stroke-linecap: round;
  }

  .track {
    stroke: var(--progress-track);
  }

  .meter {
    stroke: var(--progress-color);
    stroke-dasharray: 100 100;
    stroke-dashoffset: calc((1 - var(${RATIO})) * 100px);
    opacity: calc(var(${RATIO}) * 1000);
    transition: stroke-dashoffset ${token('duration-medium')} ease-out;
  }

  .shape-ring .meter {
    transform: rotate(-90deg);
    transform-origin: center;
  }

  ${spinnerStyles()}

  .spinner {
    --spinner-size: var(--progress-size);
    --spinner-stroke: calc(var(--progress-size) * var(--progress-stroke) / 36);
    box-sizing: border-box;
    color: var(--progress-color);
  }

  .dial .value {
    font-weight: ${token('font-weight-bold')};
  }

  .shape-gauge .value {
    align-self: end;
    line-height: 1;
  }

  .shape-gauge.size-sm .value { font-size: ${token('font-size-md')} }
  .shape-gauge.size-md .value { font-size: ${token('font-size-xl')} }
  .shape-gauge.size-lg .value { font-size: ${token('font-size-2xl')} }

  .caption {
    max-inline-size: var(--progress-size);
    color: ${token('color-secondary')};
    text-align: center;
  }

  .root[hidden],
  .head[hidden],
  .spinner[hidden],
  .dial svg[hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .bar::-webkit-progress-value { transition: none }
    .meter { transition: none }
    .bar:indeterminate {
      animation: none;
      background-position: 50% 0;
    }
  }

  @media (forced-colors: active) {
    .root {
      --progress-color: Highlight;
      --progress-track: Canvas;
      forced-color-adjust: none;
      color: CanvasText;
    }

    .bar {
      border: ${token('border-width')} solid CanvasText;
    }

    .track {
      stroke: CanvasText;
    }

    .caption,
    .head .value {
      color: CanvasText;
    }
  }
`
