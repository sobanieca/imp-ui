import { defineComponent } from '../shared/define.js'
import { dialog, div, el, header, main, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { bindValue } from '../shared/args.js'
import { toSpace } from '../shared/layout.js'
import { userCard } from '../shell/user_card.js'
import { chevronIcon, closeIcon, menuIcon, moreIcon, railIcon } from '../shared/icons.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'
import { modalOverlay, overlayMotion, overlayScrim } from '../shared/overlay.js'
import {
  navActivate,
  navLinkNode,
  navLinkStyles,
  navTagNode,
  normalizeNavItems,
  normalizeNavTag,
} from '../shared/nav_items.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'

const NAME = 'shell'

const KNOWN_PROPS = [
  'logo',
  'navbar',
  'sidebar',
  'account',
  'extras',
  'signedIn',
  'navOpen',
  'background',
  'gap',
  'events',
]

const ACCOUNT_KEYS = ['name', 'description', 'picture', 'href', 'onSignIn', 'onSignOut']

const NAVBAR_KEYS = ['label', 'items', 'selected']

const SIDEBAR_KEYS = ['label', 'groups', 'items', 'extras', 'footer', 'selected']

const NAV_TOGGLE_EVENT = 'navToggle'

const DRAWER_ID = 'nav-drawer'

const SHEET_ID = 'more-sheet'

const NAV_LABEL_KEY = 'imp.shell.nav'

const SECTION_LABEL_KEY = 'imp.shell.section'

const MORE_LABEL_KEY = 'imp.shell.more'

const MORE_IN_KEY = 'imp.shell.moreIn'

const COLLAPSE_KEY = 'imp.shell.collapse'

const EXPAND_KEY = 'imp.shell.expand'

const CLOSE_KEY = 'imp.shell.close'

const messages = {
  [NAV_LABEL_KEY]: 'Navigation',
  [SECTION_LABEL_KEY]: 'Section',
  [MORE_LABEL_KEY]: 'More',
  [MORE_IN_KEY]: 'More in {section}',
  [COLLAPSE_KEY]: 'Collapse the sidebar',
  [EXPAND_KEY]: 'Expand the sidebar',
  [CLOSE_KEY]: 'Close',
}

const BOTTOM_BAR_ITEMS_PROPERTY = '--imp-shell-bottom-bar-items'

const DEFAULT_BOTTOM_BAR_ITEMS = 4

const MIN_BOTTOM_BAR_ITEMS = 3

const MAX_BOTTOM_BAR_ITEMS = 5

const styles = () => `
  :host {
    display: block;
    block-size: 100dvb;
  }

  .shell {
    --sidebar-track: 0px;
    --frame-gap: 0px;
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    box-sizing: border-box;
    block-size: 100%;
    padding: var(--frame-gap);
    ${fontFamily()}
    background: ${token('background-app')};
    color: ${token('color-text')};
  }

  .shell.has-sidebar {
    --sidebar-track: calc(var(--imp-shell-sidebar-inline-size, 16rem) + var(--frame-gap));
  }

  .shell.has-sidebar.rail { --sidebar-track: calc(3.75rem + var(--frame-gap)) }

  .backdrop {
    position: absolute;
    inset: 0;
    z-index: -1;
    display: grid;
    overflow: hidden;
  }

  .shell.signed-out.has-sidebar {
    --sidebar-track: 0px;
  }

  .region {
    min-inline-size: 0;
    min-block-size: 0;
    box-sizing: border-box;
  }

  ${navLinkStyles()}

  .link {
    border-inline-start: calc(${token('border-width')} * 2) solid transparent;
    border-radius: 0;
  }

  .sidebar-body .link[aria-current],
  .drawer-nav .link[aria-current] {
    border-inline-start-color: ${token('color-primary')};
  }

  .topbar {
    grid-row: 1;
    grid-column: 1;
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface-sunken')};
  }

  .shell:not(.has-sidebar) .sidebar { display: none }

  .bar-logo:empty,
  .sidebar-logo:empty,
  .bar-body:empty,
  .bar-tools:empty,
  .bar-title:empty,
  .drawer-nav:empty,
  .drawer-tools:empty,
  .drawer-foot:empty,
  .sidebar-extras:empty,
  .sidebar-foot:empty {
    display: none;
  }

  .bar-logo { flex: none }

  .bar-body {
    flex: 1;
    min-inline-size: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bar-body::-webkit-scrollbar { display: none }

  .bar-tools {
    flex: none;
    margin-inline-start: auto;
  }

  .bar-title {
    display: none;
    flex-direction: column;
    min-inline-size: 0;
    line-height: ${token('line-height-tight')};
  }

  .bar-title .over {
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-secondary')};
  }

  .bar-title .now {
    font-weight: ${token('font-weight-medium')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shell.signed-out .bar-body,
  .shell.signed-out .bar-title,
  .shell.signed-out .sidebar,
  .shell.signed-out .bottombar {
    display: none;
  }

  .main {
    grid-row: 2;
    grid-column: 1;
    overflow: auto;
    padding: ${token('space-4')};
  }

  .sidebar,
  .bottombar {
    display: none;
    background-color: ${token('color-surface-sunken')};
  }

  .sidebar {
    flex-direction: column;
    overflow: hidden;
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    padding: ${token('space-2')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-logo { flex: none }

  .sidebar-head .here {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-primary')};
    white-space: nowrap;
  }

  .sidebar-extras,
  .sidebar-foot {
    flex: none;
    padding: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-extras .extras,
  .drawer-tools .extras {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .sidebar-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-block: ${token('space-2')};
  }

  .sidebar-body ul,
  .bar-body ul,
  .drawer-nav ul,
  .drawer-foot ul,
  .sheet ul {
    display: flex;
    flex-direction: column;
  }

  .bar-body ul {
    flex-direction: row;
    align-items: stretch;
    gap: ${token('space-1')};
  }

  .bar-body .link {
    border-inline-start: none;
    border-block-end: calc(${token('border-width')} * 2) solid transparent;
  }

  .bar-body .link[aria-current] {
    border-block-end-color: ${token('color-primary')};
    background-color: transparent;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .group-title .tag { margin-inline-start: 0 }

  .child .link { padding-inline-start: ${token('space-6')} }

  .caret {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    margin-inline-start: auto;
    transition: rotate ${token('duration-fast')} ease-out;
  }

  .link[aria-expanded='true'] .caret { rotate: 90deg }

  .link:dir(rtl) .caret { rotate: 180deg }

  .link[aria-expanded='true']:dir(rtl) .caret { rotate: 90deg }

  .tag ~ .caret { margin-inline-start: 0 }

  .shell.rail .sidebar-body .label,
  .shell.rail .sidebar-body .tag,
  .shell.rail .sidebar-body .caret,
  .shell.rail .sidebar-body .group-title,
  .shell.rail .sidebar-body .child,
  .shell.rail .sidebar-head .here,
  .shell.rail .sidebar-logo,
  .shell.rail .sidebar-extras,
  .shell.rail .sidebar-foot .tools,
  .shell.rail .sidebar-foot .label {
    display: none;
  }

  .shell.rail .sidebar-body .link,
  .shell.rail .sidebar-foot .link {
    justify-content: center;
    padding-inline: 0;
  }

  .bottombar {
    grid-row: 3;
    grid-column: 1;
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .bottombar ul {
    display: flex;
    align-items: stretch;
  }

  .bottombar li {
    flex: 1;
    min-inline-size: 0;
  }

  .bottombar .link {
    position: relative;
    flex-direction: column;
    justify-content: center;
    gap: ${token('space-1')};
    inline-size: 100%;
    min-block-size: 3.5rem;
    padding-inline: ${token('space-1')};
    border-inline-start: none;
    border-block-start: calc(${token('border-width')} * 2) solid transparent;
    font-size: ${token('font-size-sm')};
  }

  .bottombar .link[aria-current] {
    border-block-start-color: ${token('color-primary')};
  }

  .bottombar .caret,
  .sheet .caret,
  .bar-body .caret {
    display: none;
  }

  .bottombar .label {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bottombar .tag {
    position: absolute;
    margin: 0;
    inset-block-start: ${token('space-1')};
    inset-inline-start: calc(50% + ${token('space-2')});
  }

  .tools {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    min-inline-size: 0;
  }

  .sidebar-foot .tools,
  .drawer-tools .tools {
    flex-direction: column;
    align-items: stretch;
  }

  .hamburger,
  .rail-toggle,
  .sheet-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    margin: 0;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .hamburger,
  .sheet-close {
    inline-size: 2.75rem;
    block-size: 2.75rem;
  }

  .rail-toggle {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    margin-inline-start: auto;
  }

  .rail-toggle[hidden] { display: none }

  .hamburger:hover,
  .rail-toggle:hover,
  .sheet-close:hover {
    background-color: ${token('color-surface-hover')};
  }

  .hamburger:focus-visible,
  .rail-toggle:focus-visible,
  .sheet-close:focus-visible {${focusRing()}}

  .hamburger { display: none }

  .shell.signed-out .hamburger { display: none }

  .icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .sheet {
    position: fixed;
    inset-block-end: 0;
    inset-inline: 0;
    box-sizing: border-box;
    inline-size: 100%;
    max-block-size: 60dvb;
    margin: 0;
    padding: ${token('space-3')};
    border: none;
    border-block-start: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    overflow: auto;
    overscroll-behavior: contain;
  }

  .sheet::backdrop { background-color: rgb(0 0 0 / 45%) }

  .sheet:not(:popover-open) { display: none }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    margin-block-end: ${token('space-2')};
  }

  .sheet-head .title {
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-primary')};
  }

  .sheet-close { margin-inline-start: auto }

  .sheet ul {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${token('space-2')};
  }

  .sheet .link {
    min-block-size: 3.25rem;
    border: ${token('border-width')} solid ${token('color-border')};
  }

  .sheet .link[aria-current] {
    border-color: ${token('color-primary')};
  }

  .sheet .child .link { padding-inline-start: ${token('space-3')} }

  .drawer {
    --overlay-offset: -100% 0;
    margin: 0;
    padding: 0;
    border: none;
    inline-size: min(var(--imp-shell-sidebar-inline-size, 16rem), 85dvi);
    block-size: 100dvb;
    max-block-size: 100dvb;
    background-color: ${token('color-surface-sunken')};
    color: ${token('color-text')};
  }

  .drawer:dir(rtl) { --overlay-offset: 100% 0 }

  ${overlayMotion('.drawer')}

  ${overlayScrim('.drawer')}

  .drawer-body {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    box-sizing: border-box;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    padding: ${token('space-2')};
    border-block-end: ${token('border-width')} solid ${token('color-border')};
  }

  .drawer-head .bar-logo { flex: 1 }

  .drawer-nav {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    padding-block: ${token('space-2')};
  }

  .drawer-foot,
  .drawer-tools {
    flex: none;
    padding: ${token('space-2')};
    border-block-start: ${token('border-width')} solid ${token('color-border')};
  }

  .drawer-tools {
    display: flex;
    flex-direction: column;
    gap: ${token('space-2')};
  }

  .shell.gapped .topbar { margin-block-end: var(--frame-gap) }
  .shell.gapped .sidebar { margin-inline-end: var(--frame-gap) }

  .shell.gapped .bottombar {
    margin-block-start: var(--frame-gap);
    overflow: hidden;
  }

  .shell.gapped .drawer {
    margin: var(--frame-gap);
    inline-size: min(var(--imp-shell-sidebar-inline-size, 16rem), calc(85dvi - var(--frame-gap)));
    block-size: calc(100dvb - var(--frame-gap) * 2);
    max-block-size: calc(100dvb - var(--frame-gap) * 2);
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
  }

  .shell.gapped .topbar,
  .shell.gapped .sidebar,
  .shell.gapped .bottombar {
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
  }

  @media (width < ${DESKTOP_MIN_WIDTH}) {
    .shell.has-bottom-bar:not(.signed-out) .bottombar { display: block }
    .shell.foldable:not(.signed-out) .hamburger { display: inline-flex }
    .shell:not(.signed-out) .bar-title { display: flex }
    .shell:not(.signed-out) .topbar .bar-logo { display: none }
  }

  @media (min-width: ${DESKTOP_MIN_WIDTH}) {
    .shell {
      grid-template-columns: var(--sidebar-track) minmax(0, 1fr);
    }

    .topbar {
      grid-column: 1 / -1;
      padding-inline: ${token('space-4')};
    }

    .shell.bar-away .topbar { display: none }
    .shell.has-sidebar:not(.signed-out) .sidebar { display: flex; grid-row: 2; grid-column: 1 }
    .main { grid-row: 2; grid-column: 2 }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .bar-body .link[aria-current] { border-block-end-color: Highlight }
    .sidebar-body .link[aria-current] { border-inline-start-color: Highlight }
    .bottombar .link[aria-current] { border-block-start-color: Highlight }
  }

  .sr-only {${visuallyHidden}}
`

const normalizeKeyed = (prop, keys, value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.nodeType === 'number') {
    impLogger.warn(`${NAME}: '${prop}' must be an object of { ${keys.join(', ')} } - ignoring it`)
    return null
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      impLogger.warn(
        `${NAME}: unknown '${prop}' key '${key}' - supported keys are ${
          keys.map((known) => `'${known}'`).join(', ')
        }`,
      )
    }
  }
  return Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  )
}

