import { anchoredStyles } from '../shared/anchored.js'
import {
  controlBox,
  focusRing,
  fontFamily,
  forcedColors,
  groupableSeam,
  hiddenRule,
  quietScrollbar,
  seamLift,
  token,
  visuallyHidden,
} from '../shared/css.js'
import { shellStyles } from './shell.js'

const primaryMix = (amount, base) =>
  `color-mix(in oklab, ${token('color-primary')} ${amount}, ${base})`

const CLEAR_SIZE = '1.75rem'

export const treeSelectStyles = () => `
  ${shellStyles()}

  ${hiddenRule}

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

  .trigger:focus-visible {${focusRing()}}

  ${seamLift('.trigger')}

  .trigger:disabled {
    cursor: not-allowed;
    opacity: ${token('disabled-opacity')};
  }

  .trigger[aria-invalid='true'] {
    border-color: ${token('color-danger')};
  }

  .value {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 1lh;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value.placeholder {
    color: ${token('color-secondary')};
  }

  .picker.clearable .value {
    margin-inline-end: ${CLEAR_SIZE};
  }

  .trigger .chevron {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    color: ${token('color-secondary')};
  }

  .clear {
    position: absolute;
    inset-block: 0;
    inset-inline-end: calc(${token('space-3')} + 1rem);
    display: flex;
    align-items: center;
    z-index: 2;
  }

  ${anchoredStyles({ trigger: '.picker', panel: '.panel', placement: 'block-end', align: 'start' })}

  .panel {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: max(anchor-size(inline), 16rem);
    max-block-size: min(28rem, calc(100% - ${token('space-1')} - ${token('space-1')}));
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    box-shadow: ${token('shadow-md')};
    color: ${token('color-text')};
    ${fontFamily()}
    overflow: hidden;
  }

  .search-box {
    position: relative;
    display: flex;
    flex: none;
  }

  .search-glyph {
    position: absolute;
    inset-block: 0;
    inset-inline-start: ${token('space-2')};
    display: flex;
    align-items: center;
    color: ${token('color-secondary')};
    pointer-events: none;
  }

  .search {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding-block: ${token('space-2')};
    padding-inline: calc(${token('space-2')} + 1.25rem) ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
    ${fontFamily()}
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .search:focus-visible {
    ${focusRing()}
    outline-offset: 0;
    background-color: ${token('color-surface')};
  }

  .scroller {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    ${quietScrollbar()}
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tree {
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
  }

  [role='treeitem'] {
    outline: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: 0.125rem;
    padding-inline-start: calc(${token('space-1')} + var(--level) * 1.25rem);
    padding-inline-end: ${token('space-2')};
    border-radius: ${token('radius-item')};
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background-color: ${token('color-surface-hover')};
  }

  [role='treeitem']:focus-visible > .row {
    ${focusRing()}
    outline-offset: -2px;
  }

  .toggle {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: ${token('radius-item')};
    color: ${token('color-secondary')};
  }

  .toggle.fold:hover {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .toggle .chevron {
    inline-size: 0.875rem;
    block-size: 0.875rem;
    transition: rotate ${token('duration-fast')} ease-out;
  }

  .toggle .chevron:dir(rtl) {
    scale: -1 1;
  }

  [aria-expanded='true'] > .row .toggle .chevron {
    rotate: 90deg;
  }

  [aria-expanded='true'] > .row .toggle .chevron:dir(rtl) {
    rotate: -90deg;
  }

  .mark {
    display: inline-flex;
    flex: none;
    box-sizing: border-box;
    inline-size: 1rem;
    block-size: 1rem;
    border: calc(1.5 * ${token('border-width')}) solid ${token('color-border')};
    border-radius: min(${token('radius-item')}, 0.25rem);
    background-color: ${token('color-surface')};
    color: ${token('color-primary')};
    transition:
      background-color ${token('duration-fast')} ease-out,
      border-color ${token('duration-fast')} ease-out;
  }

  .mark-glyph {
    inline-size: 100%;
    block-size: 100%;
  }

  .mark-glyph > * {
    display: none;
  }

  .row:hover .mark {
    border-color: ${token('color-primary')};
  }

  [data-mark='checked'] > .row .mark {
    border-color: ${token('color-primary')};
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
  }

  [data-mark='all'] > .row .mark,
  [data-mark='mixed'] > .row .mark {
    border-color: ${token('color-primary')};
  }

  [data-mark='checked'] > .row .tick,
  [data-mark='all'] > .row .square,
  [data-mark='mixed'] > .row .dash {
    display: inline;
  }

  [data-mark='checked'] > .row .item-label,
  [data-mark='all'] > .row .item-label {
    color: ${primaryMix('62%', token('color-text'))};
    font-weight: ${token('font-weight-bold')};
  }

  .item-label {
    flex: 1;
    min-inline-size: 0;
    padding-block: ${token('space-1')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-label mark {
    border-radius: 2px;
    background-color: ${primaryMix('22%', 'transparent')};
    color: inherit;
  }

  .hint {
    ${visuallyHidden}
  }

  .status {
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-2')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-normal')};
    text-align: center;
  }

  .status:empty {
    display: none;
  }

  .footer {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: ${token('space-2')};
    padding-block-start: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .count {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger,
    .mark,
    .toggle .chevron { transition: none }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .panel { border-color: CanvasText }
    .value.placeholder { color: GrayText }
    .mark { border-color: CanvasText }
    [data-mark='checked'] > .row .mark {
      border-color: Highlight;
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
    [data-mark='all'] > .row .mark,
    [data-mark='mixed'] > .row .mark {
      border-color: Highlight;
      background-color: Canvas;
      color: Highlight;
      forced-color-adjust: none;
    }
    .item-label mark {
      background-color: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }
  }
`
