import { component } from 'imp'
import { redirect, router } from 'imp/router'
import { initState } from 'imp/state'
import { heading, icon, link } from 'imp/std'
import { luCheck, luClock, luLayoutGrid, luSettings } from 'imp/icons'
import { shell, stack } from 'imp/std/layout'
import { appLogo, themeSelect, userCard } from 'imp/std/shell'
import { app as map } from './app-map.js'
import { isActive, isDone, seedTodos } from './todos.js'
import { tasks } from './screens/tasks.js'
import { taskDetail } from './screens/task-detail.js'
import { settings } from './screens/settings.js'

const icons = {
  [map.tasks]: luCheck,
  [map.tasks.all]: luLayoutGrid,
  [map.tasks.active]: luClock,
  [map.tasks.done]: luCheck,
  [map.settings]: luSettings,
}

const notFound = () =>
  stack(
    { gap: 3 },
    heading({ level: 1 }, 'No such page'),
    link({ href: map.tasks.all.href() }, 'Back to all tasks'),
  )

export const app = component('app-root', {
  setup: (self) => {
    const todos = initState(self, 'tasks.todos', seedTodos())
    const active = initState(self, 'tasks.counts.active', null)
    const done = initState(self, 'tasks.counts.done', null)
    const options = initState(self, 'tasks.options', [])
    todos.watch(self, (items) => {
      active.set({ text: items.filter(isActive).length, color: 'blue' })
      done.set({ text: items.filter(isDone).length, color: 'green' })
      options.set(items.map((todo) => ({ value: String(todo.id), label: todo.title })))
    })

    return shell(
      {
        logo: appLogo({
          label: 'imp tasks',
          tagline: 'shell example',
          icon: icon(luCheck, { size: 'lg' }),
        }),
        navbar: {
          label: 'Sections',
          map,
          icons,
          tags: { [map.tasks.active]: active, [map.tasks.done]: done },
        },
        sidebar: { label: 'Filters' },
        extras: [
          themeSelect(),
          userCard({ signedIn: true, name: 'Ada Lovelace', description: 'ada@example.com' }),
        ],
      },
      router({
        map,
        options: { [map.tasks.$taskId]: 'tasks.options' },
        title: ({ crumbs }) => `${crumbs.at(-1)} - imp tasks`,
        screens: {
          [map.home]: redirect(map.tasks),
          [map.tasks.all]: ({ node }) => tasks({ filter: 'all', node }),
          [map.tasks.active]: ({ node }) => tasks({ filter: 'active', node }),
          [map.tasks.done]: ({ node }) => tasks({ filter: 'done', node }),
          [map.tasks.$taskId]: ({ params }) => taskDetail({ id: Number(params.taskId) }),
          [map.settings]: () => settings(),
        },
        notFound,
      }),
    )
  },
})
