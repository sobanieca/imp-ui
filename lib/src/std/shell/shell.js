import { defineComponent } from '../shared/define.js'
import { dialog, div, el, header, main, nav, span } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { isStateShaped } from '../../render.js'
import { impLogger } from '../../logger.js'
import { computed } from '../../state.js'
import { isDescendant, mapNav, nodeOf } from '../../app-map.js'
import { bindValue, oneOf } from '../shared/args.js'
import { claimScreen, releaseScreen, SCREEN_EFFECTS } from '../../screen.js'
import { createToggle } from '../shared/toggle.js'
import { toSpace } from '../shared/layout.js'
import { breadcrumbs } from './breadcrumbs.js'
import { icon } from '../general/icon.js'
import { chevronIcon, closeIcon, menuIcon, moreIcon } from '../shared/icons.js'
import { luPanelLeft, luX } from '../../icons/lucide-icons.js'
import { token } from '../shared/css.js'
import { modalOverlay } from '../shared/overlay.js'
import { attachTooltip } from '../display/tooltip.js'
import { backdropNode } from '../shared/backdrop.js'
import {
  navActivate,
  navLinkNode,
  navTagNode,
  navTagNote,
  normalizeNavItems,
} from '../shared/nav-items.js'
import { shellStyles } from './shell-css.js'
import {
  flattenGroups,
  NAME,
  normalizeGroupList,
  normalizeKeyed,
  normalizeSections,
  readMap,
  toMaxWidth,
  withChildren,
  withIcons,
  withTags,
} from './shell-props.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'
import { closeOnTabOut } from '../shared/tab-out.js'

const KNOWN_PROPS = [
  'logo',
  'navbar',
  'sidebar',
  'extras',
  'breadcrumbs',
  'signIn',
  'navOpen',
  'background',
  'gap',
  'maxWidth',
  'effect',
  'events',
]

const NAVBAR_KEYS = ['label', 'items', 'selected', 'map', 'icons', 'tags', 'background']

const SIDEBAR_KEYS = ['label', 'groups', 'items', 'extras', 'footer', 'selected', 'background']

const NAV_TOGGLE_EVENT = 'navToggle'

const DRAWER_ID = 'nav-drawer'

const SHEET_ID = 'more-sheet'

const NAV_LABEL_KEY = 'imp.shell.nav'

const MENU_KEY = 'imp.shell.menu'

const SECTION_LABEL_KEY = 'imp.shell.section'

const MORE_LABEL_KEY = 'imp.shell.more'

const MORE_IN_KEY = 'imp.shell.moreIn'

const COLLAPSE_KEY = 'imp.shell.collapse'

const EXPAND_KEY = 'imp.shell.expand'

const CLOSE_KEY = 'imp.shell.close'

const SKIP_KEY = 'imp.shell.skip'

