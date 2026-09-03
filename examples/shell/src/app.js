import { component } from 'imp'
import { router, useRoute } from 'imp/router'
import { computed, initState } from 'imp/state'
import { heading, icon, link } from 'imp/std'
import { luCheck } from 'imp/icons'
import { shell, stack } from 'imp/std/layout'
import { appLogo, themeSelect } from 'imp/std/shell'
import { filterFor, sectionFor, sections } from './nav.js'
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
  setup: (self) => {
    const todos = initState(self, 'tasks.todos', seedTodos())
    const route = useRoute()
    const counts = {
      all: computed([todos], (items) => items.length),
      active: computed([todos], (items) => items.filter(isActive).length),
      done: computed([todos], (items) => items.filter(isDone).length),
    }

    return shell(
      {
        logo: appLogo({
          label: 'imp tasks',
          tagline: 'shell example',
          icon: icon(luCheck, { size: 'lg' }),
        }),
        navbar: {
          label: 'Sections',
          items: sections(counts),
          selected: computed([route], ({ path }) => sectionFor(path)),
        },
        sidebar: {
          label: 'Filters',
          selected: computed([route], ({ path }) => filterFor(path)),
        },
        extras: themeSelect(),
        account: { name: 'Ada Lovelace', description: 'ada@example.com' },
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
