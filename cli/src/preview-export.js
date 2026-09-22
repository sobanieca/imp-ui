export const PREVIEW_ELEMENT = 'imp-preview'

export const PREVIEW_ELEMENT_FILE = 'imp-preview.js'

export const PREVIEW_APP_MARK = 'imp-preview:app'

export const PREVIEW_ROUTE_EVENT = 'imp-preview-route'

export const PREVIEW_THEME_EVENT = 'imp-preview-theme'

export const PREVIEW_THEME_ATTRIBUTE = 'theme'

export const PREVIEW_ENV = { IMP_ROUTING: 'hash' }

export const previewElementScript = (page) =>
  `const PAGE = ${JSON.stringify(page)}

const ELEMENT = '${PREVIEW_ELEMENT}'
const APP = new URL('./app.js', import.meta.url).href
const APP_MARK = '${PREVIEW_APP_MARK}'
const ROUTE_EVENT = '${PREVIEW_ROUTE_EVENT}'
const THEME_EVENT = '${PREVIEW_THEME_EVENT}'
const THEME_ATTRIBUTE = '${PREVIEW_THEME_ATTRIBUTE}'
const ROUTE_HASH = /^#\\//
const INDEX_HASH = '#/'

const STYLES = \`
  :host {
    display: block;
    block-size: 100dvb;
  }

  :host([hidden]) { display: none }

  iframe {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
  }
\`

const LINKED = 'link[href], script[src]'

const addressOf = (element) => (element.localName === 'link' ? 'href' : 'src')

const pageSource = () => {
  const page = new DOMParser().parseFromString(PAGE.replace(APP_MARK, () => APP), 'text/html')
  for (const element of page.querySelectorAll(LINKED)) {
    const name = addressOf(element)
    element.setAttribute(name, new URL(element.getAttribute(name), document.baseURI).href)
  }
  return \`<!doctype html>\n\${page.documentElement.outerHTML}\`
}

const hostRoute = () => (ROUTE_HASH.test(location.hash) ? location.hash : '')

const hashOf = ({ path, query }) => {
  const search = new URLSearchParams(query).toString()
  return \`#\${path}\${search ? \`?\${search}\` : ''}\`
}

class ImpPreview extends HTMLElement {
  static observedAttributes = [THEME_ATTRIBUTE]

  #frame = null
  #page = null
  #hash = null
  #connection = null

  get theme() {
    return this.getAttribute(THEME_ATTRIBUTE)
  }

  set theme(name) {
    if (name === null) this.removeAttribute(THEME_ATTRIBUTE)
    else this.setAttribute(THEME_ATTRIBUTE, name)
  }

  attributeChangedCallback() {
    this.#offerTheme()
  }

  connectedCallback() {
    if (this.shadowRoot === null) {
      const styles = document.createElement('style')
      styles.textContent = STYLES
      this.attachShadow({ mode: 'open' }).append(styles)
    }
    this.#connection = new AbortController()
    const { signal } = this.#connection
    this.#page = URL.createObjectURL(new Blob([pageSource()], { type: 'text/html' }))
    const frame = document.createElement('iframe')
    frame.title = 'Component preview'
    frame.src = this.#page + hostRoute()
    frame.addEventListener(ROUTE_EVENT, (event) => this.#mirror(event.detail), { signal })
    frame.addEventListener(THEME_EVENT, (event) => this.#adoptTheme(event.detail), { signal })
    addEventListener('hashchange', () => this.#follow(), { signal })
    this.#frame = frame
    this.#offerTheme()
    this.shadowRoot.append(frame)
  }

  disconnectedCallback() {
    this.#connection.abort()
    this.#frame.remove()
    URL.revokeObjectURL(this.#page)
    this.#frame = null
    this.#page = null
  }

  #mirror(route) {
    this.#hash = hashOf(route)
    const next = this.#hash === INDEX_HASH ? '' : this.#hash
    if (location.hash === next) return
    history.replaceState(history.state, '', \`\${location.pathname}\${location.search}\${next}\`)
  }

  #follow() {
    const target = hostRoute() || INDEX_HASH
    if (this.#hash === target) return
    this.#frame?.contentWindow?.location.replace(this.#page + target)
  }

  #offerTheme() {
    if (this.#frame === null) return
    const name = this.theme
    if (name === null) delete this.#frame.dataset.theme
    else this.#frame.dataset.theme = name
  }

  #adoptTheme(name) {
    if (this.theme !== name) this.theme = name
    this.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: name, bubbles: true }))
  }
}

if (!customElements.get(ELEMENT)) customElements.define(ELEMENT, ImpPreview)
`
