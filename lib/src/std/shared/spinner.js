import { span } from '../../api/html.js'

const SPINNER_CLASS = 'spinner'

const DOT = 'no-repeat radial-gradient(circle closest-side, currentColor 90%, transparent)'

const shapeBlock = (shape, rules) => `
  @container style(--imp-loader: ${shape}) {
    .${SPINNER_CLASS} {
      border: 0;
      ${rules}
    }
  }
`

export const spinnerStyles = () => `
  .${SPINNER_CLASS} {
    box-sizing: border-box;
    inline-size: var(--spinner-size, 1em);
    block-size: var(--spinner-size, 1em);
    border: var(--spinner-stroke, 2px) solid currentColor;
    border-block-start-color: transparent;
    border-radius: 50%;
    animation: imp-spin 600ms linear infinite;
  }

  ${
  shapeBlock(
    'dots',
    `border-radius: 0;
      background: ${DOT} 0% 50%, ${DOT} 50% 50%, ${DOT} 100% 50%;
      background-size: calc(100% / 3) 50%;
      animation: imp-loader-dots 1s linear infinite;`,
  )
}

  ${
  shapeBlock(
    'bar',
    `border-radius: 0;
      background:
        linear-gradient(currentColor 0 0) -150% 50% / 40% var(--spinner-stroke, 2px) no-repeat,
        linear-gradient(color-mix(in srgb, currentColor 25%, transparent) 0 0) 50% 50% / 100% var(--spinner-stroke, 2px) no-repeat;
      animation: imp-loader-bar 1s linear infinite;`,
  )
}

  ${
  shapeBlock(
    'pulse',
    `background: currentColor;
      animation: imp-loader-pulse 1s ease-out infinite;`,
  )
}

  @keyframes imp-spin {
    to { transform: rotate(360deg) }
  }

  @keyframes imp-loader-dots {
    20% { background-position: 0% 0%, 50% 50%, 100% 50% }
    40% { background-position: 0% 100%, 50% 0%, 100% 50% }
    60% { background-position: 0% 50%, 50% 100%, 100% 0% }
    80% { background-position: 0% 50%, 50% 50%, 100% 100% }
  }

  @keyframes imp-loader-bar {
    to { background-position: 250% 50%, 50% 50% }
  }

  @keyframes imp-loader-pulse {
    from { transform: scale(0.4); opacity: 1 }
    to { transform: scale(1); opacity: 0 }
  }

  @media (prefers-reduced-motion: reduce) {
    .${SPINNER_CLASS} { animation-duration: 2s }
  }
`

export const spinnerNode = (props = {}) =>
  span({ ...props, class: SPINNER_CLASS, 'aria-hidden': 'true' })
