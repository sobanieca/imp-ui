import { div } from '../../api/html.js'

export const backdropStyles = () => `
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: -1;
    display: grid;
    overflow: hidden;
    border-radius: inherit;
  }
`

export const backdropNode = (value) =>
  value === undefined || value === null
    ? null
    : div({ class: 'backdrop', 'aria-hidden': 'true' }, value)
