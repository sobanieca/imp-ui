import { anchoredStyles } from '../shared/anchored.js'
import { shellStyles } from './shell.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  quietScrollbar,
  seamLift,
  token,
} from '../shared/css.js'

const primaryMix = (amount, base) =>
  `color-mix(in oklab, ${token('color-primary')} ${amount}, ${base})`

const FOCUSED_FRAME = '.frame:has(input:focus-visible)'

export const comboBoxStyles = () => `
  ${shellStyles()}

  .combo {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    ${fontFamily()}
  }

  .frame {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space-1')};
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-3')} ${token('space-6')};
    border: ${token('border-width')} solid ${token('color-border')};
    ${groupableSeam()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    cursor: text;
    transition: border-color ${token('duration-fast')} ease-out;
  }

  ${seamLift(`${FOCUSED_FRAME}, .frame`)}

  ${FOCUSED_FRAME} {${focusRing()}}

  .frame:has(input[aria-invalid='true']) {
    border-color: ${token('color-danger')};
  }

  .frame:has(input:disabled) {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  input {
    flex: 1 1 6rem;
    box-sizing: border-box;
    inline-size: 0;
    min-inline-size: 3rem;
    margin: 0;
    padding-block: ${token('space-1')};
    padding-inline: 0;
    border: none;
    outline: none;
    background-color: transparent;
    color: inherit;
    ${fontFamily()}
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
  }

  input:disabled {
    cursor: not-allowed;
  }

  .chevron {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-end: ${token('space-2')};
    inline-size: 1rem;
    block-size: 1rem;
    translate: 0 -50%;
    color: ${token('color-secondary')};
    pointer-events: none;
  }

  .chips {
    display: contents;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    max-inline-size: 100%;
    block-size: 1.5rem;
    padding-inline-start: ${token('space-2')};
    border: ${token('border-width')} solid ${primaryMix('30%', 'transparent')};
    border-radius: ${token('radius-item')};
    background-color: ${primaryMix('12%', 'transparent')};
    color: ${primaryMix('62%', token('color-text'))};
    font-size: ${token('font-size-sm')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
  }

  .chip-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.5rem;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: inherit;
    cursor: pointer;
  }

  .remove:hover:not(:disabled) {
    background-color: ${primaryMix('20%', 'transparent')};
  }

  .remove:focus-visible {
    ${focusRing()}
    outline-offset: 0;
  }

  .remove:disabled {
    cursor: not-allowed;
  }

  .remove .icon {
    display: block;
    inline-size: 0.875rem;
    block-size: 0.875rem;
  }

  ${anchoredStyles({ trigger: '.frame', panel: '.panel', placement: 'block-end', align: 'start' })}

  .panel {
    min-inline-size: anchor-size(inline);
    max-block-size: min(18rem, calc(100dvb - ${token('space-6')} - ${token('space-6')}));
    margin-block: ${token('space-1')};
    margin-inline: 0;
    padding: ${token('space-1')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
    ${quietScrollbar()}
  }

  .listbox {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    border-radius: ${token('radius-item')};
    font-size: ${token('font-size-md')};
    line-height: ${token('line-height-normal')};
    cursor: pointer;
  }

  .option:hover,
  .option.active {
    background-color: ${token('color-surface-hover')};
  }

  .option[aria-selected='true'] {
    color: ${primaryMix('62%', token('color-text'))};
    font-weight: ${token('font-weight-bold')};
  }

  .option[aria-disabled='true'] {
    background-color: transparent;
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .option-label {
    flex: 1 1 auto;
    min-inline-size: 0;
  }

  .status {
    padding-block: ${token('space-1')};
    padding-inline: ${token('space-2')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  .status:empty {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .frame { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .panel,
    .chip { border-color: CanvasText }

    .option.active {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }
`
