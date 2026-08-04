import { component, mount } from 'imp'
import { button, div, p, span } from 'imp/html'

let count = 0

const render = () => {
  document.querySelector('#count').textContent = String(count)
}

const banner = component('counter-banner', {
  onMount: () => p({ id: 'banner' }, 'inside a shadow root'),
})

const view = () =>
  div(
    span({ id: 'count' }, String(count)),
    button({
      id: 'inc',
      events: {
        click: () => {
          count++
          render()
          console.log('counter clicked', count)
        },
      },
    }, 'add'),
    banner(),
  )

mount('#app', view)
