import { component, delay } from 'imp'
import { luCreditCard, luHouse, luPackage, luShoppingCart, luTruck } from 'imp/icons'
import { button, icon, text } from 'imp/std'
import { stack } from 'imp/std/layout'
import { timeline } from 'imp/std/data'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'Timeline'
export const group = groups.data

const order = () => [
  {
    id: 'placed',
    time: '2026-09-21T09:12:00Z',
    title: 'Order placed',
    description: 'Three items, paid with a card',
    icon: luShoppingCart,
    color: 'blue',
  },
  {
    id: 'paid',
    time: '2026-09-21T09:13:00Z',
    title: 'Payment accepted',
    icon: luCreditCard,
    color: 'green',
  },
  {
    id: 'packed',
    time: '2026-09-22T14:40:00Z',
    title: 'Packed in the warehouse',
    icon: luPackage,
  },
  {
    id: 'shipped',
    time: '2026-09-23T07:05:00Z',
    title: 'Handed to the courier',
    description: 'Tracking number 4471 0923',
    icon: luTruck,
    color: 'amber',
  },
  {
    id: 'delivered',
    time: '2026-09-24T16:30:00Z',
    title: 'Delivered',
    icon: luHouse,
    color: 'green',
  },
]

const release = (index) => ({
  id: `release-${index}`,
  time: `2026-${String(9 - (index % 9)).padStart(2, '0')}-${String(28 - index).padStart(2, '0')}`,
  title: `Version 0.${40 - index}.0`,
  description: index % 3 === 0 ? 'A release with new components' : 'Fixes and small changes',
  color: index % 3 === 0 ? 'violet' : 'neutral',
})

const releases = (count, from = 0) =>
  Array.from({ length: count }, (_, step) => release(from + step))

export const orderHistory = {
  scenario: 'Order history with icons',
  component: timeline({ label: 'Order history', items: order() }),
}

export const dates = {
  scenario: 'Dates only, with dots',
  component: timeline({ label: 'Releases', items: releases(5) }),
}

export const selectable = {
  scenario: 'Selectable events and actions',
  component: component('timeline-select-demo', {
    setup: (self) => {
      const chosen = initState(self, 'demo.timeline.chosen', 'nothing')
      return stack(
        { gap: 3 },
        timeline({
          label: 'Order history',
          items: order().slice(0, 3),
          actions: (item) =>
            button(
              { size: 'sm', square: true, label: `Open ${item.title}` },
              icon(luPackage, { size: 'sm' }),
            ),
          events: { select: (event) => chosen.set(event.detail.item.title) },
        }),
        text(
          { tone: 'secondary', size: 'sm' },
          chosen.text((title) => `Selected: ${title}`),
        ),
      )
    },
  })(),
}

export const infiniteScroll = {
  scenario: 'Infinite scroll',
  component: component('timeline-scroll-demo', {
    setup: (self) => {
      const items = initState(self, 'demo.timeline.items', releases(8))
      const hasMore = initState(self, 'demo.timeline.more', true)
      const onLoadMore = async () => {
        await new Promise((resolve) => delay(self, 900, resolve))
        items.set((loaded) => [...loaded, ...releases(8, loaded.length)])
        hasMore.set(items.get().length < 24)
      }
      return timeline({ label: 'Releases', items, hasMore, onLoadMore })
    },
  })(),
}

export const empty = {
  scenario: 'Empty',
  component: timeline({ label: 'Order history', items: [] }),
}
