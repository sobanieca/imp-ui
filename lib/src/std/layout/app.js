import { defineComponent } from '../shared/define.js'
import { div, main } from '../../api/html.js'
import { toKeyword, toSpace } from '../shared/layout.js'
import { fontFamily, token } from '../shared/css.js'
import { applyValues, declarationStyles, resolveValue } from '../shared/declarations.js'
import {
  DRAWER_CLOSE_EVENT,
  DRAWER_EVENT,
  FOOTER_TAG,
  NAVBAR_TAG,
  SIDEBAR_TAG,
  TAB_INDEX_PROPERTY,
} from './frame.js'

const NAME = 'app'

const KNOWN_PROPS = ['maxWidth', 'padding', 'events']

export const MAX_WIDTHS = ['sm', 'md', 'lg', 'xl', 'full']

const MAX_WIDTH_VALUES = {
  sm: token('content-sm'),
  md: token('content-md'),
  lg: token('content-lg'),
  xl: token('content-xl'),
  full: 'none',
}

const declarations = [
  { property: 'max-inline-size', variable: 'maxwidth', fallback: 'none' },
  { property: 'padding', variable: 'padding', fallback: token('space-4') },
]

const styles = () => `
  .root {
    ${fontFamily()}
    display: flex;
    flex-direction: column;
    block-size: 100dvh;
    max-block-size: 100%;
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .body {
    display: flex;
    flex: 1;
    min-block-size: 0;
  }

  .main {
    flex: 1;
    min-inline-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .content {
    box-sizing: border-box;
    inline-size: 100%;
    margin-inline: auto;
  }

  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 42;
    background-color: rgb(15 23 42 / 45%);
  }

  .is-drawer-open .backdrop {
    display: block;
  }

  ${declarationStyles('.content', declarations)}
`

const sortedRegions = (children) => {
  const navbars = []
  const footers = []
  const leftSidebars = []
  const rightSidebars = []
  const content = []
  for (const child of children) {
    if (child.localName === NAVBAR_TAG) navbars.push(child)
    else if (child.localName === FOOTER_TAG) footers.push(child)
    else if (child.localName === SIDEBAR_TAG) {
      const side = child.getAttribute('side') === 'right' ? rightSidebars : leftSidebars
      child.style.setProperty(TAB_INDEX_PROPERTY, String(side.length))
      side.push(child)
    } else content.push(child)
  }
  return { navbars, footers, leftSidebars, rightSidebars, content }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const { navbars, footers, leftSidebars, rightSidebars, content } = sortedRegions(children)
    const sidebars = [...leftSidebars, ...rightSidebars]
    const contentBox = div({ class: 'content' }, ...content)
    const mainRegion = main({ class: 'main' }, contentBox)
    const backdrop = div({ class: 'backdrop' })
    const root = div(
      { class: 'root', events: props.events },
      ...navbars,
      div({ class: 'body' }, ...leftSidebars, mainRegion, ...rightSidebars),
      ...footers,
      backdrop,
    )

    applyValues(contentBox, [
      [
        'maxwidth',
        resolveValue(props.maxWidth, toKeyword(NAME, 'maxWidth', MAX_WIDTH_VALUES, 'full')),
      ],
      ['padding', resolveValue(props.padding, toSpace(NAME, 'padding', 4))],
    ])

    if (sidebars.length === 0) return root

    const openDrawers = new Set()
    const behindTheDrawer = [...navbars, ...footers, mainRegion]

    const syncDrawers = () => {
      const anyOpen = openDrawers.size > 0
      root.classList.toggle('is-drawer-open', anyOpen)
      for (const region of behindTheDrawer) region.inert = anyOpen
      for (const bar of sidebars) bar.inert = anyOpen && !openDrawers.has(bar)
    }

    const closeDrawer = (bar) => bar.dispatchEvent(new CustomEvent(DRAWER_CLOSE_EVENT))

    root.addEventListener(DRAWER_EVENT, (event) => {
      const source = event.target
      if (!event.detail.open) {
        openDrawers.delete(source)
        syncDrawers()
        return
      }
      for (const bar of sidebars) {
        if (bar !== source) closeDrawer(bar)
      }
      openDrawers.clear()
      openDrawers.add(source)
      syncDrawers()
    })

    backdrop.addEventListener('click', () => {
      for (const bar of [...openDrawers]) closeDrawer(bar)
    })

    return root
  },
}

export const app = (...args) => defineComponent(NAME, () => definition)(...args)
