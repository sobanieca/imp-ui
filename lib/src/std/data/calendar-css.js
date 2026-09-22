import { paletteNames } from '../../theme-colors.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  hiddenRule,
  quietScrollbar,
  token,
  visuallyHidden,
} from '../shared/css.js'

const colorRules = () =>
  paletteNames()
    .map((name) => `  .color-${name} { --event-color: ${token(`color-${name}`)} }`)
    .join('\n')

const toolbarStyles = () => `
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space-2')};
  }

  .steps {
    display: flex;
    align-items: center;
  }

  .title {
    flex: 1;
    min-inline-size: 8rem;
    margin: 0;
    color: ${token('color-text')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }
`

const eventStyles = () => `
  .event {
    --event-color: ${token('color-primary')};
    box-sizing: border-box;
    min-inline-size: 0;
    margin: 0;
    border: none;
    border-inline-start: 3px solid var(--event-color);
    border-radius: ${token('radius-item')};
    background-color: color-mix(in oklab, var(--event-color) 16%, ${token('color-surface')});
    color: color-mix(in oklab, var(--event-color) 45%, ${token('color-text')});
    ${fontFamily()}
    font-size: 0.75rem;
    line-height: ${token('line-height-tight')};
    text-align: start;
    cursor: pointer;
  }

  .event:hover {
    background-color: color-mix(in oklab, var(--event-color) 28%, ${token('color-surface')});
  }

  .event:focus-visible {
    ${focusRing()}
    outline-offset: 1px;
    z-index: 1;
  }

  .event-time {
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }

  .event-title {
    font-weight: ${token('font-weight-bold')};
  }

  .chip {
    display: flex;
    gap: ${token('space-1')};
    inline-size: 100%;
    padding-block: 2px;
    padding-inline: ${token('space-1')};
    overflow: hidden;
    white-space: nowrap;
  }

  .chip .event-title {
    overflow: hidden;
    text-overflow: ellipsis;
  }

${colorRules()}
`

const monthStyles = () => `
  .weekdays,
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .weekday {
    padding-block: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    text-align: center;
  }

  .weekday .narrow {
    display: none;
  }

  .month-grid {
    border-block-start: ${token('border-width')} solid ${token('color-border')};
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    min-inline-size: 0;
    min-block-size: 6.75rem;
    padding: 2px;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
  }

  .cell.outside {
    background-color: ${token('color-surface-sunken')};
  }

  .cell.outside .day-number {
    color: ${token('color-secondary')};
  }

  .day-number,
  .day-button {
    box-sizing: border-box;
    margin: 0;
    border: ${token('border-width')} solid transparent;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .day-number {
    align-self: flex-end;
    min-inline-size: 1.75rem;
    block-size: 1.75rem;
    padding-inline: ${token('space-1')};
  }

  .day-number:hover,
  .day-button:hover,
  .more:hover {
    background-color: ${token('color-surface-hover')};
  }

  .day-number:focus-visible,
  .day-button:focus-visible,
  .more:focus-visible {${focusRing()}}

  .day-number[aria-current='date'],
  .day-button[aria-current='date'] {
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
    font-weight: ${token('font-weight-bold')};
  }

  .chips {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chips li {
    display: flex;
    min-inline-size: 0;
  }

  .more {
    align-self: flex-start;
    margin: 0;
    padding-block: 2px;
    padding-inline: ${token('space-1')};
    border: none;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-secondary')};
    ${fontFamily()}
    font-size: 0.75rem;
    cursor: pointer;
  }

  .more .brief {
    display: none;
  }

  @container (max-inline-size: 36rem) {
    .weekday .short { display: none }
    .weekday .narrow { display: inline }

    .cell {
      min-block-size: 4.5rem;
      align-items: center;
    }

    .day-number {
      align-self: center;
    }

    .chips {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      gap: 3px;
    }

    .month-grid .chip {
      inline-size: 0.75rem;
      block-size: 0.75rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background-color: var(--event-color);
    }

    .month-grid .chip {
      position: relative;
      overflow: visible;
    }

    .month-grid .chip::after {
      content: '';
      position: absolute;
      inset: -0.375rem;
    }

    .month-grid .chip:hover {
      background-color: var(--event-color);
    }

    .month-grid .chip > * {
      ${visuallyHidden}
    }

    .more {
      align-self: center;
    }

    .more .full { display: none }
    .more .brief { display: inline }
  }
`

const timeStyles = () => `
  .scroller {
    --gutter: 3.5rem;
    --hour: 3rem;
    position: relative;
    block-size: min(40rem, 70dvb);
    overflow: auto;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    ${quietScrollbar()}
  }

  .time-head,
  .time-body {
    display: grid;
    grid-template-columns: var(--gutter) repeat(var(--days), minmax(var(--day-size), 1fr));
    min-inline-size: calc(var(--gutter) + var(--days) * var(--day-size));
  }

  .days-7 { --days: 7; --day-size: 5.5rem }

  .days-1 { --days: 1; --day-size: 10rem }

  .time-head {
    position: sticky;
    inset-block-start: 0;
    z-index: 4;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
  }

  .corner,
  .hours {
    position: sticky;
    inset-inline-start: 0;
    z-index: 3;
    background-color: ${token('color-surface')};
  }

  .corner {
    grid-row: 1 / span 2;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: 0.75rem;
  }

  .day-head {
    display: flex;
    justify-content: center;
    padding: ${token('space-1')};
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .day-button {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
  }

  .all-day {
    display: flex;
    flex-direction: column;
    gap: 2px;
    grid-row: 2;
    min-inline-size: 0;
    min-block-size: 1.5rem;
    padding: 2px;
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .hours {
    display: flex;
    flex-direction: column;
  }

  .hour {
    box-sizing: border-box;
    block-size: var(--hour);
    padding-inline-end: ${token('space-1')};
    color: ${token('color-secondary')};
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  .column {
    position: relative;
    block-size: calc(24 * var(--hour));
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
    background-image: linear-gradient(
      to bottom,
      ${token('color-border')} ${token('border-width')},
      transparent ${token('border-width')}
    );
    background-size: 100% var(--hour);
    cursor: cell;
  }

  .column.today {
    background-color: color-mix(in oklab, ${token('color-primary')} 5%, transparent);
  }

  .block {
    position: absolute;
    display: flex;
    flex-direction: column;
    padding-block: 2px;
    padding-inline: ${token('space-1')};
    overflow: hidden;
    box-shadow: 0 0 0 1px ${token('color-surface')};
  }

  .now {
    position: absolute;
    inset-inline: 0;
    z-index: 1;
    block-size: 2px;
    background-color: ${token('color-danger')};
    pointer-events: none;
  }

  .now::before {
    content: '';
    position: absolute;
    inset-inline-start: -4px;
    inset-block-start: -3px;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background-color: ${token('color-danger')};
  }
`

export const calendarStyles = () => `
  ${hiddenRule}

  :host {
    display: block;
  }

  .root {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    min-inline-size: 0;
    container-type: inline-size;
    color: ${token('color-text')};
    ${fontFamily()}
  }

  ${toolbarStyles()}
  ${eventStyles()}
  ${monthStyles()}
  ${timeStyles()}

  ${forcedColors}

  @media (forced-colors: active) {
    .event {
      border: 1px solid CanvasText;
      border-inline-start-width: 3px;
      color: CanvasText;
    }
    .day-number[aria-current='date'],
    .day-button[aria-current='date'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    .now, .now::before { background-color: Highlight }
  }
`
