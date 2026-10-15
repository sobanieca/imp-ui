export const previewElement = ({
  page,
  element,
  appMark,
  routeEvent,
  themeEvent,
  themeAttribute,
}) => {
  const APP = new URL('./app.js', import.meta.url).href
  const ROUTE_HASH = /^#\//
  const INDEX_HASH = '#/'

  const STYLES = `
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
  `

  const LINKED = 'link[href], script[src]'

  const addressOf = (node) => (node.localName === 'link' ? 'href' : 'src')

  const pageSource = () => {
    const parsed = new DOMParser().parseFromString(
      page.replace(appMark, () => APP),
      'text/html',
    )
    for (const node of parsed.querySelectorAll(LINKED)) {
      const name = addressOf(node)
      node.setAttribute(name, new URL(node.getAttribute(name), document.baseURI).href)
    }
    return `<!doctype html>\n${parsed.documentElement.outerHTML}`
  }

  const hostRoute = () => (ROUTE_HASH.test(location.hash) ? location.hash : '')

  const hashOf = ({ path, query }) => {
    const search = new URLSearchParams(query).toString()
    return `#${path}${search ? `?${search}` : ''}`
  }

  class ImpPreview extends HTMLElement {
    static observedAttributes = [themeAttribute]

    #frame = null
    #page = null
    #hash = null
    #connection = null

    get theme() {
      return this.getAttribute(themeAttribute)
    }

    set theme(name) {
      if (name === null) this.removeAttribute(themeAttribute)
      else this.setAttribute(themeAttribute, name)
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
      frame.addEventListener(routeEvent, (event) => this.#mirror(event.detail), { signal })
      frame.addEventListener(themeEvent, (event) => this.#adoptTheme(event.detail), { signal })
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
      history.replaceState(history.state, '', `${location.pathname}${location.search}${next}`)
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
      this.dispatchEvent(new CustomEvent(themeEvent, { detail: name, bubbles: true }))
    }
  }

  if (!customElements.get(element)) customElements.define(element, ImpPreview)
}