const messages = {
  [NAV_LABEL_KEY]: 'Navigation',
  [MENU_KEY]: 'Menu',
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

const readSignInNode = (map, handle) => {
  if (handle === undefined || handle === null) return null
  if (map === null) {
    impLogger.warn(`${NAME}: 'signIn' needs 'navbar.map' - it names a node of that map`)
    return null
  }
  const node = nodeOf(map, handle)
  if (node === null) {
    impLogger.warn(
      `${NAME}: 'signIn' is not a node of the navbar map - pass a handle like app.signIn`,
    )
  }
  return node
}

const definition = {
  styles: shellStyles,
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
    const trailDeep = trailShown ? computed([feed.current], (c) => c.crumbs.length > 1) : null

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
    closeOnTabOut(moreSheet)
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
    const content = [...mainRegion.childNodes].filter((node) => node !== trail)
    claimScreen(mainRegion, oneOf(NAME, 'effect', props.effect, SCREEN_EFFECTS, 'none'))
    self.abortSignal.addEventListener('abort', () => releaseScreen(mainRegion))
    const signInNode = readSignInNode(map, props.signIn)
    const gateLogo = div({ class: 'gate-logo' })
    const gateBody = div({ class: 'gate-body' })
    const gate = main({ class: 'region gate', tabindex: '-1' }, gateLogo, gateBody)
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

    const frameNodes = [skipLink, topbar, sidebarRegion, mainRegion, bottomBar, moreSheet, drawer]
      .filter((node) => node !== null)
    const root = div(
      {
        class: [
          'shell',
          hasNavbar && 'has-navbar',
          foldable && 'foldable',
          gapped && 'gapped',
          limited && 'limited',
        ],
        events: props.events,
      },
      backdrop,
      ...frameNodes,
    )

    if (trailDeep !== null) {
      trailDeep.watch(self, (deep) => {
        trail.hidden = !deep
        root.classList.toggle('has-trail', deep)
      })
    }
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
        const noteId = navTagNote(group.tag)
        if (noteId !== null) list.setAttribute('aria-describedby', noteId)
        return [
          div(
            { class: 'group-title', id: titleId },
            String(readValue(group.label) ?? ''),
            navTagNode(self, group.tag, noteId),
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
      titleLinks.clear()
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

    const titleLinks = new Map()

    const sheetTitleNode = (item) => {
      if (item.href === null) return String(readValue(item.label) ?? '')
      if (!titleLinks.has(item.id)) {
        const link = navLinkNode(self, { ...item, icon: null, children: [] }, (chosen) => {
          choose(sidebarNav, chosen)
        })
        link.classList.add('title-link')
        link.append(chevronIcon('caret'))
        titleLinks.set(item.id, link)
      }
      const link = titleLinks.get(item.id)
      if (state.item === item.id) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
      return link
    }

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
      sheetTitle.replaceChildren(sheetTitleNode(item))
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

    const hideEmptyBarNav = () => {
      if (barNav !== null) barNav.hidden = barNav.querySelector('li') === null
    }

    const placeBottom = () => {
      restorePlaced()
      const slots = bottomSlots()
      root.classList.toggle('has-bottom-bar', slots.length > 0)
      if (desktop || slots.length === 0) {
        if (sheetOpen) moreSheet.hidePopover()
        return hideEmptyBarNav()
      }
      const cap = bottomBarItems()
      barList.replaceChildren(...slots.slice(0, cap).map(({ row }) => row))
      sheetList.replaceChildren(...slots.slice(cap).map(({ row }) => row))
      if (slots.length > cap) barList.append(moreItem)
      else if (sheetOpen) moreSheet.hidePopover()
      placed = slots
      hideEmptyBarNav()
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

    let bare = false

    const placeGate = () => {
      if (!bare) {
        gate.remove()
        for (const node of frameNodes) homeInto(node, root)
        for (const node of content) homeInto(node, mainRegion)
        return
      }
      for (const node of frameNodes) node.remove()
      if (sheetOpen) moreSheet.hidePopover()
      opened.change(false, { notify: true })
      for (const node of content) homeInto(node, gateBody)
      homeInto(gate, root)
    }

    const bareFor = (current) => {
      if (current.waiting) return true
      if (signInNode === null || current.pattern === null) return false
      return isDescendant(nodeOf(map, current.pattern), signInNode)
    }

    let layoutKnown = false
    let waited = false

    const placeLayout = (current) => {
      if (current.leaving) return
      if (current.pattern === null && !current.waiting) return
      const next = bareFor(current)
      const moveFocus = layoutKnown && !waited
      layoutKnown = true
      waited = current.waiting
      if (next === bare) return
      bare = next
      root.classList.toggle('bare', bare)
      placeGate()
      placeChrome()
      if (!bare) placeBottom()
      if (moveFocus) (bare ? gate : mainRegion).focus({ preventScroll: true })
    }

    const placeChrome = () => {
      const sidebarChrome = !barShown() && desktop
      root.classList.toggle('bar-away', sidebarChrome)
      const folded = !desktop
      if (bare) homeInto(logoNode, gateLogo)
      else homeInto(logoNode, folded ? drawerLogo : sidebarChrome ? sidebarLogo : barLogo)
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

    const overlay = foldable
      ? modalOverlay(drawer, {
        signal: self.abortSignal,
        onClose: () => opened.change(false, { notify: true }),
      })
      : null

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
        const label = t(MENU_KEY)
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
        placeLayout(current)
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
