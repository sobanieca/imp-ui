const listeners = new Set()
let state = { count: 0, total: 0 }

export const getCart = () => state

export function seedCart(initial) {
  state = initial
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function addToCart(quantity) {
  const response = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })
  state = await response.json()
  for (const listener of listeners) listener(state)
  return state
}
