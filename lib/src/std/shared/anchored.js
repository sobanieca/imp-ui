import { seamReset, token } from './css.js'

const ANCHOR = '--imp-anchor'

const ALONG_INLINE = { start: 'span-inline-end', center: 'center', end: 'span-inline-start' }

const ALONG_BLOCK = { start: 'span-block-end', center: 'center', end: 'span-block-start' }

const positionArea = (placement, align) =>
  placement === 'block-start' || placement === 'block-end'
    ? `${placement} ${ALONG_INLINE[align]}`
    : `${ALONG_BLOCK[align]} ${placement}`

export const anchoredStyles = ({ trigger, panel, placement, align, anchor = ANCHOR }) => `
  ${trigger} {
    anchor-name: ${anchor};
  }

  ${panel} {
    position: fixed;
    position-anchor: ${anchor};
    position-area: ${positionArea(placement, align)};
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
    position-try-order: most-block-size;
    position-visibility: anchors-visible;
    box-sizing: border-box;
    inset: auto;
    inline-size: max-content;
    max-inline-size: calc(100dvi - ${token('space-6')} - ${token('space-6')});
    max-block-size: calc(100% - ${token('space-1')} - ${token('space-1')});
    margin: ${token('space-1')};
    padding: 0;
    border: none;
    background-color: transparent;
    overflow: auto;
    overscroll-behavior: contain;
    opacity: 1;
    transition: opacity ${token('duration-fast')} ease-out;
    ${seamReset()}
  }

  ${panel}:not(:popover-open) {
    display: none;
  }

  @starting-style {
    ${panel}:popover-open { opacity: 0 }
  }

  @media (prefers-reduced-motion: reduce) {
    ${panel} { transition: none }
  }
`
