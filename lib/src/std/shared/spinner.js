import { span } from '../../api/html.js'

const SPINNER_CLASS = 'spinner'

export const spinnerStyles = () => `
  .${SPINNER_CLASS} {
    inline-size: var(--spinner-size, 1em);
    block-size: var(--spinner-size, 1em);
    border: var(--spinner-stroke, 2px) solid currentColor;
    border-block-start-color: transparent;
    border-radius: 50%;
    animation: imp-spin 600ms linear infinite;
  }

  @keyframes imp-spin {
    to { transform: rotate(360deg) }
  }

  @media (prefers-reduced-motion: reduce) {
    .${SPINNER_CLASS} { animation-duration: 2s }
  }
`

export const spinnerNode = (props = {}) =>
  span({ ...props, class: SPINNER_CLASS, 'aria-hidden': 'true' })
