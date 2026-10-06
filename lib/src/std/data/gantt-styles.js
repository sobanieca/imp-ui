import { focusRing, fontFamily, quietScrollbar, token, visuallyHidden } from '../shared/css.js'

export const ganttStyles = () => `
  :host {
    display: block;
    inline-size: 100%;
  }

  .root {
    container-type: inline-size;
    box-sizing: border-box;
    overflow: hidden;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    color: ${token('color-text')};
  }

  .scale-day { --day: 2.25rem }

  .scale-week { --day: 0.75rem }

  .scale-month { --day: 0.2rem }

  .scroll {
    --label-size: min(14rem, 40cqi);
    overflow: auto;
    max-block-size: var(--imp-gantt-max-block-size, none);
    ${quietScrollbar()}
  }

  .scroll:focus-visible {
    ${focusRing()}
    outline-offset: calc(-1 * ${token('focus-ring-width')});
  }

  .canvas {
    position: relative;
    inline-size: max-content;
    min-inline-size: 100%;
  }

  .header {
    position: sticky;
    inset-block-start: 0;
    z-index: 3;
    display: flex;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
    color: ${token('color-secondary')};
  }

  .corner, .label-cell {
    position: sticky;
    inset-inline-start: 0;
    z-index: 2;
    flex: none;
    box-sizing: border-box;
    inline-size: var(--label-size);
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
  }

  .timeline {
    flex: none;
    inline-size: calc(var(--day) * var(--total-days));
  }

  .spans, .units, .columns {
    display: flex;
  }

  .span-cell, .unit-cell, .column {
    flex: none;
    box-sizing: border-box;
    inline-size: calc(var(--day) * var(--days));
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .span-cell {
    overflow: clip;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    white-space: nowrap;
  }

  .span-text {
    position: sticky;
    inset-inline-start: var(--label-size);
    display: inline-block;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    color: ${token('color-text')};
    font-weight: ${token('font-weight-bold')};
  }

  .unit-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: clip;
    padding-block: ${token('space-1')};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .unit-cell.current {
    color: ${token('color-primary')};
    font-weight: ${token('font-weight-bold')};
  }

  .body {
    position: relative;
  }

  .columns {
    position: absolute;
    inset-block: 0;
    inset-inline-start: var(--label-size);
  }

  .column {
    border-inline-end-color: color-mix(in oklab, ${token('color-border')} 55%, transparent);
  }

  .today {
    position: absolute;
    inset-block: 0;
    inset-inline-start: calc(var(--day) * (var(--offset) + 0.5) - 1px);
    border-inline-start: 2px solid ${token('color-primary')};
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows {
    position: relative;
  }

  .row {
    display: flex;
    min-block-size: 2.5rem;
    border-block-end: ${token('border-width')} solid
      color-mix(in oklab, ${token('color-border')} 55%, transparent);
  }

  .row:hover .track {
    background-color: color-mix(in oklab, ${token('color-text')} 5%, transparent);
  }

  .label-cell {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    padding-inline: ${token('space-3')};
  }

  .group-row {
    background-color: ${token('color-surface-sunken')};
  }

  .group-row .label-cell {
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-secondary')};
    font-weight: ${token('font-weight-bold')};
  }

  .grouped .task .label-cell {
    padding-inline-start: ${token('space-5')};
  }

  .name {
    display: block;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button.name {
    appearance: none;
    max-inline-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  button.name:hover {
    color: ${token('color-primary')};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  button.name:focus-visible {${focusRing()}}

  .details {${visuallyHidden}}

  .track {
    position: relative;
    flex: none;
    inline-size: calc(var(--day) * var(--total-days));
  }

  .bar, .milestone {
    position: absolute;
    inset-block: 0;
    box-sizing: border-box;
    margin-block: auto;
  }

  .bar {
    inset-inline-start: calc(var(--day) * var(--offset));
    inline-size: calc(var(--day) * var(--days));
    min-inline-size: 4px;
    block-size: 1.25rem;
    overflow: hidden;
    border: ${token('border-width')} solid color-mix(in oklab, var(--task-color) 60%, transparent);
    border-radius: ${token('radius-item')};
    background-color: color-mix(in oklab, var(--task-color) 26%, transparent);
  }

  .fill {
    block-size: 100%;
    inline-size: var(--progress);
    background-color: var(--task-color);
  }

  .milestone {
    inset-inline-start: calc(var(--day) * (var(--offset) + 0.5) - 0.4375rem);
    inline-size: 0.875rem;
    block-size: 0.875rem;
    border-radius: 2px;
    background-color: var(--task-color);
    rotate: 45deg;
  }

  .selectable .bar, .selectable .milestone {
    cursor: pointer;
  }

  @media (forced-colors: active) {
    .bar {
      border-color: CanvasText;
      background-color: Canvas;
    }

    .fill, .milestone {
      forced-color-adjust: none;
      background-color: CanvasText;
    }

    .today { border-color: Highlight }

    .unit-cell.current { color: Highlight }
  }
`