const normalizeGroupList = (value, fallbackItems) => {
  if (value === undefined || value === null) {
    const items = normalizeNavItems(NAME, fallbackItems ?? [], { nested: true })
    return items.length === 0 ? [] : [{ id: '', label: null, tag: null, items }]
  }
  if (!Array.isArray(value)) {
    impLogger.warn(`${NAME}: 'groups' must be an array of { label, items } - showing none`)
    return []
  }
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.items)) {
      impLogger.warn(`${NAME}: a group is not an object with an 'items' array - skipping it`)
      return []
    }
    const items = normalizeNavItems(NAME, entry.items, { nested: true })
    if (items.length === 0) return []
    return [{
      id: entry.id === undefined ? `g${index}` : String(entry.id),
      label: entry.label ?? null,
      tag: normalizeNavTag(NAME, entry.tag),
      items,
    }]
  })
}

const normalizeSections = (value) => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const [section] = normalizeNavItems(NAME, [entry])
    if (section === undefined) return []
    return [{ ...section, groups: normalizeGroupList(entry.groups, entry.items) }]
  })
}

const flattenGroups = (groups) => groups.flatMap((group) => group.items)

const withChildren = (items) =>
  items.flatMap((item) => [item, ...item.children.map((child) => ({ ...child, parent: item }))])

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (self) => self.afterPlacement(),
  setup: (self, props, children) => {
    const account = normalizeKeyed('account', ACCOUNT_KEYS, props.account)
    const navbarData = normalizeKeyed('navbar', NAVBAR_KEYS, props.navbar)
    const sidebarData = normalizeKeyed('sidebar', SIDEBAR_KEYS, props.sidebar)
    const hasNavbar = navbarData !== null
    const authed = props.signedIn === undefined ? true : props.signedIn

    if (hasNavbar && sidebarData !== null) {
      for (const key of ['groups', 'items']) {
        if (sidebarData[key] !== undefined) {
          impLogger.warn(
            `${NAME}: 'sidebar.${key}' is ignored beside a 'navbar' - a section declares its own 'groups'`,
          )
          delete sidebarData[key]
        }
      }
    }

    const card = account === null
      ? null
      : userCard({ signedIn: authed, block: !hasNavbar, ...account })
    const tools = props.extras !== undefined && props.extras !== null || card !== null
      ? div({ class: 'tools' }, props.extras ?? null, card)
      : null
    const logoNode = props.logo ?? null

    const barLogo = div({ class: 'bar-logo' })
    const barBody = div({ class: 'bar-body' })
    const barTools = div({ class: 'bar-tools' })
    const barOver = span({ class: 'over' })
    const barNow = span({ class: 'now' })
    const barTitle = div({ class: 'bar-title' }, barOver, barNow)

    const foldable = hasNavbar || tools !== null || logoNode !== null
    const hamburger = foldable
      ? el('button', {
        class: 'hamburger',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': DRAWER_ID,
        events: { click: () => changeOpen(!open, { notify: true }) },
      }, menuIcon())
      : null

    const drawerLogo = div({ class: 'bar-logo' })
    const drawerNav = div({ class: 'drawer-nav' })
    const drawerFoot = div({ class: 'drawer-foot' })
    const drawerTools = div({ class: 'drawer-tools' })
    const drawerClose = foldable
      ? el('button', {
        class: 'sheet-close',
        type: 'button',
        events: { click: () => changeOpen(false, { notify: true }) },
      }, closeIcon())
      : null
    const drawer = foldable
      ? dialog(
        { class: 'drawer', id: DRAWER_ID },
        div(
          { class: 'drawer-body' },
          div({ class: 'drawer-head' }, drawerLogo, drawerClose),
          drawerNav,
          drawerFoot,
          drawerTools,
        ),
      )
      : null

    const barNav = hasNavbar ? nav({ class: 'bar-nav' }) : null
    const barList = el('ul')
    const bottomBar = nav({ class: 'region bottombar' }, barList)
    const sheetTitle = span({ class: 'title' })
    const sheetList = el('ul')
    const sheetClose = el('button', {
      class: 'sheet-close',
      type: 'button',
      events: { click: () => moreSheet.hidePopover() },
    }, closeIcon())
    const moreSheet = div(
      { id: SHEET_ID, class: 'sheet', popover: 'auto' },
      div({ class: 'sheet-head' }, sheetTitle, sheetClose),
      sheetList,
    )
    const moreLabel = span({ class: 'label' })
    const moreButton = el(
      'button',
      {
        class: 'link more',
        type: 'button',
        popovertarget: SHEET_ID,
        'aria-expanded': 'false',
      },
      moreIcon(),
      moreLabel,
    )
    const moreItem = el('li', moreButton)

    const barred = hasNavbar || sidebarData !== null || logoNode !== null || tools !== null
    const topbar = barred
      ? header(
        { class: 'region topbar' },
        hamburger,
        barLogo,
        barTitle,
        barBody,
        barTools,
      )
      : null

    const sidebarHere = span({ class: 'here' })
    const railToggle = el('button', {
      class: 'rail-toggle',
      type: 'button',
      'aria-expanded': 'true',
      events: { click: () => setRail(!railed) },
    }, railIcon())
    const sidebarLogo = div({ class: 'sidebar-logo' })
    const sidebarHead = div({ class: 'sidebar-head' }, sidebarLogo, sidebarHere, railToggle)
    const sidebarExtras = sidebarData?.extras === undefined || sidebarData.extras === null
      ? null
      : div({ class: 'extras' }, sidebarData.extras)
    const sidebarExtrasSlot = div({ class: 'sidebar-extras' })
    const footerList = el('ul', { class: 'footer' })
    const sidebarFoot = div({ class: 'sidebar-foot' })
    const sidebarNav = nav({ class: 'sidebar-body' })
    const sidebarRegion = div(
      { class: 'region sidebar' },
      sidebarHead,
      sidebarNav,
      sidebarExtrasSlot,
      sidebarFoot,
    )

    const mainRegion = main({ class: 'region main' }, ...children)
    const backdrop = props.background === undefined || props.background === null
      ? null
      : div({ class: 'backdrop', 'aria-hidden': 'true' }, props.background)
    const frameGap = props.gap === undefined || props.gap === null
      ? '0px'
      : toSpace(NAME, 'gap', 0)(props.gap)
    const gapped = frameGap !== '0px'

    const root = div(
      {
        class: [
          'shell',
          hasNavbar && 'has-navbar',
          foldable && 'foldable',
          gapped && 'gapped',
        ],
        events: props.events,
      },
      backdrop,
      topbar,
      sidebarRegion,
      mainRegion,
      bottomBar,
      moreSheet,
      drawer,
    )

    if (gapped) {
      root.style.setProperty('--frame-gap', frameGap)
      root.style.setProperty('--imp-shell-frame-gap', frameGap)
      root.style.setProperty('--imp-shell-frame-radius', token('radius-container'))
    }

    const desktopQuery = matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH})`)
    let desktop = desktopQuery.matches
    let signedIn = true
    let open = false
    let railed = false

    const state = {
      sections: [],
      section: null,
      item: null,
      built: [],
      sectionLinks: [],
      sectionSlots: [],
      footerItems: [],
      footerLinks: [],
      sectionsInBottomBar: false,
    }

    let placed = []

    const readValue = (value) => (isStateShaped(value) ? value.get() : value)

    const bottomBarItems = () => {
      const declared = parseInt(
        getComputedStyle(root).getPropertyValue(BOTTOM_BAR_ITEMS_PROPERTY),
        10,
      )
      if (!Number.isFinite(declared)) return DEFAULT_BOTTOM_BAR_ITEMS
      return Math.min(MAX_BOTTOM_BAR_ITEMS, Math.max(MIN_BOTTOM_BAR_ITEMS, declared))
    }

    const activeSection = () =>
      state.sections.find(({ id }) => id === state.section) ?? state.sections[0] ?? null

    const activeBuild = () => {
      if (!hasNavbar) return state.built[0] ?? null
      const section = activeSection()
      return state.built.find((entry) => entry.id === section?.id) ?? null
    }

    const sidebarGroups = () => activeBuild()?.groups ?? []

    const activeItem = () => {
      const flat = [...withChildren(flattenGroups(sidebarGroups())), ...state.footerItems]
      return flat.find(({ id }) => id === state.item) ?? null
    }

    const choose = (source, item) => {
      navActivate(source, item)
      if (sheetOpen) moreSheet.hidePopover()
      changeOpen(false, { notify: true })
    }

    const rowNode = (source, item, links, { child = false } = {}) => {
      const expandable = item.children.length > 0
      const link = navLinkNode(self, item, (chosen) => {
        if (expandable && !desktop && !sidebarNav.contains(link)) {
          openChildrenSheet(item)
          return
        }
        if (expandable) toggleExpanded(item.id)
        choose(source, chosen)
      }, { alwaysActive: expandable })
      if (expandable) {
        link.append(chevronIcon('caret'))
        link.setAttribute('aria-expanded', 'false')
      }
      links.push({ id: item.id, link })
      return el('li', { class: child ? 'child' : null }, link)
    }

    const groupNodes = (source, groups, links, slots, rows) =>
      groups.flatMap((group, index) => {
        const titleId = `group-${index}`
        const list = el('ul', group.label === null ? {} : { 'aria-labelledby': titleId })
        const order = []
        for (const item of group.items) {
          const row = rowNode(source, item, links)
          slots.push({ row, home: list, index: list.childElementCount })
          list.append(row)
          order.push(row)
          for (const kid of item.children) {
            const child = rowNode(source, kid, links, { child: true })
            child.hidden = true
            child.dataset.parent = item.id
            rows.push({ row: child, list, order, parent: item.id })
            list.append(child)
            order.push(child)
          }
        }
        if (group.label === null) return [list]
        return [
          div(
            { class: 'group-title', id: titleId },
            String(readValue(group.label) ?? ''),
            navTagNode(self, group.tag),
          ),
          list,
        ]
      })

    const paintCurrent = () => {
      const mark = (links, current) => {
        for (const { id, link } of links) {
          if (id === current) link.setAttribute('aria-current', 'page')
          else link.removeAttribute('aria-current')
        }
      }
      mark(state.sectionLinks, state.section)
      mark(state.footerLinks, state.item)
      for (const entry of state.built) mark(entry.links, state.item)
      const current = activeBuild()?.rows.find(({ row }) => row.querySelector('[aria-current]'))
      if (current && sheetChildren === null) setExpanded(current.parent, true)
    }

    const paintTitle = () => {
      const section = activeSection()
      const item = activeItem()
      const sectionLabel = section === null ? '' : String(readValue(section.label) ?? '')
      barOver.textContent = sectionLabel
      barNow.textContent = item === null ? sectionLabel : String(readValue(item.label) ?? '')
      sidebarHere.textContent = hasNavbar ? sectionLabel : ''
      const inSection = sidebarGroups().length > 0
      sheetTitle.textContent = inSection && hasNavbar && sectionLabel !== ''
        ? t(MORE_IN_KEY, { section: sectionLabel })
        : t(MORE_LABEL_KEY)
    }

    const paintNavbar = () => {
      if (!hasNavbar) return
      state.sectionLinks = []
      state.sectionSlots = []
      const list = el('ul')
      for (const section of state.sections) {
        const link = navLinkNode(self, section, (chosen) => choose(barNav, chosen), {
          alwaysActive: true,
        })
        state.sectionLinks.push({ id: section.id, link })
        const row = el('li', link)
        state.sectionSlots.push({ row, home: list, index: list.childElementCount })
        list.append(row)
      }
      barNav.replaceChildren(list)
    }

    const buildSidebars = (sections) => {
      state.built = sections.map((section) => {
        const links = []
        const slots = []
        const rows = []
        return {
          id: section.id,
          groups: section.groups,
          links,
          slots,
          rows,
          nodes: groupNodes(sidebarNav, section.groups, links, slots, rows),
        }
      })
    }

    const appWideColumn = () => sidebarExtras !== null || state.footerLinks.length > 0

    const railable = () => {
      const rows = [...flattenGroups(sidebarGroups()), ...state.footerItems]
      return rows.length > 0 && rows.every((row) => row.icon !== null)
    }

    const showSidebar = () => {
      const build = activeBuild()
      root.classList.toggle('has-sidebar', (build?.groups.length ?? 0) > 0 || appWideColumn())
      sidebarNav.replaceChildren(...(build?.nodes ?? []))
      const canRail = railable()
      railToggle.hidden = !canRail
      if (!canRail && railed) setRail(false)
    }

    const bottomSlots = () => {
      const own = activeBuild()?.slots ?? []
      state.sectionsInBottomBar = own.length === 0 && hasNavbar
      paintBottomBarName()
      return own.length > 0 ? own : hasNavbar ? state.sectionSlots : []
    }

    let sheetOpen = false

    let sheetChildren = null

    const restoreSheetChildren = () => {
      if (sheetChildren === null) return
      const { parent, kids, expanded, list, order } = sheetChildren
      sheetChildren = null
      parent.setAttribute('aria-expanded', expanded)
      const returning = new Set(kids.map(({ row }) => row))
      list.replaceChildren(
        ...order.filter((row) => row.parentElement === list || returning.has(row)),
      )
      for (const { row } of kids) row.hidden = expanded !== 'true'
      paintTitle()
    }

    function openChildrenSheet(item) {
      const build = activeBuild()
      const parent = build?.links.find(({ id }) => id === item.id)?.link
      const kids = build?.rows.filter((record) => record.parent === item.id) ?? []
      if (parent === undefined || kids.length === 0) return
      restoreSheetChildren()
      sheetChildren = {
        parent,
        kids,
        expanded: parent.getAttribute('aria-expanded') ?? 'false',
        list: kids[0].list,
        order: kids[0].order,
      }
      parent.setAttribute('aria-expanded', 'true')
      for (const { row } of kids) row.hidden = false
      sheetTitle.textContent = String(readValue(item.label) ?? '')
      sheetList.replaceChildren(...kids.map(({ row }) => row))
      if (!sheetOpen) moreSheet.showPopover()
    }

    const restorePlaced = () => {
      restoreSheetChildren()
      for (const { row, home, index } of placed) {
        home.insertBefore(row, home.children[index] ?? null)
      }
      placed = []
      moreItem.remove()
      barList.replaceChildren()
      sheetList.replaceChildren()
    }

    const placeBottom = () => {
      restorePlaced()
      const slots = bottomSlots()
      root.classList.toggle('has-bottom-bar', slots.length > 0)
      if (desktop || slots.length === 0) {
        if (sheetOpen) moreSheet.hidePopover()
        return
      }
      const cap = bottomBarItems()
      barList.replaceChildren(...slots.slice(0, cap).map(({ row }) => row))
      sheetList.replaceChildren(...slots.slice(cap).map(({ row }) => row))
      if (slots.length > cap) barList.append(moreItem)
      else if (sheetOpen) moreSheet.hidePopover()
      placed = slots
    }

    const showSection = () => {
      showSidebar()
      placeBottom()
      paintTitle()
      paintCurrent()
    }

    function setExpanded(id, next) {
      const parent = activeBuild()?.links.find((entry) => entry.id === id)?.link
      if (parent === undefined) return
      parent.setAttribute('aria-expanded', String(next))
      for (const { row, parent: owner } of activeBuild()?.rows ?? []) {
        if (owner === id) row.hidden = !next
      }
    }

    function toggleExpanded(id) {
      const parent = activeBuild()?.links.find((entry) => entry.id === id)?.link
      if (parent === undefined) return
      setExpanded(id, parent.getAttribute('aria-expanded') !== 'true')
    }

    const homeInto = (node, home) => {
      if (node !== null && node.parentElement !== home) home.append(node)
    }

    const placeChrome = () => {
      const sidebarChrome = !hasNavbar && signedIn && desktop
      root.classList.toggle('bar-away', sidebarChrome)
      const folded = !desktop && signedIn
      homeInto(logoNode, folded ? drawerLogo : sidebarChrome ? sidebarLogo : barLogo)
      homeInto(barNav, folded ? drawerNav : barBody)
      if (state.footerLinks.length > 0) homeInto(footerList, folded ? drawerFoot : sidebarFoot)
      else footerList.remove()
      homeInto(sidebarExtras, folded ? drawerTools : sidebarExtrasSlot)
      if (tools === null) return
      if (folded) return homeInto(tools, drawerTools)
      homeInto(tools, sidebarChrome ? sidebarFoot : barTools)
    }

    function setRail(next) {
      railed = Boolean(next)
      root.classList.toggle('rail', railed)
      railToggle.setAttribute('aria-expanded', String(!railed))
      railToggle.setAttribute('aria-label', t(railed ? EXPAND_KEY : COLLAPSE_KEY))
    }

    const openState = isStateShaped(props.navOpen) ? props.navOpen : null
    const overlay = foldable ? modalOverlay(drawer, { signal: self.abortSignal }) : null

    const paint = () => {
      if (!foldable) return
      hamburger.setAttribute('aria-expanded', String(open))
      if (!open) {
        overlay.close()
        return
      }
      if (drawer.isConnected) overlay.open()
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

    const navNames = { navbar: '', sidebar: '' }

    function paintBottomBarName() {
      const name = state.sectionsInBottomBar ? navNames.navbar : navNames.sidebar
      bottomBar.setAttribute('aria-label', name)
    }

    const nameNav = (level, nodes, label, fallbackKey) => {
      const write = (value) => {
        navNames[level] = value
        for (const node of nodes) node.setAttribute('aria-label', value)
        paintBottomBarName()
      }
      if (label === undefined) lang.watch(self, () => write(t(fallbackKey)))
      else bindValue(self, label, (value) => write(String(value)))
    }

    lang.watch(self, () => {
      paintTitle()
      if (foldable) {
        const label = t(NAV_LABEL_KEY)
        hamburger.setAttribute('aria-label', label)
        drawer.setAttribute('aria-label', label)
        drawerClose.setAttribute('aria-label', t(CLOSE_KEY))
      }
      sheetClose.setAttribute('aria-label', t(CLOSE_KEY))
      moreLabel.textContent = t(MORE_LABEL_KEY)
      railToggle.setAttribute('aria-label', t(railed ? EXPAND_KEY : COLLAPSE_KEY))
    })

    if (hasNavbar) nameNav('navbar', [barNav], navbarData.label, NAV_LABEL_KEY)
    nameNav('sidebar', [sidebarNav], sidebarData?.label, SECTION_LABEL_KEY)

    if (hasNavbar) {
      bindValue(self, navbarData.items ?? [], (value) => {
        state.sections = normalizeSections(value)
        paintNavbar()
        buildSidebars(state.sections)
        showSection()
      })
      bindValue(self, navbarData.selected, (value) => {
        state.section = value === undefined || value === null ? null : String(value)
        showSection()
      })
    } else if (sidebarData !== null) {
      bindValue(self, sidebarData.groups ?? sidebarData.items ?? [], (value) => {
        const groups = sidebarData.groups === undefined
          ? normalizeGroupList(undefined, value)
          : normalizeGroupList(value, undefined)
        buildSidebars([{ id: null, groups }])
        showSection()
      })
    }
    if (sidebarData !== null) {
      bindValue(self, sidebarData.footer, (value) => {
        state.footerLinks = []
        state.footerItems = value === undefined ? [] : normalizeNavItems(NAME, value)
        footerList.replaceChildren(...state.footerItems.map((item) => {
          const link = navLinkNode(self, item, (chosen) => choose(sidebarNav, chosen))
          state.footerLinks.push({ id: item.id, link })
          return el('li', link)
        }))
        showSidebar()
        placeChrome()
        paintTitle()
        paintCurrent()
      })
      bindValue(self, sidebarData.selected, (value) => {
        state.item = value === undefined || value === null ? null : String(value)
        paintTitle()
        paintCurrent()
      })
    }
    showSection()

    moreSheet.addEventListener('beforetoggle', (event) => {
      sheetOpen = event.newState === 'open'
      moreButton.setAttribute('aria-expanded', String(sheetOpen))
    })

    moreSheet.addEventListener('toggle', (event) => {
      if (event.newState === 'closed' && sheetChildren !== null) placeBottom()
    })

    drawer?.addEventListener('close', () => changeOpen(false, { notify: true }))

    self.afterPlacement = () => {
      placeBottom()
      if (foldable && open) overlay.open()
    }

    desktopQuery.addEventListener('change', (event) => {
      desktop = event.matches
      if (desktop) changeOpen(false, { notify: true })
      placeChrome()
      placeBottom()
      paintCurrent()
    }, { signal: self.abortSignal })

    bindValue(self, authed, (value) => {
      signedIn = Boolean(value)
      root.classList.toggle('signed-out', !signedIn)
      if (!signedIn) {
        if (sheetOpen) moreSheet.hidePopover()
        changeOpen(false, { notify: true })
      }
      placeChrome()
    })

    setRail(false)

    if (openState) {
      openState.watch(self, (value) => changeOpen(value, { notify: false }))
    } else if (props.navOpen !== undefined) changeOpen(props.navOpen, { notify: false })

    return root
  },
}

export const shell = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
