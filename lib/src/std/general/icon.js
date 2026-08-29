import { defineComponent } from '../shared/define.js'
import { bindValue, oneOf } from '../shared/args.js'
import { impLogger } from '../../logger.js'
import { SIZES } from '../shared/css.js'

const NAME = 'icon'

const KNOWN_PROPS = ['name', 'size', 'label']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const SIZE_LENGTHS = { sm: '1rem', md: '1.25rem', lg: '1.5rem' }

const GLYPHS = {
  'home': ['M3 11l9-7 9 7', 'M5 10v9h5v-6h4v6h5v-9'],
  'search': ['M11 4a7 7 0 100 14 7 7 0 100-14', 'M16.5 16.5L21 21'],
  'settings': [
    'M4 8h9',
    'M17 8h3',
    'M4 16h3',
    'M11 16h9',
    'M15 6a2 2 0 100 4 2 2 0 100-4',
    'M9 14a2 2 0 100 4 2 2 0 100-4',
  ],
  'user': ['M12 5a4 4 0 100 8 4 4 0 100-8', 'M4 20a8 8 0 0116 0'],
  'users': [
    'M8 5a3.5 3.5 0 100 7 3.5 3.5 0 100-7',
    'M2 20a6 6 0 0112 0',
    'M16 5.6a3.5 3.5 0 010 6.8',
    'M15 14.4a6 6 0 017 5.6',
  ],
  'bell': ['M6 9a6 6 0 1112 0v5l2 3H4l2-3z', 'M10 20a2 2 0 004 0'],
  'chart': ['M3 20h18', 'M5 20v-6', 'M12 20V6', 'M19 20v-9'],
  'grid': ['M4 4h7v7H4z', 'M13 4h7v5h-7z', 'M13 13h7v7h-7z', 'M4 15h7v5H4z'],
  'folder': ['M3 7a1 1 0 011-1h5l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z'],
  'file': ['M6 3h7l5 5v13H6z', 'M13 3v5h5'],
  'box': ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  'tag': ['M4 4h7l9 9-7 7-9-9z', 'M8.5 8.5h.01'],
  'plus': ['M12 5v14', 'M5 12h14'],
  'edit': ['M4 20h4l10-10-4-4L4 16z', 'M14 6l4 4'],
  'trash': ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13'],
  'check': ['M5 13l4 4L19 7'],
  'close': ['M6 6l12 12', 'M18 6L6 18'],
  'menu': ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'filter': ['M4 5h16l-6 7v6l-4 2v-8z'],
  'chevron-right': ['M9 5l7 7-7 7'],
  'chevron-left': ['M15 5l-7 7 7 7'],
  'chevron-down': ['M5 9l7 7 7-7'],
  'chevron-up': ['M5 15l7-7 7 7'],
  'more': ['M12 6h.01', 'M12 12h.01', 'M12 18h.01'],
  'external-link': [
    'M14 4h6v6',
    'M20 4l-9 9',
    'M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  ],
  'link': [
    'M10.5 13.5a4 4 0 005.7 0l3-3a4 4 0 10-5.7-5.7L12 6.3',
    'M13.5 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 105.7 5.7l1.5-1.5',
  ],
  'log-in': ['M13 4h6a1 1 0 011 1v14a1 1 0 01-1 1h-6', 'M9 8l4 4-4 4', 'M13 12H3'],
  'log-out': ['M11 4H5a1 1 0 00-1 1v14a1 1 0 001 1h6', 'M17 8l4 4-4 4', 'M21 12H9'],
  'lock': ['M5 11h14v9H5z', 'M8 11V8a4 4 0 018 0v3'],
  'eye': [
    'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z',
    'M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 100-5',
  ],
  'sun': [
    'M12 8a4 4 0 100 8 4 4 0 100-8',
    'M12 2v2',
    'M12 20v2',
    'M2 12h2',
    'M20 12h2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M19.1 4.9l-1.4 1.4',
    'M6.3 17.7l-1.4 1.4',
  ],
  'moon': ['M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z'],
  'globe': [
    'M12 3a9 9 0 100 18 9 9 0 100-18',
    'M3 12h18',
    'M12 3c2.6 2.7 2.6 15.3 0 18c-2.6-2.7-2.6-15.3 0-18',
  ],
  'calendar': ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  'clock': ['M12 3a9 9 0 100 18 9 9 0 100-18', 'M12 7v5l3 2'],
  'mail': ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  'credit-card': ['M3 6h18v12H3z', 'M3 10h18'],
  'download': ['M12 4v10', 'M8 12l4 4 4-4', 'M4 20h16'],
  'upload': ['M12 16V4', 'M8 8l4-4 4 4', 'M4 20h16'],
  'refresh': ['M20 12a8 8 0 11-2.3-5.7', 'M20 4v4h-4'],
  'info': ['M12 3a9 9 0 100 18 9 9 0 100-18', 'M12 11v5', 'M12 7.5h.01'],
  'help': [
    'M12 3a9 9 0 100 18 9 9 0 100-18',
    'M9.5 9.5a2.6 2.6 0 115 1c0 1.6-2.5 2-2.5 3.5',
    'M12 17.5h.01',
  ],
  'warning': ['M12 4l9 16H3z', 'M12 10v4', 'M12 17.5h.01'],
  'star': ['M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 17l-4.9 2.5.9-5.6-4-3.9 5.5-.8z'],
  'heart': ['M12 20s-7-4.5-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.5-7 9-7 9z'],
}

export const iconNames = () => Object.keys(GLYPHS)

const styles = () => `
  svg {
    display: block;
    flex: none;
    color: currentColor;
  }

  .size-sm { inline-size: ${SIZE_LENGTHS.sm}; block-size: ${SIZE_LENGTHS.sm} }
  .size-md { inline-size: ${SIZE_LENGTHS.md}; block-size: ${SIZE_LENGTHS.md} }
  .size-lg { inline-size: ${SIZE_LENGTHS.lg}; block-size: ${SIZE_LENGTHS.lg} }
`

const glyphFor = (name) => {
  if (Object.hasOwn(GLYPHS, name)) return GLYPHS[name]
  impLogger.warn(
    `${NAME}: no built-in glyph named '${name}' - run 'imp skill std/icon' for the set, or pass your own svg`,
  )
  return []
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  onMount: (_instance, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - name a built-in glyph with 'name'`)
    }
    const size = oneOf(NAME, 'size', props.size, SIZES, 'md')
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    svg.setAttribute('class', `size-${size}`)
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    for (const d of glyphFor(String(props.name))) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path')
      path.setAttribute('d', d)
      svg.append(path)
    }
    if (props.label === undefined) svg.setAttribute('aria-hidden', 'true')
    else {
      svg.setAttribute('role', 'img')
      bindValue(props.label, (value) => svg.setAttribute('aria-label', String(value)))
    }
    return svg
  },
}

export const icon = (...args) => defineComponent(NAME, () => definition)(...args)
