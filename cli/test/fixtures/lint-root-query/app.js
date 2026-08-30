import { component } from 'imp'
import { button, div, span } from 'imp/html'

export const flagged = component('demo-flagged', {
  build: (instance) => {
    const box = div(span({ class: 'label' }, 'hi'))
    instance.root.querySelector('.label').textContent = 'ready'
    instance.root.querySelectorAll('span')
    return box
  },
})

export const flaggedDestructured = component('demo-flagged-destructured', {
  build: ({ root }, props) => {
    root.getElementById('title')
    return div(props.title)
  },
})

export const allowedDeferred = component('demo-allowed-deferred', {
  build: (instance) => {
    const label = span({ class: 'label' }, 'hi')
    queueMicrotask(() => instance.root.querySelector('.label').focus())
    return div(label, button({ events: { click: () => instance.root.querySelector('.label') } }))
  },
})

export const allowedNodeRef = component('demo-allowed-node-ref', {
  build: (instance) => {
    const label = span('hi')
    label.textContent = 'ready'
    instance.host.setAttribute('data-ready', 'true')
    return div(label)
  },
})

export const allowedUnmount = component('demo-allowed-unmount', {
  build: () => div(span({ class: 'label' }, 'hi')),
  teardown: (instance) => {
    instance.lastLabel = instance.root.querySelector('.label')?.textContent
  },
})
