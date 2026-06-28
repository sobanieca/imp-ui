import { button, div, mount, span } from '../../../src/imp.js'
import { addToCart } from './cart-store.js'

export function mountAddToCart() {
  const host = document.querySelector('#add-to-cart')
  if (!host) return

  const price = Number(host.dataset.price) || 0
  let quantity = 1
  let pending = false

  const render = () => mount(host, view)

  const setQuantity = (next) => {
    quantity = Math.min(99, Math.max(1, next))
    render()
  }

  async function buy() {
    pending = true
    render()
    await addToCart(quantity)
    pending = false
    quantity = 1
    render()
  }

  function view() {
    return div(
      { class: 'buy-row' },
      div(
        { class: 'qty' },
        button(
          {
            class: 'qty-btn',
            'aria-label': 'Decrease quantity',
            events: { click: () => setQuantity(quantity - 1) },
          },
          '−',
        ),
        span({ class: 'qty-value' }, String(quantity)),
        button(
          {
            class: 'qty-btn',
            'aria-label': 'Increase quantity',
            events: { click: () => setQuantity(quantity + 1) },
          },
          '+',
        ),
      ),
      button(
        { class: 'btn-buy', disabled: pending, events: { click: buy } },
        pending ? 'Adding…' : `Add to cart — $${quantity * price}`,
      ),
    )
  }

  render()
}
