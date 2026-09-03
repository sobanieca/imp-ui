import { component, mount } from 'imp'
import { button, div, p, span } from 'imp/html'

let count = 0

const render = () => {
  document.querySelector('#count').textContent = String(count)
}

const banner = component('counter-banner', {
  setup: () => {
    const box = div(p({ id: 'banner' }, 'inside a shadow root'))
    const revealLater = () =>
      setTimeout(() => box.append(p({ id: 'late-note' }, 'added later')), 250)
    box.append(button({ id: 'later', events: { click: revealLater } }, 'later'))
    return box
  },
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
