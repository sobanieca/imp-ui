import { defineComponent } from '../shared/define.js'
import { aside, div, el } from '../../api/html.js'
import { defaultMessages, lang, t } from '../../api/i18n.js'
import { impLogger } from '../../logger.js'
import { bindValue, oneOf, peekProps } from '../shared/args.js'
import { focusRing, fontFamily, forcedColors, token } from '../shared/css.js'
import { chevronIcon } from '../shared/icons.js'
import { DESKTOP_MIN_WIDTH } from '../../theme.js'
import { DRAWER_CLOSE_EVENT, DRAWER_EVENT, SIDES, TAB_INDEX_PROPERTY } from './frame.js'

const NAME = 'sidebar'

const KNOWN_PROPS = [
  'side',
  'label',
  'width',
  'minWidth',
  'maxWidth',
  'resizable',
  'collapsible',
  'collapsed',
  'events',
]

const WIDTHS = ['xs', 'sm', 'md', 'lg', 'xl']

const NARROWEST = 'xs'

const WIDEST = 'xl'

const PANEL_ID = 'panel'

const RESIZE_STEP_PX = 16

const messages = {
  'imp.sidebar.label': 'Sidebar',
  'imp.sidebar.resize': 'Resize {name}',
}

const drawerQuery = () => `(width < ${DESKTOP_MIN_WIDTH})`

const styles = () => `
  .root {
    --drawer-size: min(var(--sidebar-size), 85vw);
    --resizer-size: 0px;
    ${fontFamily()}
    box-sizing: border-box;
    display: flex;
    flex: none;
    overflow: hidden;
    inline-size: var(--sidebar-size);
    background-color: ${token('color-surface')};
    color: ${token('color-text')};
  }

  .side-left {
    --chevron: -1;
    border-inline-end: ${token('border-width')} solid ${token('color-border')};
  }

  .side-right {
    --chevron: 1;
    border-inline-start: ${token('border-width')} solid ${token('color-border')};
  }

  .can-resize {
    --resizer-size: ${token('space-3')};
    min-inline-size: var(--sidebar-min);
    max-inline-size: var(--sidebar-max);
  }

  .is-collapsed {
    --resizer-size: 0px;
    inline-size: ${token('sidebar-collapsed')};
    min-inline-size: 0;
    max-inline-size: none;
  }

  .is-resizing {
    user-select: none;
  }

  .side-left.is-collapsed {
    --chevron: 1;
  }

  .side-right.is-collapsed {
    --chevron: -1;
  }

  .frame {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
  }

  .resizer {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--resizer-size);
    cursor: col-resize;
    touch-action: none;
  }

  .resizer::before {
    content: '';
    inline-size: 2px;
    block-size: 2rem;
    border-radius: ${token('radius-full')};
    background-color: ${token('color-border')};
  }

  .side-right .resizer {
    order: -1;
  }

  .is-collapsed .resizer {
    display: none;
  }

  .resizer:hover::before,
  .is-resizing .resizer::before {
    background-color: ${token('color-primary')};
    block-size: 3rem;
  }

  .resizer:focus-visible {
    ${focusRing()}
    outline-offset: calc(-1 * ${token('focus-ring-width')});
  }

  .head {
    flex: none;
    display: none;
    justify-content: flex-end;
    padding: ${token('space-2')};
  }

  .can-collapse .head {
    display: flex;
  }

  .is-collapsed .head {
    justify-content: center;
    padding-inline: 0;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: ${token('space-2')};
    border: ${token('border-width')} solid ${token('color-border')};
    border-radius: ${token('radius-md')};
    background-color: transparent;
    color: ${token('color-text')};
    cursor: pointer;
  }

  .toggle:hover {
    background-color: ${token('color-surface-hover')};
  }

  .toggle:focus-visible {${focusRing()}}

  .icon {
    inline-size: 1.25em;
    block-size: 1.25em;
    scale: var(--chevron, 1) 1;
  }

  :host(:dir(rtl)) .icon {
    scale: calc(var(--chevron, 1) * -1) 1;
  }

  .panel {
    flex: 1;
    min-block-size: 0;
    box-sizing: border-box;
    inline-size: calc(var(--sidebar-size) - var(--resizer-size));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-inline: ${token('space-3')};
    padding-block-end: ${token('space-3')};
  }

  .panel:focus-visible {${focusRing()}}

  .panel[inert] {
    visibility: hidden;
  }

  @media (prefers-reduced-motion: no-preference) {
    .root {
      transition: inline-size ${token('duration-medium')} ease;
    }

    .is-resizing {
      transition: none;
    }

    .resizer::before {
      transition: block-size ${token('duration-fast')} ease;
    }

    .icon {
      transition: scale ${token('duration-fast')} ease;
    }
  }

  @media ${drawerQuery()} {
    .root,
    .is-collapsed {
      inline-size: 0;
      min-inline-size: 0;
      max-inline-size: none;
      overflow: visible;
      border: none;
      background-color: transparent;
      transition: none;
    }

    .resizer {
      display: none;
    }

    .frame {
      position: fixed;
      z-index: 41;
      inset-block: 0;
      inline-size: var(--drawer-size);
      background-color: ${token('color-surface')};
      box-shadow: ${token('shadow-lg')};
    }

    .side-left .frame {
      inset-inline-start: calc(-1 * var(--drawer-size));
    }

    .side-right .frame {
      inset-inline-end: calc(-1 * var(--drawer-size));
    }

    .is-open .frame {
      z-index: 44;
    }

    .side-left.is-open .frame {
      inset-inline-start: 0;
    }

    .side-right.is-open .frame {
      inset-inline-end: 0;
    }

    .head,
    .can-collapse .head,
    .is-collapsed .head {
      display: flex;
      position: absolute;
      justify-content: flex-start;
      inset-block-start: 50%;
      padding: 0;
      translate: 0 calc(-50% + var(${TAB_INDEX_PROPERTY}, 0) * 3.25rem);
    }

    .side-left .head {
      inset-inline-start: 100%;
    }

    .side-right .head {
      inset-inline-end: 100%;
    }

    .toggle {
      background-color: ${token('color-surface')};
      box-shadow: ${token('shadow-md')};
    }

    .side-left .toggle {
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }

    .side-right .toggle {
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }

    .panel {
      inline-size: 100%;
      padding-block-start: ${token('space-3')};
    }

    .panel[inert] {
      visibility: visible;
    }
  }

  @media ${drawerQuery()} and (prefers-reduced-motion: no-preference) {
    .frame {
      transition: inset-inline-start ${token('duration-medium')} ease,
        inset-inline-end ${token('duration-medium')} ease;
    }
  }

  @media (forced-colors: active) {
    .resizer::before {
      background-color: ButtonBorder;
    }
  }

  ${forcedColors}
`

