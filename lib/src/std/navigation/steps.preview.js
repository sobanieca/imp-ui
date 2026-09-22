import { component } from 'imp'
import { div } from 'imp/html'
import { button } from 'imp/std'
import { flex, stack } from 'imp/std/layout'
import { steps } from 'imp/std/navigation'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Steps'
export const group = groups.navigation

const checkoutItems = () => [
  { id: 'cart', label: 'Cart', description: 'Three products' },
  { id: 'address', label: 'Address', description: 'Where we ship to' },
  { id: 'payment', label: 'Payment', description: 'Card or bank transfer' },
  { id: 'review', label: 'Review', description: 'Check and place the order' },
]

const ORDER = ['cart', 'address', 'payment', 'review']

export const horizontal = {
  scenario: 'Horizontal',
  component: steps({ label: 'Checkout', current: 'payment', items: checkoutItems() }),
}

export const vertical = {
  scenario: 'Vertical',
  component: steps({
    label: 'Checkout',
    orientation: 'vertical',
    current: 'address',
    items: checkoutItems(),
  }),
}

export const withoutDescriptions = {
  scenario: 'Labels only',
  component: steps({
    label: 'Set up the workspace',
    current: 'team',
    items: [
      { id: 'account', label: 'Account' },
      { id: 'team', label: 'Team' },
      { id: 'plan', label: 'Plan' },
    ],
  }),
}

export const failedStep = {
  scenario: 'A failed step',
  component: steps({
    label: 'Checkout',
    current: 'payment',
    items: checkoutItems().map((item) =>
      item.id === 'payment'
        ? { ...item, status: 'error', description: 'The bank declined the card' }
        : item
    ),
  }),
}

export const goBack = {
  scenario: 'Go back to a done step',
  component: component('steps-wizard-demo', {
    setup: (self) => {
      const current = initState(self, 'steps.current', 'address')
      const move = (offset) => {
        const next = ORDER[ORDER.indexOf(current.get()) + offset]
        if (next !== undefined) current.set(next)
      }
      return stack(
        { gap: 4 },
        steps({
          label: 'Checkout',
          current,
          items: checkoutItems(),
          events: { select: (event) => current.set(event.detail.id) },
        }),
        flex(
          { gap: 2 },
          button({ events: { click: () => move(-1) } }, 'Back'),
          button({ variant: 'primary', events: { click: () => move(1) } }, 'Next'),
        ),
      )
    },
  })(),
}

export const narrow = {
  scenario: 'In a narrow box',
  component: () =>
    div(
      { style: 'max-inline-size: 22rem' },
      steps({ label: 'Checkout', current: 'payment', items: checkoutItems() }),
    ),
}
