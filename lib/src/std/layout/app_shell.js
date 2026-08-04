import { component } from '../../component.js'
import { aside, div, el, footer, header, main } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { createLogger } from '../../logger.js'
import { bindValue, oneOf, splitArgs, warnUnknownProps } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors } from '../shared/css.js'
import { menuIcon } from '../shared/icons.js'
import {
  applyResponsive,
  BREAKPOINTS,
  resolveResponsive,
  responsiveStyles,
} from '../shared/responsive.js'

const log = createLogger('imp')

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

const SIDEBAR_WIDTH_FALLBACKS = { sm: '12rem', md: '16rem', lg: '20rem' }

const SIDEBAR_ID = 'sidebar'

const COLLAPSIBLE_BREAKPOINTS = BREAKPOINTS.slice(1)

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

const styles = `
  .root {
    display: flex;
    flex-direction: column;
    block-size: 100dvh;
    max-block-size: 100dvh;
    ${fontFamily}
    background-color: var(--imp-color-surface-hover, #f1f5f9);
    color: var(--imp-color-text, #0f172a);
  }

  .header {
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    flex: none;
    position: relative;
    z-index: 20;
    box-sizing: border-box;
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-4, 16px);
    background-color: var(--imp-color-surface, #ffffff);
    border-block-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: var(--imp-space-3, 12px);
    flex: 1;
    min-inline-size: 0;
  }

  .menu {
    flex: none;
    align-self: flex-start;
    align-items: center;
    justify-content: center;
    margin: 0;
    border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
    border-radius: var(--imp-radius-md, 6px);
    padding: var(--imp-space-2, 8px);
    background-color: transparent;
    color: var(--imp-color-text, #0f172a);
    cursor: pointer;
  }

  .menu:hover {
    background-color: var(--imp-color-surface-hover, #f1f5f9);
  }

  .menu:focus-visible {${focusRing}}

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
    inline-size: min(var(--sidebar-inline-size, var(--imp-sidebar-md, 16rem)), 85vw);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--imp-space-3, 12px);
    background-color: var(--imp-color-surface, #ffffff);
    border-inline-end: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
  }

  .sidebar:focus-visible {${focusRing}}

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
    padding-block: var(--imp-space-2, 8px);
    padding-inline: var(--imp-space-4, 16px);
    background-color: var(--imp-color-surface, #ffffff);
    border-block-start: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
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
  onMount: (_instance, ...args) => {
    const { props, children } = splitArgs(NAME, args)
    warnUnknownProps(NAME, props, KNOWN_PROPS)
    const width = oneOf(NAME, 'sidebarWidth', props.sidebarWidth, SIDEBAR_WIDTHS, 'md')
    const collapseBelow = props.collapseBelow === null
      ? null
      : oneOf(NAME, 'collapseBelow', props.collapseBelow, COLLAPSIBLE_BREAKPOINTS, 'md')
    const hasSidebar = props.sidebar !== undefined && props.sidebar !== null
    if (props.collapseBelow !== undefined && !hasSidebar) {
      log.warn(`${NAME}: 'collapseBelow' only does something together with a 'sidebar'`)
    }

    const sidebarRegion = region(
      props.sidebar,
      (content) => aside({ class: 'sidebar', id: SIDEBAR_ID, tabindex: '-1' }, content),
    )
    sidebarRegion?.style.setProperty(
      '--sidebar-inline-size',
      `var(--imp-sidebar-${width}, ${SIDEBAR_WIDTH_FALLBACKS[width]})`,
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
          (value) => (value ? 'var(--imp-shadow-lg, 0 12px 32px rgb(15 23 42 / 18%))' : 'none'),
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

let create = null

export const appShell = (...args) => {
  if (!create) {
    defaultMessages(messages)
    create = component('imp-app-shell', definition)
  }
  return create(...args)
}