const outsideRange = (width, minWidth, maxWidth) =>
  WIDTHS.indexOf(width) < WIDTHS.indexOf(minWidth) ||
  WIDTHS.indexOf(width) > WIDTHS.indexOf(maxWidth)

const resolveResize = (props, width) => {
  const resizable = props.resizable === true
  if (!resizable) {
    if (props.minWidth !== undefined || props.maxWidth !== undefined) {
      impLogger.warn(
        `${NAME}: 'minWidth' and 'maxWidth' need 'resizable: true' - without it the width stays at '${width}'`,
      )
    }
    return { resizable, minWidth: NARROWEST, maxWidth: WIDEST }
  }
  let minWidth = oneOf(NAME, 'minWidth', props.minWidth, WIDTHS, NARROWEST)
  let maxWidth = oneOf(NAME, 'maxWidth', props.maxWidth, WIDTHS, WIDEST)
  if (WIDTHS.indexOf(minWidth) > WIDTHS.indexOf(maxWidth)) {
    impLogger.warn(
      `${NAME}: 'minWidth' '${minWidth}' is wider than 'maxWidth' '${maxWidth}' - using the whole '${NARROWEST}' to '${WIDEST}' range`,
    )
    minWidth = NARROWEST
    maxWidth = WIDEST
  }
  if (outsideRange(width, minWidth, maxWidth)) {
    impLogger.warn(
      `${NAME}: 'width' '${width}' is outside the '${minWidth}' to '${maxWidth}' resize range - the sidebar opens at the nearest end of it`,
    )
  }
  return { resizable, minWidth, maxWidth }
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (instance, props, children) => {
    const side = instance.host.getAttribute('side')
    const width = oneOf(NAME, 'width', props.width, WIDTHS, 'md')
    const { resizable, minWidth, maxWidth } = resolveResize(props, width)
    const collapsible = props.collapsible !== false
    if (props.label === undefined) {
      impLogger.warn(
        `${NAME}: needs a 'label' - a sidebar is a landmark, and a page with more than one has to tell them apart`,
      )
    }

    const toggle = el('button', {
      class: 'toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': PANEL_ID,
    }, chevronIcon())
    const panel = aside({ class: 'panel', id: PANEL_ID, tabindex: '-1' }, ...children)
    const resizer = resizable
      ? div({
        class: 'resizer',
        role: 'separator',
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-controls': PANEL_ID,
      })
      : null
    const root = div(
      {
        class: [
          'root',
          `side-${side}`,
          collapsible ? 'can-collapse' : null,
          resizable ? 'can-resize' : null,
        ],
        events: props.events,
      },
      div({ class: 'frame' }, div({ class: 'head' }, toggle), panel),
      resizer,
    )
    const declaredSize = token(`sidebar-${width}`)
    root.style.setProperty('--sidebar-size', declaredSize)
    if (resizable) {
      root.style.setProperty('--sidebar-min', token(`sidebar-${minWidth}`))
      root.style.setProperty('--sidebar-max', token(`sidebar-${maxWidth}`))
    }

    const drawer = matchMedia(drawerQuery())
    let expanded = false
    let wanted = true
    let painted = false

    const paint = (next) => {
      expanded = next
      root.classList.toggle('is-collapsed', !next)
      root.classList.toggle('is-open', next)
      toggle.setAttribute('aria-expanded', String(next))
      panel.inert = !next
    }

    const notifyDrawer = (open) =>
      instance.host.dispatchEvent(
        new CustomEvent(DRAWER_EVENT, { detail: { open }, bubbles: true, composed: true }),
      )

    const setExpanded = (next, moveFocus) => {
      if (next === expanded) return
      paint(next)
      if (!drawer.matches) {
        wanted = next
        return
      }
      if (moveFocus) (next ? panel : toggle).focus()
      notifyDrawer(next)
    }

    bindValue(props.collapsed, (value) => {
      wanted = collapsible ? value !== true : true
      if (painted) {
        setExpanded(wanted, false)
        return
      }
      painted = true
      paint(drawer.matches ? false : wanted)
    })

    toggle.addEventListener('click', () => setExpanded(!expanded, true))

    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !expanded || !drawer.matches) return
      event.preventDefault()
      setExpanded(false, true)
    })

    root.addEventListener('select', () => {
      if (expanded && drawer.matches) setExpanded(false, false)
    })

    instance.host.addEventListener(DRAWER_CLOSE_EVENT, () => {
      if (expanded && drawer.matches) setExpanded(false, false)
    }, { signal: instance.abortSignal })

    drawer.addEventListener('change', ({ matches }) => {
      if (matches) {
        if (expanded) paint(false)
        return
      }
      if (expanded) notifyDrawer(false)
      paint(wanted)
    }, { signal: instance.abortSignal })

    if (resizable) {
      const fixedEdgeIsLeft = () =>
        instance.host.matches(':dir(rtl)') ? side === 'right' : side === 'left'

      const limits = () => {
        const style = getComputedStyle(root)
        const min = parseFloat(style.minInlineSize)
        const max = parseFloat(style.maxInlineSize)
        return { min: Number.isNaN(min) ? 0 : min, max: Number.isNaN(max) ? Infinity : max }
      }

      let size = null

      const resizeTo = (next) => {
        const { min, max } = limits()
        const clamped = Math.round(Math.min(Math.max(next, min), max))
        if (!Number.isFinite(clamped)) return
        size = clamped
        root.style.setProperty('--sidebar-size', `${clamped}px`)
      }

      const paintResizeValues = () => {
        if (!expanded || drawer.matches) return
        const { min, max } = limits()
        resizer.setAttribute('aria-valuemin', String(Math.round(min)))
        resizer.setAttribute('aria-valuemax', String(Math.round(max)))
        resizer.setAttribute(
          'aria-valuenow',
          String(Math.round(root.getBoundingClientRect().width)),
        )
      }

      const observer = new ResizeObserver(paintResizeValues)
      observer.observe(root)
      instance.abortSignal.addEventListener('abort', () => observer.disconnect())

      const reachOf = (clientX) => {
        const box = root.getBoundingClientRect()
        return fixedEdgeIsLeft() ? clientX - box.left : box.right - clientX
      }

      let grab = 0

      resizer.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary) return
        event.preventDefault()
        grab = reachOf(event.clientX) - root.getBoundingClientRect().width
        resizer.setPointerCapture(event.pointerId)
        root.classList.add('is-resizing')
      })

      resizer.addEventListener('pointermove', (event) => {
        if (!resizer.hasPointerCapture(event.pointerId)) return
        resizeTo(reachOf(event.clientX) - grab)
      })

      const stopResizing = (event) => {
        if (!resizer.hasPointerCapture(event.pointerId)) return
        resizer.releasePointerCapture(event.pointerId)
        root.classList.remove('is-resizing')
      }

      resizer.addEventListener('pointerup', stopResizing)
      resizer.addEventListener('pointercancel', stopResizing)

      resizer.addEventListener('dblclick', () => {
        size = null
        root.style.setProperty('--sidebar-size', declaredSize)
      })

      resizer.addEventListener('keydown', (event) => {
        const towardsWider = fixedEdgeIsLeft() ? 1 : -1
        const current = size ?? root.getBoundingClientRect().width
        if (event.key === 'ArrowRight') resizeTo(current + towardsWider * RESIZE_STEP_PX)
        else if (event.key === 'ArrowLeft') resizeTo(current - towardsWider * RESIZE_STEP_PX)
        else if (event.key === 'Home') resizeTo(-Infinity)
        else if (event.key === 'End') resizeTo(Infinity)
        else return
        event.preventDefault()
        root.classList.add('is-resizing')
      })

      resizer.addEventListener('keyup', () => root.classList.remove('is-resizing'))
      resizer.addEventListener('blur', () => root.classList.remove('is-resizing'))
    }

    let label = props.label
    const paintLabel = () => {
      const name = label === undefined ? t('imp.sidebar.label') : String(label)
      panel.setAttribute('aria-label', name)
      toggle.setAttribute('aria-label', name)
      resizer?.setAttribute('aria-label', t('imp.sidebar.resize', { name }))
    }
    bindValue(props.label, (value) => {
      label = value
      paintLabel()
    })
    lang.watch(paintLabel)

    return root
  },
}

export const sidebar = (...args) => {
  const host = defineComponent(NAME, () => definition, () => defaultMessages(messages))(...args)
  host.setAttribute('side', oneOf(NAME, 'side', peekProps(args).side, SIDES, 'left'))
  return host
}
