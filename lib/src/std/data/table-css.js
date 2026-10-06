import {
  focusRing,
  fontFamily,
  hiddenRule,
  quietScrollbar,
  token,
  visuallyHidden,
} from '../shared/css.js'
import { checkableStyles } from '../inputs/control-css.js'
import { loadMoreStyles } from '../shared/load-more.js'

const CARD_BREAKPOINT = '30rem'

const selectedTint = (ground) => `color-mix(in oklab, ${token('color-primary')} 10%, ${ground})`

export const tableStyles = () => `
  ${hiddenRule}

  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
  }

  .root {
    container-type: inline-size;
    ${fontFamily()}
    color: ${token('color-text')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
  }

  .region {
    position: relative;
    overflow: auto;
    max-block-size: var(--imp-table-max-block-size, none);
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-surface')};
    ${quietScrollbar()}
  }

  .region:focus-visible {${focusRing()}}

  table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  caption {${visuallyHidden}}

  th,
  td {
    box-sizing: border-box;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    text-align: start;
    vertical-align: middle;
  }

  th {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-secondary')};
    font-weight: ${token('font-weight-bold')};
    white-space: nowrap;
  }

  .rows tr:last-child td {
    border-block-end: none;
  }

  .align-center { text-align: center }

  .align-end { text-align: end }

  .select-cell {
    inline-size: 1%;
    padding-inline-end: 0;
  }

  .select-text {${visuallyHidden}}

  .sort {
    display: inline-flex;
    align-items: center;
    gap: ${token('space-1')};
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .sort:hover,
  th[aria-sort] .sort {
    color: ${token('color-text')};
  }

  .sort:focus-visible {${focusRing()}}

  .sort-icon {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    opacity: 0.35;
    transition:
      rotate ${token('duration-fast')} ease-out,
      opacity ${token('duration-fast')} ease-out;
  }

  .sort:hover .sort-icon,
  .sort:focus-visible .sort-icon {
    opacity: 0.7;
  }

  th[aria-sort] .sort-icon {
    opacity: 1;
  }

  th[aria-sort='ascending'] .sort-icon {
    rotate: 180deg;
  }

  .selectable .rows tr {
    cursor: pointer;
  }

  .selectable .rows tr:hover {
    background-color: ${token('color-surface-hover')};
  }

  .rows tr[aria-selected='true'] {
    background-color: ${selectedTint('transparent')};
  }

  .empty td {
    border-block-end: none;
  }

  ${checkableStyles()}

  .check {
    align-items: center;
  }

  ${loadMoreStyles()}

  @container (inline-size <= ${CARD_BREAKPOINT}) {
    .region {
      border: none;
      border-radius: 0;
      background-color: transparent;
    }

    table,
    thead,
    tbody,
    tr,
    th,
    td {
      display: block;
    }

    thead tr {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${token('space-2')} ${token('space-4')};
      padding-block-end: ${token('space-3')};
    }

    th {
      position: static;
      padding: 0;
      border: none;
      background-color: transparent;
    }

    th.plain {${visuallyHidden}}

    .select-cell {
      inline-size: auto;
    }

    .select-all .select-text {
      position: static;
      inline-size: auto;
      block-size: auto;
      margin: 0;
      overflow: visible;
      clip-path: none;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: ${token('space-2')};
    }

    .rows tr {
      padding-block: ${token('space-2')};
      padding-inline: ${token('space-3')};
      border: ${token('border-width')} solid ${token('color-border')};
      border-radius: ${token('radius-item')};
      background-color: ${token('color-surface')};
      content-visibility: auto;
      contain-intrinsic-block-size: auto 6rem;
    }

    .rows tr[aria-selected='true'] {
      border-color: ${token('color-primary')};
      background-color: ${selectedTint(token('color-surface'))};
    }

    .rows td {
      display: grid;
      grid-template-columns: minmax(5rem, 35%) minmax(0, 1fr);
      gap: ${token('space-3')};
      padding-block: ${token('space-1')};
      padding-inline: 0;
      border: none;
      text-align: start;
    }

    .rows td::before {
      content: attr(data-label);
      color: ${token('color-secondary')};
      font-weight: ${token('font-weight-bold')};
    }

    .rows td.select-cell {
      display: block;
    }

    .rows td.select-cell::before {
      content: none;
    }

    .empty td {
      padding: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sort-icon { transition: none }
  }

  @media (forced-colors: active) {
    .rows tr[aria-selected='true'] {
      outline: ${token('border-width')} solid Highlight;
      outline-offset: calc(-1 * ${token('border-width')});
    }
  }
`
