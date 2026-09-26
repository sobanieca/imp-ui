import { defineComponent } from '../shared/define.js'
import { a, div, img, span } from '../../api/html.js'
import { url } from '../../location.js'
import { impLogger } from '../../logger.js'
import { theme } from '../../theme.js'
import { colorSchemeOf } from '../../theme-colors.js'
import { bindContent, bindText, bindValue } from '../shared/args.js'
import { followHref, leavesTheApp, onPlainClick } from '../shared/links.js'
import { focusRing, fontFamily, forcedColors, token, visuallyHidden } from '../shared/css.js'

const NAME = 'appLogo'

const KNOWN_PROPS = [
  'label',
  'tagline',
  'href',
  'src',
  'alt',
  'icon',
  'image',
  'compact',
  'events',
]

const IMAGE_BLOCK_SIZE = '--imp-app-logo-block-size'

const styles = () => `
  .root {
    display: flex;
    align-items: center;
    gap: ${token('space-2')};
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    border-radius: ${token('radius-item')};
    padding-block: ${token('space-2')};
    padding-inline: ${token('space-2')};
    ${fontFamily()}
    color: ${token('color-text')};
    text-decoration: none;
  }

  a.root:hover {
    background-color: ${token('color-surface-hover')};
  }

  a.root:focus-visible {${focusRing()}}

  .mark {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    color: ${token('color-primary')};
  }

  .mark img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }

  .whole {
    display: block;
    flex: none;
    inline-size: auto;
    max-inline-size: 100%;
    block-size: var(${IMAGE_BLOCK_SIZE}, 2rem);
    object-fit: contain;
    object-position: 0 50%;
  }

  .words {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .label {
    color: ${token('color-text')};
    font-family: ${token('font-family-heading')};
    font-size: ${token('font-size-lg')};
    font-weight: ${token('font-weight-bold')};
    line-height: ${token('line-height-tight')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tagline {
    color: ${token('color-secondary')};
    font-size: ${token('font-size-sm')};
    line-height: ${token('line-height-tight')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .words {${visuallyHidden}}

  ${forcedColors}
`

const isSchemeMap = (src) => src !== null && typeof src === 'object'

const sourceForScheme = ({ light, dark }, colorScheme) => {
  if (colorScheme === 'dark') return dark ?? light
  return light ?? dark
}

const pictureNode = (self, prop, source, alt) => {
  const image = img({ alt })
  if (!isSchemeMap(source)) {
    image.src = source
    return image
  }
  if (source.light === undefined && source.dark === undefined) {
    impLogger.warn(
      `${NAME}: '${prop}' as an object needs a 'light' or a 'dark' entry - drawing no picture`,
    )
    return null
  }
  theme.watch(self, (current) => {
    const next = sourceForScheme(source, colorSchemeOf(current?.tokens))
    if (image.getAttribute('src') !== next) image.src = next
  })
  return image
}

const markNode = (self, props) => {
  if (props.src !== undefined) {
    const image = pictureNode(self, 'src', props.src, props.alt ?? '')
    return image === null ? null : span({ class: 'mark' }, image)
  }
  if (props.icon !== undefined && props.icon !== null) {
    return span({ class: 'mark' }, bindContent(self, props.icon))
  }
  return null
}

const wholeNode = (self, props) => {
  for (const prop of ['src', 'icon', 'tagline']) {
    if (props[prop] !== undefined) {
      impLogger.warn(`${NAME}: '${prop}' is ignored beside 'image' - the image is the whole logo`)
    }
  }
  if (props.label === undefined) {
    impLogger.warn(`${NAME}: 'image' needs a 'label' - it is the alt text of the logo`)
  }
  const image = pictureNode(self, 'image', props.image, '')
  if (image === null) return null
  image.classList.add('whole')
  bindValue(self, props.label ?? '', (value) => image.setAttribute('alt', String(value ?? '')))
  return image
}

const definition = {
  styles,
  props: KNOWN_PROPS,
  setup: (self, props, children) => {
    if (children.length > 0) {
      impLogger.warn(`${NAME}: takes no content - pass the app name as 'label'`)
    }
    const whole = props.image === undefined || props.image === null
    const mark = whole ? markNode(self, props) : null
    if (whole && mark === null && props.label === undefined) {
      impLogger.warn(
        `${NAME}: needs a 'label', an 'src', an 'icon' or an 'image' - rendering an empty brand`,
      )
    }
    const words = !whole || (props.label === undefined && props.tagline === undefined) ? null : div(
      { class: 'words' },
      props.label === undefined ? null : span({ class: 'label' }, bindText(self, props.label)),
      props.tagline === undefined
        ? null
        : span({ class: 'tagline' }, bindText(self, props.tagline)),
    )
    const content = whole ? [mark, words] : [wholeNode(self, props)]
    const href = props.href === undefined ? '/' : props.href
    const rootProps = {
      class: ['root', props.compact && 'compact'],
      events: props.events,
    }
    if (href === null) return div(rootProps, ...content)
    const root = a({ ...rootProps, href: url(href) }, ...content)
    return leavesTheApp(href) ? root : onPlainClick(root, () => followHref(href))
  },
}

export const appLogo = (...args) => defineComponent(NAME, () => definition)(...args)
