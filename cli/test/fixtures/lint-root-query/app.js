import { component } from 'imp'
import { button, div, span } from 'imp/html'

export const flagged = component('demo-flagged', {
  onMount: (instance) => {
    const box = div(span({ class: 'label' }, 'hi'))
    instance.root.querySelector('.label').textContent = 'ready'
    instance.root.querySelectorAll('span')
    return box
  },
})

export const flaggedDestructured = component('demo-flagged-destructured', {
  onMount: ({ root }, props) => {
    root.getElementById('title')
    return div(props.title)
  },
})

export const allowedDeferred = component('demo-allowed-deferred', {
  onMount: (instance) => {
    const label = span({ class: 'label' }, 'hi')
    queueMicrotask(() => instance.root.querySelector('.label').focus())
    return div(label, button({ events: { click: () => instance.root.querySelector('.label') } }))
  },
})

export const allowedNodeRef = component('demo-allowed-node-ref', {
  onMount: (instance) => {
    const label = span('hi')
    label.textContent = 'ready'
    instance.host.setAttribute('data-ready', 'true')
    return div(label)
  },
})

export const allowedUnmount = component('demo-allowed-unmount', {
  onMount: () => div(span({ class: 'label' }, 'hi')),
  onUnmount: (instance) => {
    instance.lastLabel = instance.root.querySelector('.label')?.textContent
  },
})
