import { button, div, mount, span } from 'imp'

let count = 0

const render = () => {
  document.querySelector('#count').textContent = String(count)
}

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
  )

mount('#app', view)
