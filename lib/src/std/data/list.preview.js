import { component, delay } from 'imp'
import { luFileText, luImage, luPencil } from 'imp/icons'
import { button, icon, menuButton, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { list } from 'imp/std/data'
import { stack } from 'imp/std/layout'
import { initState } from 'imp/state'
import { groups } from '../preview-groups.js'

export const name = 'List'
export const group = groups.data

const NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Edsger Dijkstra',
  'Barbara Liskov',
  'Donald Knuth',
  'Margaret Hamilton',
  'Tim Berners-Lee',
]

const TEAMS = ['Engineering', 'Design', 'Research', 'Support']

const ROLES = [
  { text: 'Admin', color: 'blue' },
  { text: 'Member' },
  {
    text: 'Invited',
    color: 'amber',
  },
]

const person = (index) => ({
  id: `person-${index}`,
  title: NAMES[index % NAMES.length],
  description: `${TEAMS[index % TEAMS.length]} - joined in ${2015 + (index % 10)}`,
  name: NAMES[index % NAMES.length],
  tag: ROLES[index % ROLES.length],
})

const people = (count, from = 0) => Array.from({ length: count }, (_, step) => person(from + step))

const rowActions = (item) =>
  flex(
    { joined: true },
    button(
      { size: 'sm', square: true, label: `Edit ${item.title}` },
      icon(luPencil, { size: 'sm' }),
    ),
    menuButton({
      size: 'sm',
      label: `Actions for ${item.title}`,
      items: [
        { id: 'role', label: 'Change the role' },
        { id: 'remove', label: 'Remove' },
      ],
    }),
  )

export const peopleList = {
  scenario: 'People with avatars and tags',
  component: list({ label: 'Team members', items: people(5) }),
}

export const selectable = {
  scenario: 'Selectable rows',
  component: component('list-select-demo', {
    setup: (self) => {
      const chosen = initState(self, 'demo.list.chosen', 'nobody')
      return stack(
        { gap: 3 },
        list({
          label: 'Team members',
          items: people(4),
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

export const withActions = {
  scenario: 'With actions',
  component: list({ label: 'Team members', items: people(4), actions: rowActions }),
}

export const files = {
  scenario: 'Icons and links',
  component: list({
    label: 'Files',
    items: [
      {
        id: 'brief',
        title: 'Project brief',
        description: 'Edited 2 days ago',
        icon: luFileText,
        href: '/files/brief',
      },
      {
        id: 'logo',
        title: 'Logo draft',
        description: 'Edited last week',
        icon: luImage,
        href: '/files/logo',
      },
      { id: 'notes', title: 'Meeting notes', description: 'Edited last month', icon: luFileText },
    ],
    events: { select: (event) => event.preventDefault() },
  }),
}

export const infiniteScroll = {
  scenario: 'Infinite scroll',
  component: component('list-scroll-demo', {
    setup: (self) => {
      const items = initState(self, 'demo.list.items', people(12))
      const hasMore = initState(self, 'demo.list.more', true)
      const onLoadMore = async () => {
        await new Promise((resolve) => delay(self, 900, resolve))
        items.set((loaded) => [...loaded, ...people(12, loaded.length)])
        hasMore.set(items.get().length < 60)
      }
      return list({ label: 'Team members', items, hasMore, onLoadMore, actions: rowActions })
    },
  })(),
}

export const empty = {
  scenario: 'Empty',
  component: list({ label: 'Team members', items: [] }),
}
