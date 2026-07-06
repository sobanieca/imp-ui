import { div, mount, span } from '../../../src/lib/imp.js'
import { getCart, seedCart, subscribe } from './cart-store.js'

function widget(cart) {
  return div(
    { class: 'cart-widget' },
    span({ class: 'cart-icon', 'aria-hidden': true }, '🛒'),
    span({ class: 'cart-count' }, String(cart.count)),
    span({ class: 'cart-total' }, `$${cart.total}`),
  )
}

export function mountCartWidget() {
  const host = document.querySelector('#cart-widget')
  if (!host) return

  seedCart({
    count: Number(host.dataset.count) || 0,
    total: Number(host.dataset.total) || 0,
  })

  const render = () => mount(host, () => widget(getCart()))
  subscribe(render)
  render()
}
