import { focusRing, fontFamily, hiddenRule, token, visuallyHidden } from '../shared/css.js'

const MARKER_SIZE = '1.75rem'

const lineWidth = () => token('focus-ring-width')

const verticalRules = (scope) => `
  ${scope}.list {
    flex-direction: column;
    gap: 0;
  }

  ${scope} .step {
    position: relative;
    flex: none;
    padding-block-end: ${token('space-4')};
  }

  ${scope} .step:last-child {
    padding-block-end: 0;
  }

  ${scope} .step::after {
    position: absolute;
    inset-block: calc(${MARKER_SIZE} + ${token('space-1')}) ${token('space-1')};
    inset-inline-start: calc((${MARKER_SIZE} - ${lineWidth()}) / 2);
    inline-size: ${lineWidth()};
    block-size: auto;
    min-inline-size: 0;
    margin: 0;
  }

  ${scope} .words {
    max-inline-size: none;
  }

  ${scope} .description {
    display: block;
  }
`

export const stepsStyles = () => `
  ${hiddenRule}

  :host {
    display: block;
  }

  .root {
    container-type: inline-size;
    ${fontFamily()}
  }

  .list {
    display: flex;
    gap: ${token('space-2')};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    display: flex;
    flex: 1 1 auto;
    align-items: flex-start;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .step:last-child {
    flex: 0 1 auto;
  }

  .step::after {
    content: '';
    flex: 1 1 ${token('space-4')};
    min-inline-size: ${token('space-4')};
    block-size: ${lineWidth()};
    margin-block-start: calc((${MARKER_SIZE} - ${lineWidth()}) / 2);
    border-radius: ${lineWidth()};
    background-color: ${token('color-border')};
  }

  .step:last-child::after {
    display: none;
  }

  .step.done::after {
    background-color: ${token('color-primary')};
  }

  .body {
    display: flex;
    align-items: flex-start;
    gap: ${token('space-2')};
    min-inline-size: 0;
    margin: 0;
    border: none;
    border-radius: ${token('radius-item')};
    padding: 0;
    background-color: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  .body[hidden] {
    display: none;
  }

  button.body {
    cursor: pointer;
  }

  button.body:hover .label {
    text-decoration: underline;
  }

  button.body:focus-visible {${focusRing()}}

  .marker {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: ${MARKER_SIZE};
    block-size: ${MARKER_SIZE};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: 50%;
    background-color: ${token('color-surface')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out,
      color ${token('duration-fast')} ease-out;
  }

  .done .marker {
    border-color: ${token('color-primary')};
    background-color: color-mix(in oklab, ${token('color-primary')} 14%, ${token('color-surface')});
    color: ${token('color-primary')};
  }

  .current .marker {
    border-color: ${token('color-primary')};
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  .step.error .marker {
    border-color: ${token('color-danger')};
    background-color: color-mix(in oklab, ${token('color-danger')} 14%, ${token('color-surface')});
    color: ${token('color-danger')};
  }

  .words {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: 14rem;
    padding-block-start: calc(
      (${MARKER_SIZE} - ${token('font-size-sm')} * ${token('line-height-tight')}) / 2
    );
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .label {
    color: ${token('color-secondary')};
    font-weight: ${token('font-weight-bold')};
    overflow-wrap: anywhere;
  }

  .done .label,
  .current .label {
    color: ${token('color-text')};
  }

  .step.error .label {
    color: ${token('color-danger')};
  }

  .state {${visuallyHidden}}

  .description {
    margin-block-start: ${token('space-1')};
    color: ${token('color-secondary')};
    overflow-wrap: anywhere;
  }

  ${verticalRules('.vertical')}

  @container (max-inline-size: 40rem) {
    .horizontal .description {
      display: none;
    }
  }

  @container (max-inline-size: 28rem) {
    ${verticalRules('.horizontal')}
  }

  @media (prefers-reduced-motion: reduce) {
    .marker { transition: none }
  }

  @media (forced-colors: active) {
    .marker {
      border-color: CanvasText;
      color: CanvasText;
    }

    .current .marker {
      border-color: Highlight;
      background-color: Highlight;
      color: HighlightText;
    }

    .step::after {
      background-color: CanvasText;
    }

    .step.error .label {
      color: CanvasText;
    }
  }
`
