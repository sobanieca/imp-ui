import { component } from 'imp'
import { button, div, span } from 'imp/html'

export const flagged = component('demo-flagged', {
  setup: (self) => {
    const box = div(span({ class: 'label' }, 'hi'))
    self.host.shadowRoot.querySelector('.label').textContent = 'ready'
    self.host.shadowRoot.querySelectorAll('span')
    return box
  },
})

export const flaggedDestructured = component('demo-flagged-destructured', {
  setup: ({ host }, props) => {
    host.shadowRoot.getElementById('title')
    return div(props.title)
  },
})

export const allowedDeferred = component('demo-allowed-deferred', {
  setup: (self) => {
    const label = span({ class: 'label' }, 'hi')
    queueMicrotask(() => self.host.shadowRoot.querySelector('.label').focus())
    return div(
      label,
      button({ events: { click: () => self.host.shadowRoot.querySelector('.label') } }),
    )
  },
})

export const allowedNodeRef = component('demo-allowed-node-ref', {
  setup: (self) => {
    const label = span('hi')
    label.textContent = 'ready'
    self.host.setAttribute('data-ready', 'true')
    return div(label)
  },
})

export const allowedOnMount = component('demo-allowed-on-mount', {
  setup: () => div(span({ class: 'label' }, 'hi')),
  onMount: (self) => self.host.shadowRoot.querySelector('.label').focus(),
  onRemove: (self) => {
    self.lastLabel = self.host.shadowRoot.querySelector('.label')?.textContent
  },
})

export const notADefinition = {
  setup: (self) => {
    self.host.shadowRoot.querySelector('.label')
    return div('plain object, not a component')
  },
}
