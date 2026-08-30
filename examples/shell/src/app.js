import { component } from 'imp'
import { router, useRoute } from 'imp/router'
import { computed, initState } from 'imp/state'
import { heading, link } from 'imp/std'
import { shell, stack } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'
import { appBar } from './app_bar.js'
import { navGroups, navItems, sectionFor } from './nav.js'
import { isActive, isDone, seedTodos } from './todos.js'
import { tasks } from './screens/tasks.js'
import { settings } from './screens/settings.js'

const notFound = () =>
  stack(
    { gap: 3 },
    heading({ level: 1 }, 'No such section'),
    link({ href: '/' }, 'Back to all tasks'),
  )

export const app = component('app-root', {
  build: () => {
    const todos = initState('tasks.todos', seedTodos())
    const route = useRoute()
    const selected = computed([route], ({ path }) => sectionFor(path))
    const counts = {
      all: computed([todos], (items) => items.length),
      active: computed([todos], (items) => items.filter(isActive).length),
      done: computed([todos], (items) => items.filter(isDone).length),
    }

    return shell(
      {
        header: appBar(),
        sidebar: navMenu({
          label: 'Sections',
          groups: navGroups,
          items: navItems(counts, { grouped: true }),
          selected,
        }),
        bottomNav: navMenu({
          label: 'Sections, compact',
          direction: 'row',
          items: navItems({}, { grouped: false, short: true }),
          selected,
        }),
      },
      router({
        routes: {
          '/': () => tasks({ filter: 'all' }),
          '/active': () => tasks({ filter: 'active' }),
          '/done': () => tasks({ filter: 'done' }),
          '/settings': () => settings(),
        },
        notFound: notFound,
      }),
    )
  },
})
