import { component } from 'imp'
import { div } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { navigate } from 'imp/router'
import { lang, t } from 'imp/i18n'
import { button, heading, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { emptyState } from 'imp/std/display'
import { radioGroup, searchField } from 'imp/std/inputs'
import { summarize, visibleTodos } from '../todos.js'
import { todoItem } from '../components/todo_item.js'
import { loadingPanel, messagePanel } from '../panels.js'

const statusOptions = () => [
  { value: 'all', label: t('todo.status.all') },
  { value: 'open', label: t('todo.status.open') },
  { value: 'done', label: t('todo.status.done') },
]

export const todosScreen = component('todo-app-list', {
  placeholder: () => loadingPanel(),
  onError: (error) => messagePanel('app.failed', error.message),
  onMount: async () => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')
    const query = initState('todo.query', '')
    const status = initState('todo.status', 'all')

    const visible = computed(
      [items, query, status],
      (all, needle, only) => visibleTodos(all, { query: needle, status: only }),
    )
    const counters = computed([items], summarize)
    const summary = computed([counters, lang], (counts) => t('todo.list.count', counts))
    const filtered = computed([query, status], (needle, only) => needle !== '' || only !== 'all')
    const emptyTitle = computed(
      [filtered, lang],
      (active) => t(active ? 'todo.list.noMatch' : 'todo.list.empty'),
    )
    const emptyHelp = computed(
      [filtered, lang],
      (active) => t(active ? 'todo.list.noMatchHelp' : 'todo.list.emptyHelp'),
    )

    items.set(await api.get('/todos'))

    return flex(
      { direction: 'column', gap: 5 },
      flex(
        { justify: 'between', align: 'center', wrap: true, gap: 3 },
        flex(
          { direction: 'column', gap: 1 },
          heading({ level: 2 }, lang.text(() => t('todo.list.title'))),
          div({ id: 'summary' }, text({ tone: 'secondary', size: 'sm' }, summary.text())),
        ),
        button(
          { variant: 'primary', events: { click: () => navigate('/todos/new') } },
          lang.text(() => t('todo.list.add')),
        ),
      ),
      lang.view(() =>
        flex(
          { gap: 3, align: 'end', wrap: true },
          flex(
            { grow: true },
            searchField({
              value: query,
              label: t('todo.list.search'),
              placeholder: t('todo.list.searchPlaceholder'),
            }),
          ),
          radioGroup({
            value: status,
            label: t('todo.list.status'),
            options: statusOptions(),
            orientation: 'horizontal',
          }),
        )
      ),
      visible.view((list) =>
        list.length > 0 ? null : emptyState({
          variant: filtered.get() ? 'noResults' : 'empty',
          title: emptyTitle,
          description: emptyHelp,
        })
      ),
      flex(
        { direction: 'column', gap: 3 },
        visible.each((todo) => todoItem({ todo }), (todo) => todo.id),
      ),
    )
  },
})
