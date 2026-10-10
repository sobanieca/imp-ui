import { impLogger } from './logger.js'

export const SCREEN_EFFECTS = ['none', 'fade', 'slide', 'zoom']

const SCREEN_NAME = 'imp-screen'

const BACK_ATTRIBUTE = 'data-imp-screen-back'

const DURATION = 'var(--imp-duration-medium, 200ms)'

let region = null
let effect = 'none'
let sheet = null
let latestTransition = null

const sharedStyles = () => `
  ::view-transition {
    pointer-events: none;
  }

  :root {
    --imp-screen-out: -8%;
    --imp-screen-in: 8%;
  }

  :root[dir='rtl'],
  :root[${BACK_ATTRIBUTE}] {
    --imp-screen-out: 8%;
    --imp-screen-in: -8%;
  }

  :root[dir='rtl'][${BACK_ATTRIBUTE}] {
    --imp-screen-out: -8%;
    --imp-screen-in: 8%;
  }

  @media (prefers-reduced-motion: reduce) {
    ::view-transition-old(${SCREEN_NAME}),
    ::view-transition-new(${SCREEN_NAME}) {
      animation: none;
    }
  }
`

const EFFECT_STYLES = {
  fade: `
    ::view-transition-old(${SCREEN_NAME}) {
      animation: ${DURATION} ease-out both imp-screen-fade-out;
    }

    ::view-transition-new(${SCREEN_NAME}) {
      animation: ${DURATION} ease-out both imp-screen-fade-in;
    }

    @keyframes imp-screen-fade-out {
      to { opacity: 0 }
    }

    @keyframes imp-screen-fade-in {
      from { opacity: 0 }
    }
  `,
  slide: `
    ::view-transition-old(${SCREEN_NAME}) {
      animation: ${DURATION} ease-in both imp-screen-slide-out;
    }

    ::view-transition-new(${SCREEN_NAME}) {
      animation: ${DURATION} ease-out both imp-screen-slide-in;
    }

    @keyframes imp-screen-slide-out {
      to {
        opacity: 0;
        translate: var(--imp-screen-out) 0;
      }
    }

    @keyframes imp-screen-slide-in {
      from {
        opacity: 0;
        translate: var(--imp-screen-in) 0;
      }
    }
  `,
  zoom: `
    ::view-transition-old(${SCREEN_NAME}) {
      animation: ${DURATION} ease-in both imp-screen-zoom-out;
    }

    ::view-transition-new(${SCREEN_NAME}) {
      animation: ${DURATION} ease-out both imp-screen-zoom-in;
    }

    @keyframes imp-screen-zoom-out {
      to {
        opacity: 0;
        scale: 1.02;
      }
    }

    @keyframes imp-screen-zoom-in {
      from {
        opacity: 0;
        scale: 0.98;
      }
    }
  `,
}

const installStyles = (kind) => {
  if (sheet === null) {
    sheet = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }
  sheet.replaceSync(`${sharedStyles()}${EFFECT_STYLES[kind]}`)
}

export const claimScreen = (element, kind) => {
  effect = kind
  region = element
  if (kind === 'none') {
    element.style.removeProperty('view-transition-name')
    return
  }
  installStyles(kind)
  element.style.setProperty('view-transition-name', SCREEN_NAME)
}

export const releaseScreen = (element) => {
  if (region !== element) return
  element.style.removeProperty('view-transition-name')
  region = null
  effect = 'none'
}

export const scrollRegion = () => region

const reducedMotion = () => globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches

export const transitionScreen = (update, { back = false } = {}) => {
  if (effect === 'none' || document.visibilityState === 'hidden' || reducedMotion()) {
    update()
    return
  }
  const root = document.documentElement
  root.toggleAttribute(BACK_ATTRIBUTE, back)
  const transition = document.startViewTransition(update)
  latestTransition = transition
  transition.ready.catch(() => {})
  transition.updateCallbackDone.catch((error) => {
    impLogger.error('the screen failed to change inside its transition', error)
  })
  const clearBack = () => {
    if (latestTransition !== transition) return
    latestTransition = null
    root.removeAttribute(BACK_ATTRIBUTE)
  }
  transition.finished.then(clearBack, clearBack)
  return transition
}
