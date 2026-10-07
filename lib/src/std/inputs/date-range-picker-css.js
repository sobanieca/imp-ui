import { anchoredStyles } from '../shared/anchored.js'
import {
  controlBox,
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  hiddenRule,
  seamLift,
  token,
} from '../shared/css.js'
import { dateGridStyles } from './date-grid.js'
import { shellStyles } from './shell.js'

const primaryMix = (amount, base) =>
  `color-mix(in oklab, ${token('color-primary')} ${amount}, ${base})`

const SWITCH_GAP = '3px'

const pickerStyles = () => `
  .picker {
    position: relative;
    display: flex;
    min-inline-size: 0;
  }

  .trigger {
    display: flex;
    flex: 1;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
    margin: 0;
    ${controlBox('md', 'space-3')}
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    ${fontFamily()}
    text-align: start;
    cursor: pointer;
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .trigger:hover:not(:disabled) {
    border-color: ${primaryMix('45%', token('color-border'))};
  }

  .trigger:focus-visible {${focusRing()}}

  ${seamLift('.trigger')}

  .trigger:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .trigger[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  .glyph {
    display: inline-flex;
    flex: none;
    color: ${token('color-primary')};
  }

  .summary {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: ${token('space-2')};
    min-inline-size: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .main {
    flex: none;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main.placeholder {
    color: ${token('color-secondary')};
  }

  .detail {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    color: ${token('color-secondary')};
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
  }

  .badge {
    flex: none;
    align-self: center;
    padding-block: 0.0625rem;
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${primaryMix('30%', 'transparent')};
    border-radius: 999px;
    background-color: ${primaryMix('10%', 'transparent')};
    color: ${primaryMix('70%', token('color-text'))};
    font-size: 0.6875rem;
    font-weight: ${token('font-weight-bold')};
    letter-spacing: 0.04em;
    line-height: ${token('line-height-tight')};
    text-transform: uppercase;
  }

  .badge.custom {
    border-color: color-mix(in oklab, ${token('color-secondary')} 35%, transparent);
    background-color: color-mix(in oklab, ${token('color-secondary')} 12%, transparent);
    color: ${token('color-text')};
  }

  .trigger .chevron {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    color: ${token('color-secondary')};
  }
`

const switchStyles = () => `
  .switch {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: ${SWITCH_GAP};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface-sunken')};
  }

  .switch::before {
    content: '';
    position: absolute;
    inset-block: ${SWITCH_GAP};
    inset-inline-start: ${SWITCH_GAP};
    inline-size: calc(50% - ${SWITCH_GAP});
    border-radius: calc(${token('radius-item')} - 1px);
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-sm')};
    transition: inset-inline-start ${token('duration-medium')} ease-out;
  }

  .switch.custom::before {
    inset-inline-start: 50%;
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${token('space-2')};
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')};
    border: 0;
    border-radius: calc(${token('radius-item')} - 1px);
    background-color: transparent;
    color: ${token('color-secondary')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-normal')};
    cursor: pointer;
    transition: color ${token('duration-fast')} ease-out;
  }

  .tab:hover,
  .tab[aria-selected='true'] {
    color: ${token('color-text')};
  }

  .tab:focus-visible {
    ${focusRing()}
    outline-offset: 0;
  }
`

const relativeStyles = () => `
  .presets {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preset {
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-2')} ${token('space-3')};
    border: 0;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-tight')};
    text-align: start;
    cursor: pointer;
  }

  .preset:hover {
    background-color: ${token('color-surface-hover')};
  }

  .preset:focus-visible {
    ${focusRing()}
    outline-offset: -2px;
  }

  .preset[aria-checked='true'] {
    background-color: ${primaryMix('10%', 'transparent')};
    color: ${primaryMix('62%', token('color-text'))};
    font-weight: ${token('font-weight-bold')};
  }

  .dot {
    flex: none;
    box-sizing: border-box;
    inline-size: 1rem;
    block-size: 1rem;
    border: calc(1.5 * ${token('border-width')}) solid ${token('color-border')};
    border-radius: 50%;
    background-color: ${token('color-surface')};
    transition: border-width ${token('duration-fast')} ease-out;
  }

  .preset[aria-checked='true'] .dot {
    border: 0.3125rem solid ${token('color-primary')};
  }

  .preset-label {
    flex: 1;
    min-inline-size: 0;
  }

  .preset-range {
    flex: none;
    color: ${token('color-secondary')};
    font-family: ${token('font-family-mono')};
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    font-weight: ${token('font-weight-normal')};
    white-space: nowrap;
  }
`

const customStyles = () => `
  .readouts {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: ${token('space-2')};
  }

  .readout {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-inline-size: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    transition: border-color ${token('duration-fast')} ease-out;
  }

  .readout.active {
    border-color: ${token('color-primary')};
    box-shadow: 0 0 0 ${token('border-width')} ${token('color-primary')};
  }

  .readout-label {
    color: ${token('color-secondary')};
    font-size: 0.6875rem;
    font-weight: ${token('font-weight-bold')};
    letter-spacing: 0.04em;
    line-height: ${token('line-height-tight')};
    text-transform: uppercase;
  }

  .readout-value {
    overflow: hidden;
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    line-height: ${token('line-height-normal')};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .readout-value.empty {
    color: ${token('color-secondary')};
    font-family: inherit;
  }

  .time {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    margin: 0;
    margin-block-start: ${token('space-1')};
    padding-block: 0.125rem;
    padding-inline: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    font-family: ${token('font-family-mono')};
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
    line-height: ${token('line-height-normal')};
  }

  .time:focus-visible {${focusRing()}}

  .arrow {
    display: inline-flex;
    color: ${token('color-secondary')};
  }

  .arrow:dir(rtl) {
    scale: -1 1;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: ${token('space-2')};
    padding-block-start: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }
`

const panelStyles = () => `
  ${anchoredStyles({ trigger: '.picker', panel: '.panel', placement: 'block-end', align: 'start' })}

  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    min-inline-size: min(anchor-size(inline), 24rem);
    padding: ${token('space-3')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
  }

  .panes {
    display: grid;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: ${token('space-3')};
    grid-area: 1 / 1;
    min-inline-size: 0;
  }

  .pane[hidden] {
    display: flex !important;
    max-block-size: 0;
    overflow: hidden;
    visibility: hidden;
  }
`

export const dateRangePickerStyles = () => `
  ${shellStyles()}
  ${hiddenRule}
  ${dateGridStyles()}
  ${pickerStyles()}
  ${panelStyles()}
  ${switchStyles()}
  ${relativeStyles()}
  ${customStyles()}

  @media (prefers-reduced-motion: reduce) {
    .trigger,
    .switch::before,
    .tab,
    .dot,
    .readout { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .panel,
    .badge,
    .readout,
    .time { border-color: CanvasText }
    .main.placeholder { color: GrayText }
    .switch::before { display: none }
    .tab[aria-selected='true'],
    .preset[aria-checked='true'] {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    .dot { border-color: CanvasText }
    .preset[aria-checked='true'] .dot { border-color: HighlightText }
    .readout.active { border-color: Highlight }
  }
`
