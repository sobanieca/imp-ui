import { defineComponent } from '../shared/define.js'
import { aside, div, el, footer, header, main } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'
import { menuIcon } from '../shared/icons.js'
import {
  applyResponsive,
  BREAKPOINTS,
  resolveResponsive,
  responsiveStyles,
  WIDER_BREAKPOINTS,
} from '../shared/responsive.js'

const NAME = 'appShell'

const KNOWN_PROPS = [
  'header',
  'sidebar',
  'footer',
  'bottomBar',
  'sidebarWidth',
  'collapseBelow',
  'menuLabel',
  'events',
]

const SIDEBAR_WIDTHS = ['sm', 'md', 'lg']

const SIDEBAR_ID = 'sidebar'

const messages = { 'imp.appShell.menu': 'Menu' }

const declarations = [
  { property: 'display', variable: 'sidebardisplay', fallback: 'block' },
  { property: 'position', variable: 'sidebarposition', fallback: 'static' },
  { property: 'z-index', variable: 'sidebarzindex', fallback: 'auto' },
  { property: 'box-shadow', variable: 'sidebarshadow', fallback: 'none' },
]

const menuDeclarations = [{ property: 'display', variable: 'menudisplay', fallback: 'none' }]

const backdropDeclarations = [{
  property: 'display',
  variable: 'backdropdisplay',
  fallback: 'none',
}]

const styles = () => `
  .root {
    display: flex;
    flex-direction: column;
    block-size: 100dvh;
    max-block-size: 100dvh;
    ${fontFamily()}
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .header {
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    flex: none;
    position: relative;
    z-index: 20;
    box-sizing: border-box;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
    background-color: ${token('color-surface')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    flex: 1;
    min-inline-size: 0;
  }

  .menu {
    flex: none;
    align-self: flex-start;
    align-items: center;
    justify-content: center;
    margin: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-md')};
    padding: ${token('space-2')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .menu:hover {
    background-color: ${token('color-surface-hover')};
  }

  .menu:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.25em;
    block-size: 1.25em;
  }

  .body {
    display: flex;
    flex: 1;
    min-block-size: 0;
  }

  .sidebar {
    box-sizing: border-box;
    flex: none;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: min(var(--sidebar-inline-size, ${token('sidebar-md')}), 85vw);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: ${token('space-3')};
    background-color: ${token('color-surface')};
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar:focus-visible {${focusRing()}}

  .main {
    flex: 1;
    min-inline-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 30;
    background-color: rgb(15 23 42 / 45%);
  }

  .footer,
  .bottom {
    flex: none;
    box-sizing: border-box;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
    background-color: ${token('color-surface')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  ${responsiveStyles('.sidebar', declarations)}

  ${responsiveStyles('.menu', menuDeclarations)}

  ${responsiveStyles('.is-open .backdrop', backdropDeclarations)}

  .is-open .sidebar {
    display: block;
  }

  ${forcedColors}
`

const collapsedPerBreakpoint = (collapseBelow) => {
  const rank = BREAKPOINTS.indexOf(collapseBelow)
  return Object.fromEntries(
    BREAKPOINTS.map((breakpoint, index) => [breakpoint, index < rank]),
  )
}

const region = (node, build) => (node === undefined || node === null ? null : build(node))

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    const width = oneOf(NAME, 'sidebarWidth', props.sidebarWidth, SIDEBAR_WIDTHS, 'md')
    const collapseBelow = props.collapseBelow === null
      ? null
      : oneOf(NAME, 'collapseBelow', props.collapseBelow, WIDER_BREAKPOINTS, 'md')
    const hasSidebar = props.sidebar !== undefined && props.sidebar !== null
    if (props.collapseBelow !== undefined && !hasSidebar) {
      impLogger.warn(`${NAME}: 'collapseBelow' only does something together with a 'sidebar'`)
    }

    const sidebarRegion = region(
      props.sidebar,
      (content) => aside({ class: 'sidebar', id: SIDEBAR_ID, tabindex: '-1' }, content),
    )
    sidebarRegion?.style.setProperty(
      '--sidebar-inline-size',
      token(`sidebar-${width}`),
    )
    const collapsible = hasSidebar && collapseBelow !== null
    const menuButton = collapsible
      ? el('button', {
        class: 'menu',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': SIDEBAR_ID,
      }, menuIcon())
      : null
    const mainRegion = main({ class: 'main' }, ...children)
    const backdrop = collapsible ? div({ class: 'backdrop' }) : null
    const headerRegion = props.header === undefined && menuButton === null ? null : header(
      { class: 'header' },
      menuButton,
      div({ class: 'header-content' }, props.header ?? null),
    )
    const root = div(
      { class: 'root', events: props.events },
      headerRegion,
      div({ class: 'body' }, sidebarRegion, mainRegion),
      backdrop,
      region(props.footer, (content) => footer({ class: 'footer' }, content)),
      region(props.bottomBar, (content) => div({ class: 'bottom' }, content)),
    )

    if (collapsible) {
      const collapsed = collapsedPerBreakpoint(collapseBelow)
      const responsive = [
        ['sidebardisplay', (value) => (value ? 'none' : 'block')],
        ['sidebarposition', (value) => (value ? 'fixed' : 'static')],
        ['sidebarzindex', (value) => (value ? '40' : 'auto')],
        [
          'sidebarshadow',
          (value) => (value ? token('shadow-lg') : 'none'),
        ],
        ['menudisplay', (value) => (value ? 'inline-flex' : 'none')],
        ['backdropdisplay', (value) => (value ? 'block' : 'none')],
      ]
      for (const [variable, toCssValue] of responsive) {
        applyResponsive(
          root,
          variable,
          resolveResponsive(NAME, 'collapseBelow', collapsed, toCssValue),
        )
      }

      const setOpen = (open) => {
        root.classList.toggle('is-open', open)
        menuButton.setAttribute('aria-expanded', String(open))
        mainRegion.inert = open
        if (open) sidebarRegion.focus()
        else menuButton.focus()
      }
      menuButton.addEventListener('click', () => {
        setOpen(!root.classList.contains('is-open'))
      })
      backdrop.addEventListener('click', () => setOpen(false))
      root.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !root.classList.contains('is-open')) return
        event.preventDefault()
        setOpen(false)
      })
      root.addEventListener('select', () => {
        if (root.classList.contains('is-open')) setOpen(false)
      })
      let menuLabel = props.menuLabel
      const paintMenuLabel = () =>
        menuButton.setAttribute(
          'aria-label',
          menuLabel === undefined ? t('imp.appShell.menu') : String(menuLabel),
        )
      bindValue(props.menuLabel, (value) => {
        menuLabel = value
        paintMenuLabel()
      })
      lang.watch(paintMenuLabel)
    }
    return root
  },
}

export const appShell = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
