import { defineComponent } from '../shared/define.js'
import { aside, dialog, div, el, header, main } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { oneOf } from '../shared/args.js'
import { menuIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'
import { modalOverlay, overlayMotion, overlayScrim } from '../shared/overlay.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'

const NAME = 'shell'

const KNOWN_PROPS = [
  'header',
  'rail',
  'sidebar',
  'aside',
  'bottomNav',
  'headerSpan',
  'navOpen',
  'events',
]

const HEADER_SPANS = ['full', 'content']

const NAV_TOGGLE_EVENT = 'navToggle'

const SIDEBAR_ID = 'sidebar'

const NAV_LABEL_KEY = 'imp.shell.nav'

const messages = {
  [NAV_LABEL_KEY]: 'Navigation',
}

const styles = () => `
  :host {
    display: block;
    block-size: 100dvh;
  }

  .shell {
    --rail-track: 0px;
    --sidebar-track: 0px;
    --aside-track: 0px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    block-size: 100%;
    ${fontFamily()}
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
  }

  .shell.has-rail { --rail-track: var(--imp-shell-rail-inline-size, 3.5rem) }
  .shell.has-sidebar { --sidebar-track: var(--imp-shell-sidebar-inline-size, 16rem) }
  .shell.has-aside { --aside-track: var(--imp-shell-aside-inline-size, 20rem) }

  .region {
    min-inline-size: 0;
    min-block-size: 0;
    box-sizing: border-box;
  }

  .header {
    grid-row: 1;
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-4')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .header-body {
    flex: 1;
    min-inline-size: 0;
  }

  .main {
    grid-row: 2;
    grid-column: 1 / -1;
    overflow: auto;
    padding: ${token('space-4')};
  }

  .bottom {
    grid-row: 3;
    grid-column: 1 / -1;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .rail,
  .sidebar,
  .aside {
    display: none;
    overflow: auto;
    background-color: ${token('color-surface-sunken')};
  }

  .rail {
    padding-block: ${token('space-3')};
    padding-inline: ${token('space-2')};
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar {
    padding: ${token('space-3')};
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .aside {
    padding: ${token('space-3')};
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: ${token('radius-md')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .trigger:hover {
    background-color: ${token('color-surface-hover')};
  }

  .trigger:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .drawer {
    --overlay-offset: -100% 0;
    margin: 0;
    padding: 0;
    border: none;
    inline-size: min(var(--imp-shell-sidebar-inline-size, 16rem), 85vw);
    block-size: 100dvh;
    max-block-size: 100dvh;
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
  }

  .drawer:dir(rtl) { --overlay-offset: 100% 0 }

  ${overlayMotion('.drawer')}

  ${overlayScrim('.drawer')}

  .drawer .sidebar {
    display: block;
    block-size: 100%;
    border: none;
  }

  @media (min-width: ${DESKTOP_MIN_WIDTH}) {
    .shell {
      grid-template-columns:
        var(--rail-track) var(--sidebar-track) minmax(0, 1fr) var(--aside-track);
    }

    .rail,
    .sidebar,
    .aside {
      display: block;
    }

    .rail { grid-row: 2; grid-column: 1 }
    .sidebar { grid-row: 2; grid-column: 2 }
    .main { grid-row: 2; grid-column: 3 }
    .aside { grid-row: 2; grid-column: 4 }

    .span-content .header { grid-column: 3 / -1 }
    .span-content .rail { grid-row: 1 / span 2 }
    .span-content .sidebar { grid-row: 1 / span 2 }

    .bottom,
    .trigger {
      display: none;
    }
  }

  ${forcedColors}
`

const regionNode = (content, build) => (content === undefined || content === null ? null : build())

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (instance, props, children) => {
    const headerSpan = oneOf(NAME, 'headerSpan', props.headerSpan, HEADER_SPANS, 'full')
    const given = (name) => props[name] !== undefined && props[name] !== null
    const hasSidebar = given('sidebar')
    const hasBottomNav = given('bottomNav')
    const drawn = hasSidebar && !hasBottomNav

    const railRegion = regionNode(props.rail, () => div({ class: 'region rail' }, props.rail))
    const sidebarRegion = regionNode(
      props.sidebar,
      () => div({ class: 'region sidebar', id: SIDEBAR_ID }, props.sidebar),
    )
    const asideRegion = regionNode(props.aside, () => aside({ class: 'region aside' }, props.aside))
    const bottomRegion = regionNode(
      props.bottomNav,
      () => div({ class: 'region bottom' }, props.bottomNav),
    )
    const mainRegion = main({ class: 'region main' }, ...children)

    const trigger = drawn
      ? el('button', {
        class: 'trigger',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': SIDEBAR_ID,
        events: { click: () => changeOpen(!open, { notify: true }) },
      }, menuIcon())
      : null
    const drawer = drawn ? dialog({ class: 'drawer' }) : null
    if (drawn) {
      lang.watch(() => {
        const label = t(NAV_LABEL_KEY)
        trigger.setAttribute('aria-label', label)
        drawer.setAttribute('aria-label', label)
      })
    }

    const headerRegion = given('header') || drawn
      ? header(
        { class: 'region header' },
        trigger,
        div({ class: 'header-body' }, props.header),
      )
      : null

    const root = div(
      {
        class: [
          'shell',
          `span-${headerSpan}`,
          railRegion && 'has-rail',
          sidebarRegion && 'has-sidebar',
          asideRegion && 'has-aside',
        ],
        events: props.events,
      },
      headerRegion,
      railRegion,
      sidebarRegion,
      mainRegion,
      asideRegion,
      bottomRegion,
      drawer,
    )

    const openState = isStateShaped(props.navOpen) ? props.navOpen : null
    let open = false

    const overlay = drawn ? modalOverlay(drawer, { signal: instance.abortSignal }) : null

    let pendingOpen = false

    const show = () => {
      drawer.append(sidebarRegion)
      overlay.open()
    }

    const paint = () => {
      if (!drawn) return
      trigger.setAttribute('aria-expanded', String(open))
      if (!open) {
        overlay.close()
        return
      }
      if (drawer.isConnected) show()
      else if (!pendingOpen) {
        pendingOpen = true
        instance.afterMount(() => {
          pendingOpen = false
          if (open) show()
        })
      }
    }

    function changeOpen(next, { notify }) {
      const wanted = Boolean(next)
      if (wanted === open) return
      open = wanted
      paint()
      if (!notify) return
      if (openState) {
        if (typeof openState.set === 'function') openState.set(open)
        else {
          impLogger.warn(
            `${NAME}: 'navOpen' is a read-only state - pass a writable state so the drawer can close itself`,
          )
        }
      }
      root.dispatchEvent(
        new CustomEvent(NAV_TOGGLE_EVENT, {
          bubbles: true,
          composed: true,
          detail: { open },
        }),
      )
    }

    if (drawn) {
      drawer.addEventListener('close', () => {
        root.insertBefore(sidebarRegion, mainRegion)
        changeOpen(false, { notify: true })
      })
      matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH})`).addEventListener(
        'change',
        (event) => {
          if (event.matches) changeOpen(false, { notify: true })
        },
        { signal: instance.abortSignal },
      )
    }

    if (openState) openState.watch((value) => changeOpen(value, { notify: false }))
    else if (props.navOpen !== undefined) changeOpen(props.navOpen, { notify: false })

    return root
  },
}

export const shell = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
