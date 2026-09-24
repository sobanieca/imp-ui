import { defineComponent } from '../shared/define.js'
import { dialog, div, el, header, main, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { computed } from '../../state.js'
import { isAppMap, mapNav } from '../../app-map.js'
import { bindValue } from '../shared/args.js'
import { createToggle } from '../shared/toggle.js'
import { toSpace } from '../shared/layout.js'
import { breadcrumbs } from '../shell/breadcrumbs.js'
import { icon } from '../general/icon.js'
import { chevronIcon, closeIcon, menuIcon, moreIcon } from '../shared/icons.js'
import { luPanelLeft, luX } from '../../icons/lucide-icons.js'
import {
  focusRing,
  fontFamily,
  forcedColors,
  quietScrollbar,
  token,
  visuallyHidden,
} from '../shared/css.js'
import { modalOverlay, overlayMotion, overlayScrim } from '../shared/overlay.js'
import { attachTooltip, tooltipStyles } from '../display/tooltip.js'
import { backdropNode, backdropStyles } from '../shared/backdrop.js'
import {
  navActivate,
  navLinkNode,
  navLinkStyles,
  navTagNode,
  normalizeNavItems,
  normalizeNavTag,
} from '../shared/nav-items.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'

const NAME = 'shell'

const KNOWN_PROPS = [
  'logo',
  'navbar',
  'sidebar',
  'extras',
  'breadcrumbs',
  'navOpen',
  'background',
  'gap',
  'maxWidth',
  'events',
]

const DEFAULT_MAX_WIDTH = '125rem'

const NAVBAR_KEYS = ['label', 'items', 'selected', 'map', 'icons', 'tags', 'background']

const SIDEBAR_KEYS = ['label', 'groups', 'items', 'extras', 'footer', 'selected', 'background']

const NAV_TOGGLE_EVENT = 'navToggle'

const DRAWER_ID = 'nav-drawer'

const SHEET_ANCHOR = '--imp-shell-sheet'

const SHEET_ID = 'more-sheet'

const NAV_LABEL_KEY = 'imp.shell.nav'

const SECTION_LABEL_KEY = 'imp.shell.section'

const MORE_LABEL_KEY = 'imp.shell.more'

const MORE_IN_KEY = 'imp.shell.moreIn'

const COLLAPSE_KEY = 'imp.shell.collapse'

const EXPAND_KEY = 'imp.shell.expand'

const CLOSE_KEY = 'imp.shell.close'

const SKIP_KEY = 'imp.shell.skip'

const messages = {
  [NAV_LABEL_KEY]: 'Navigation',
  [SECTION_LABEL_KEY]: 'Section',
  [MORE_LABEL_KEY]: 'More',
  [MORE_IN_KEY]: 'More in {section}',
  [COLLAPSE_KEY]: 'Collapse the sidebar',
  [EXPAND_KEY]: 'Expand the sidebar',
  [CLOSE_KEY]: 'Close',
  [SKIP_KEY]: 'Skip to the content',
}

const BOTTOM_BAR_ITEMS_PROPERTY = '--imp-shell-bottom-bar-items'

const DEFAULT_BOTTOM_BAR_ITEMS = 4

const MIN_BOTTOM_BAR_ITEMS = 3

const MAX_BOTTOM_BAR_ITEMS = 5

const HEAD_BLOCK_SIZE = '3.5rem'

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
    grid-template-columns: var(--frame-gap) var(--sidebar-track) minmax(0, 1fr) var(--frame-gap);
    grid-template-rows: auto minmax(0, 1fr) auto;
    box-sizing: border-box;
    block-size: 100%;
    padding-block: var(--frame-gap);
    ${fontFamily()}
    background: ${token('background-app')};
    color: ${token('color-text')};
  }

  .shell.limited {
    grid-template-columns:
      minmax(var(--frame-gap), 1fr)
      var(--sidebar-track)
      minmax(0, calc(var(--page-max) - var(--sidebar-track)))
      minmax(var(--frame-gap), 1fr);
  }

  ${backdropStyles()}

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
    grid-column: 1 / -1;
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: subgrid;
    border-block-end: ${token('border-width')} solid ${token('color-border')};
    background-color: ${token('color-surface-sunken')};
  }

  .bar {
    grid-column: 2 / 4;
    display: flex;
    align-items: center;
    gap: ${token('space-3')};
    min-inline-size: 0;
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-3')};
  }

  .shell.gapped .topbar { grid-column: 2 / 4 }

  .shell.gapped .bar { grid-column: 1 / -1 }

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
    font-weight: ${token('font-weight-bold')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .main {
    grid-row: 2;
    grid-column: 2 / 4;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: ${token('space-4')};
  }

  .trail {
    display: flex;
    align-items: center;
    flex: none;
    box-sizing: border-box;
    min-block-size: calc(${HEAD_BLOCK_SIZE} - ${token('space-4')} - ${token('space-3')});
    margin-block-end: ${token('space-3')};
  }

  .shell.gapped .trail {
    min-block-size: calc(
      ${HEAD_BLOCK_SIZE} + ${token('border-width')} - ${token('space-4')} - ${token('space-3')}
    );
  }

  .trail:empty { display: none }

  .sidebar,
  .bottombar {
    display: none;
    background-color: ${token('color-surface-sunken')};
  }

  .sidebar {
    position: relative;
    isolation: isolate;
    flex-direction: column;
    overflow: hidden;
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .sidebar-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    flex: none;
    box-sizing: border-box;
    min-block-size: ${HEAD_BLOCK_SIZE};
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

  .sidebar-body,
  .drawer-nav,
  .sheet {
    ${quietScrollbar()}
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

  @media (prefers-reduced-motion: reduce) {
    .caret { transition: none }
  }

  .link[aria-expanded='true'] .caret { rotate: 90deg }

  .link:dir(rtl) .caret { rotate: 180deg }

  .link[aria-expanded='true']:dir(rtl) .caret { rotate: 90deg }

  .tag ~ .caret { margin-inline-start: 0 }

  .shell.rail .sidebar-body .label,
  .shell.rail .sidebar-foot .label {${visuallyHidden}}

  .shell.rail .sidebar-body .tag,
  .shell.rail .sidebar-body .caret,
  .shell.rail .sidebar-body .group-title,
  .shell.rail .sidebar-body .child,
  .shell.rail .sidebar-head .here,
  .shell.rail .sidebar-logo,
  .shell.rail .sidebar-extras,
  .shell.rail .sidebar-foot .tools {
    display: none;
  }

  ${tooltipStyles()}

  .shell.rail .sidebar-foot:not(:has(.footer)) { display: none }

  .shell.rail .sidebar-head .rail-toggle { margin-inline: auto }

  .shell.rail .sidebar-body .link,
  .shell.rail .sidebar-foot .link {
    justify-content: center;
    padding-inline: 0;
  }

  .bottombar {
    grid-row: 3;
    grid-column: 2 / 4;
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
    box-sizing: border-box;
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
  .rail-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    margin: 0;
    padding: 0;
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .hamburger {
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
  .rail-toggle:hover {
    background-color: ${token('color-surface-hover')};
  }

  .hamburger:focus-visible,
  .rail-toggle:focus-visible {${focusRing()}}

  .hamburger { display: none }

  .skip {
    position: absolute;
    inset-block-start: ${token('space-2')};
    inset-inline-start: ${token('space-2')};
    z-index: 3;
    padding: ${token('space-2')} ${token('space-3')};
    border-radius: ${token('radius-item')};
    background-color: ${token('color-primary')};
    color: ${token('color-on-primary')};
    font-weight: ${token('font-weight-bold')};
    text-decoration: none;
    ${visuallyHidden}
  }

  .skip:focus {
    ${focusRing()}
    position: absolute;
    inline-size: auto;
    block-size: auto;
    margin: 0;
    overflow: visible;
    clip-path: none;
    white-space: normal;
  }

  .main:focus { outline: none }

  .icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }

  .sheet-anchor { anchor-name: ${SHEET_ANCHOR} }

  .sheet {
    position: fixed;
    position-anchor: ${SHEET_ANCHOR};
    position-area: block-start;
    position-try-fallbacks: block-start span-inline-end, block-start span-inline-start;
    position-visibility: anchors-visible;
    inset: auto;
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: 12rem;
    max-inline-size: calc(100dvi - ${token('space-4')} * 2);
    max-block-size: 60dvb;
    margin: ${token('space-2')};
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-container')};
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
    box-shadow: ${token('shadow-md')};
    overflow: auto;
    overscroll-behavior: contain;
  }

  .sheet::backdrop { background-color: transparent }

  .sheet:not(:popover-open) { display: none }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    padding-inline-start: ${token('space-2')};
    margin-block-end: ${token('space-1')};
  }

  .sheet-head .title {
    font-size: ${token('font-size-sm')};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${token('color-primary')};
  }

  .sheet-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: 2rem;
    block-size: 2rem;
    margin: 0;
    margin-inline-start: auto;
    padding: 0;
    border: none;
    border-radius: ${token('radius-item')};
    background-color: transparent;
    color: ${token('color-secondary')};
    cursor: pointer;
  }

  .sheet-close:hover {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-text')};
  }

  .sheet-close:focus-visible {${focusRing()}}

  .sheet ul {
    display: grid;
    grid-template-columns: 1fr;
    gap: ${token('space-1')};
  }

  .sheet .link {
    min-block-size: 2rem;
    padding-block: ${token('space-2')};
    border: none;
    border-radius: ${token('radius-item')};
  }

  .sheet .link[aria-current] {
    background-color: ${token('color-surface-hover')};
    color: ${token('color-primary')};
  }

  .sheet .child .link { padding-inline-start: ${token('space-3')} }

  .drawer {
    --overlay-offset: -100% 0;
    isolation: isolate;
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

  .shell.gapped:not(.has-trail) .main { padding-block-start: 0 }

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
    .shell.has-bottom-bar .bottombar { display: block }
    .shell.foldable .hamburger { display: inline-flex }
    .bar-title { display: flex }
    .topbar .bar-logo { display: none }
    .trail { display: none }
    .shell.gapped .main { padding-block-start: 0 }
  }

  @media (min-width: ${DESKTOP_MIN_WIDTH}) {
    .shell.has-sidebar {
      --sidebar-track: calc(var(--imp-shell-sidebar-inline-size, 16rem) + var(--frame-gap));
    }

    .shell.has-sidebar.rail { --sidebar-track: calc(3.75rem + var(--frame-gap)) }

    .bar { padding-inline: ${token('space-4')} }

    .shell.bar-away .topbar { display: none }
    .shell.has-sidebar .sidebar { display: flex; grid-row: 2; grid-column: 2 }
    .main { grid-column: 3 }
  }

  ${forcedColors}

  @media (forced-colors: active) {
    .bar-body .link[aria-current] { border-block-end-color: Highlight }
    .sidebar-body .link[aria-current] { border-inline-start-color: Highlight }
    .bottombar .link[aria-current] { border-block-start-color: Highlight }
  }

  .sr-only {${visuallyHidden}}
`

const toMaxWidth = (value) => {
  if (value === undefined || value === null) return DEFAULT_MAX_WIDTH
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  impLogger.warn(
    `${NAME}: 'maxWidth' must be a CSS length such as '90rem', or 'none' - got '${value}', using '${DEFAULT_MAX_WIDTH}'`,
  )
  return DEFAULT_MAX_WIDTH
}

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

const readMap = (navbarData) => {
  const value = navbarData?.map
  if (value === undefined || value === null) return null
  if (!isAppMap(value)) {
    impLogger.warn(`${NAME}: 'navbar.map' must be the value appMap() returned - ignoring it`)
    return null
  }
  return value
}

const iconNode = (value) => {
  if (value === undefined || value === null) return null
  return typeof value.nodeType === 'number' ? value : icon(value)
}

const tagValue = (raw) => {
  const value = isStateShaped(raw) ? raw.get() : raw
  if (value === undefined || value === null) return null
  if (typeof value === 'object') {
    return value.text === undefined || value.text === null
      ? null
      : { text: value.text, color: value.color }
  }
  return { text: value }
}

const withTags = (sections, tags) => {
  const tagged = (row) => ({
    ...row,
    tag: tagValue(tags[row.id]),
    children: row.children.map(tagged),
  })
  return sections.map((section) => ({
    ...section,
    tag: tagValue(tags[section.id]),
    groups: section.groups.map((group) => ({ ...group, items: group.items.map(tagged) })),
  }))
}

const withIcons = (sections, icons) => {
  const iconed = (row) => ({
    ...row,
    icon: iconNode(icons[row.id]),
    children: row.children.map(iconed),
  })
  return sections.map((section) => ({
    ...section,
    icon: iconNode(icons[section.id]),
    groups: section.groups.map((group) => ({ ...group, items: group.items.map(iconed) })),
  }))
}

const withChildren = (items) =>
  items.flatMap((item) => [item, ...item.children.map((child) => ({ ...child, parent: item }))])

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (self) => self.afterPlacement(),
  setup: (self, props, children) => {
    const navbarData = normalizeKeyed('navbar', NAVBAR_KEYS, props.navbar)
    const sidebarData = normalizeKeyed('sidebar', SIDEBAR_KEYS, props.sidebar)
    const hasNavbar = navbarData !== null
    const map = readMap(navbarData)
    const hasMap = map !== null
    let barless = false
    const barShown = () => hasNavbar && !barless

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
    if (hasMap) {
      for (const key of ['items', 'selected']) {
        if (navbarData[key] !== undefined) {
          impLogger.warn(`${NAME}: 'navbar.${key}' is ignored beside a 'map' - the map derives it`)
          delete navbarData[key]
        }
      }
      if (sidebarData?.selected !== undefined) {
        impLogger.warn(`${NAME}: 'sidebar.selected' is ignored beside a 'map' - the map derives it`)
        delete sidebarData.selected
      }
    }

    const tools = props.extras !== undefined && props.extras !== null
      ? div({ class: 'tools' }, props.extras)
      : null
    const logoNode = props.logo ?? null
    const trailShown = hasMap && props.breadcrumbs !== false
    const feed = hasMap ? mapNav(map) : null
    const trail = trailShown
      ? div({ class: 'trail' }, breadcrumbs({ items: computed([feed.current], (c) => c.crumbs) }))
      : null

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
        events: { click: () => opened.change(!opened.get(), { notify: true }) },
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
        events: { click: () => opened.change(false, { notify: true }) },
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
    }, icon(luX, { size: 'sm' }))
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

    const barBackdrop = backdropNode(navbarData?.background)
    const barred = hasNavbar || sidebarData !== null || logoNode !== null || tools !== null
    const topbar = barred
      ? header(
        { class: 'region topbar' },
        barBackdrop,
        div({ class: 'bar' }, hamburger, barLogo, barTitle, barBody, barTools),
      )
      : null

    const sidebarHere = span({ class: 'here' })
    const railToggle = el('button', {
      class: 'rail-toggle',
      type: 'button',
      'aria-expanded': 'true',
      events: { click: () => setRail(!railed) },
    }, icon(luPanelLeft, { size: 'md' }))
    const sidebarLogo = div({ class: 'sidebar-logo' })
    const sidebarHead = div({ class: 'sidebar-head' }, sidebarLogo, sidebarHere, railToggle)
    const sidebarExtras = sidebarData?.extras === undefined || sidebarData.extras === null
      ? null
      : div({ class: 'extras' }, sidebarData.extras)
    const sidebarExtrasSlot = div({ class: 'sidebar-extras' })
    const footerList = el('ul', { class: 'footer' })
    const sidebarFoot = div({ class: 'sidebar-foot' })
    const sidebarNav = nav({ class: 'sidebar-body' })
    const sidebarBackdrop = backdropNode(sidebarData?.background)
    const sidebarRegion = div(
      { class: 'region sidebar' },
      sidebarBackdrop,
      sidebarHead,
      sidebarNav,
      sidebarExtrasSlot,
      sidebarFoot,
    )

    const mainRegion = main({ class: 'region main', tabindex: '-1' }, trail, ...children)
    const skipLink = el('a', {
      class: 'skip',
      href: '#main',
      events: {
        click: (event) => {
          event.preventDefault()
          mainRegion.focus()
        },
      },
    })
    const backdrop = backdropNode(props.background)
    const frameGap = props.gap === undefined || props.gap === null
      ? '0px'
      : toSpace(NAME, 'gap', 0)(props.gap)
    const gapped = frameGap !== '0px'
    const maxWidth = toMaxWidth(props.maxWidth)
    const limited = maxWidth !== 'none'

    const root = div(
      {
        class: [
          'shell',
          hasNavbar && 'has-navbar',
          trailShown && 'has-trail',
          foldable && 'foldable',
          gapped && 'gapped',
          limited && 'limited',
        ],
        events: props.events,
      },
      backdrop,
      skipLink,
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
    if (limited) {
      root.style.setProperty('--page-max', maxWidth)
      root.style.setProperty(
        '--imp-shell-frame-inset',
        `max(${frameGap}, calc((100% - ${maxWidth}) / 2))`,
      )
    } else if (gapped) {
      root.style.setProperty('--imp-shell-frame-inset', frameGap)
    }

    const desktopQuery = matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH})`)
    let desktop = desktopQuery.matches
    let railed = false

    const state = {
      sections: [],
      section: null,
      item: null,
      context: null,
      crumbs: [],
      built: [],
      sectionLinks: [],
      sectionSlots: [],
      footerItems: [],
      footerLinks: [],
      sectionsInBottomBar: false,
      revealedFor: null,
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
      if (!barShown()) return state.built[0] ?? null
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
      opened.change(false, { notify: true })
    }

    const railTooltip = (link, item) =>
      attachTooltip(self, link, item.label, { enabled: () => railed && desktop })

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
      return el('li', { class: child ? 'child' : null }, link, railTooltip(link, item))
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
      const build = activeBuild()
      const current = build?.rows.find(({ row }) => row.querySelector('[aria-current]'))
      if (!current || sheetChildren !== null) return
      const revealed = `${build.id}/${current.parent}`
      if (state.revealedFor === revealed) return
      state.revealedFor = revealed
      setExpanded(current.parent, true)
    }

    const paintTitle = () => {
      const section = activeSection()
      const item = activeItem()
      const sectionLabel = section === null ? '' : String(readValue(section.label) ?? '')
      const now = state.crumbs.at(-1)?.label
      const over = state.crumbs.at(-2)?.label
      barOver.textContent = over ?? sectionLabel
      barNow.textContent = now ??
        (item === null ? sectionLabel : String(readValue(item.label) ?? ''))
      sidebarHere.textContent = barShown() ? state.context ?? sectionLabel : ''
      const inSection = sidebarGroups().length > 0
      sheetTitle.textContent = inSection && barShown() && sectionLabel !== ''
        ? t(MORE_IN_KEY, { section: sectionLabel })
        : t(MORE_LABEL_KEY)
    }

    const paintNavbar = () => {
      if (!barShown()) return
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
      state.revealedFor = null
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
      state.sectionsInBottomBar = own.length === 0 && barShown()
      paintBottomBarName()
      return own.length > 0 ? own : barShown() ? state.sectionSlots : []
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
      const sidebarChrome = !barShown() && desktop
      root.classList.toggle('bar-away', sidebarChrome)
      const folded = !desktop
      homeInto(logoNode, folded ? drawerLogo : sidebarChrome ? sidebarLogo : barLogo)
      homeInto(barNav, folded ? drawerNav : barBody)
      if (state.footerLinks.length > 0) homeInto(footerList, folded ? drawerFoot : sidebarFoot)
      else footerList.remove()
      homeInto(sidebarExtras, folded ? drawerTools : sidebarExtrasSlot)
      homeInto(sidebarBackdrop, folded && drawer !== null ? drawer : sidebarRegion)
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

    const overlay = foldable ? modalOverlay(drawer, { signal: self.abortSignal }) : null

    const opened = createToggle(NAME, {
      prop: 'navOpen',
      source: props.navOpen,
      node: root,
      event: NAV_TOGGLE_EVENT,
      detail: 'open',
      paint: (open) => {
        if (!foldable) return
        hamburger.setAttribute('aria-expanded', String(open))
        if (!open) overlay.close()
        else if (drawer.isConnected) overlay.open()
      },
    })

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
      skipLink.textContent = t(SKIP_KEY)
      moreLabel.textContent = t(MORE_LABEL_KEY)
      railToggle.setAttribute('aria-label', t(railed ? EXPAND_KEY : COLLAPSE_KEY))
    })

    if (hasNavbar) nameNav('navbar', [barNav], navbarData.label, NAV_LABEL_KEY)
    nameNav('sidebar', [sidebarNav], sidebarData?.label, SECTION_LABEL_KEY)

    if (hasMap) {
      const icons = navbarData.icons ?? {}
      const tags = navbarData.tags ?? {}
      const tagStates = Object.values(tags).filter(isStateShaped)
      const taggedTree = computed(
        [feed.tree, ...tagStates],
        (sections) => withTags(sections, tags),
      )
      taggedTree.watch(self, (sections) => {
        state.sections = normalizeSections(withIcons(sections, icons))
        barless = state.sections.length === 1 && state.sections[0].groups.length > 0
        root.classList.toggle('has-navbar', barShown())
        paintNavbar()
        buildSidebars(state.sections)
        showSection()
        placeChrome()
      })
      feed.current.watch(self, (current) => {
        state.section = current.section
        state.item = current.item
        state.context = current.context
        state.crumbs = current.crumbs
        showSection()
      })
    } else if (hasNavbar) {
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
          return el('li', link, railTooltip(link, item))
        }))
        showSidebar()
        placeChrome()
        paintTitle()
        paintCurrent()
      })
      if (!hasMap) {
        bindValue(self, sidebarData.selected, (value) => {
          state.item = value === undefined || value === null ? null : String(value)
          paintTitle()
          paintCurrent()
        })
      }
    }
    showSection()

    let sheetAnchor = null

    const anchorSheet = (element) => {
      sheetAnchor?.classList.remove('sheet-anchor')
      sheetAnchor = element
      sheetAnchor.classList.add('sheet-anchor')
    }

    moreSheet.addEventListener('beforetoggle', (event) => {
      sheetOpen = event.newState === 'open'
      moreButton.setAttribute('aria-expanded', String(sheetOpen))
      if (sheetOpen) anchorSheet(sheetChildren === null ? moreButton : sheetChildren.parent)
    })

    moreSheet.addEventListener('toggle', (event) => {
      if (event.newState === 'closed' && sheetChildren !== null) placeBottom()
    })

    drawer?.addEventListener('close', () => opened.change(false, { notify: true }))

    self.afterPlacement = () => {
      placeBottom()
      if (foldable && opened.get()) overlay.open()
    }

    desktopQuery.addEventListener('change', (event) => {
      desktop = event.matches
      if (desktop) opened.change(false, { notify: true })
      placeChrome()
      placeBottom()
      paintCurrent()
    }, { signal: self.abortSignal })

    placeChrome()
    setRail(false)
    opened.follow(self)

    return root
  },
}

export const shell = (...args) =>
  defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
