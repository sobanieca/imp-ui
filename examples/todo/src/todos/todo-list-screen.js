import { component, flag } from 'imp'
import { luCheck, luCircle, luCircleCheck, luCircleDot, luListChecks, luTrash } from 'imp/icons'
import { useHttpClient } from 'imp/http'
import { track, zone } from 'imp/analytics'
import { lang, t } from 'imp/i18n'
import { createLogger } from 'imp/log'
import { computed, initState, useState } from 'imp/state'
import { button, icon } from 'imp/std'
import { card } from 'imp/std/display'
import { list } from 'imp/std/data'
import { loader, notice, notify, skeleton } from 'imp/std/feedback'
import { datePicker, form, resetForm, segmented, textField } from 'imp/std/inputs'
import { div } from 'imp/html'
import { flex } from 'imp/std/layout'
import { app } from '../app-map.js'
import { hero } from '../ui/hero.js'
import { pageStyles } from '../ui/page-styles.js'
import { statTile } from '../ui/stat-tile.js'
import { submitButton } from '../submit-button.js'
import { tr, translated } from '../translate.js'
import { clearCompleted, createTodo, deleteTodo, updateTodo } from './todo-api.js'
import {
  countTodos,
  FILTERS,
  filterTodos,
  formatDate,
  PRIORITIES,
  PRIORITY_COLORS,
  replaceTodo,
  sortTodos,
} from './todo-model.js'
import { todoProgress } from './todo-progress.js'

const log = createLogger('todo.list')

const FILTER_KEYS = { all: 'todos.all', active: 'todos.active', completed: 'todos.completed' }

const toListItem = (todo, language) => ({
  id: todo.id,
  title: todo.title,
  description: todo.due ? t('todos.dueOn', { date: formatDate(todo.due, language) }) : undefined,
  icon: todo.done ? luCircleCheck : luCircle,
  tag: { text: t(`todos.priorities.${todo.priority}`), color: PRIORITY_COLORS[todo.priority] },
  href: app.todos.$todoId.href({ todoId: todo.id }),
  done: todo.done,
})

const priorityOptions = () =>
  PRIORITIES.map((priority) => ({ value: priority, label: t(`todos.priorities.${priority}`) }))

const clearDoneButton = (api, items) =>
  button({
    variant: 'ghost',
    size: 'sm',
    disabled: computed(
      [items, api.tracked('todo.save').pending],
      (all, saving) => saving > 0 || countTodos(all).done === 0,
    ),
    events: {
      click: async () => {
        items.set(await clearCompleted(api))
        notify({ kind: 'success', title: t('todos.cleared') })
      },
    },
  }, tr('todos.clearCompleted'))

const addForm = (api, items) => {
  const titleField = textField({
    field: 'title',
    label: translated('todos.newTitle'),
    required: true,
    minLength: 2,
  })
  const submit = async (draft) => {
    const created = await createTodo(api, draft)
    items.set((current) => [...(current ?? []), created])
    resetForm(titleField)
    track('todo-added')
    notify({ kind: 'success', title: t('todos.added', { title: created.title }) })
  }
  return form(
    { initialValues: { title: '', priority: 'normal' }, onSubmit: submit },
    titleField,
    flex(
      { wrap: true, verticalAlign: 'bottom' },
      lang.view(() =>
        segmented({ field: 'priority', label: t('todos.priority'), options: priorityOptions() })
      ),
      datePicker({ field: 'due', label: translated('todos.due') }),
      submitButton('todos.add'),
    ),
  )
}

export const todoListScreen = component('todo-list-screen', {
  styles: pageStyles,
  setup: (self) => {
    const api = useHttpClient(self, 'todo.api')
    const items = useState(self, 'todo.items')
    const filter = initState(self, 'todo.filter', 'all')

    const toggle = async (id) => {
      const before = items.get()
      const todo = before.find((item) => item.id === id)
      items.set(replaceTodo(before, { ...todo, done: !todo.done }))
      try {
        const updated = await updateTodo(api, id, { done: !todo.done })
        items.set((current) => replaceTodo(current, updated))
        track('todo-toggled', updated.done ? 'done' : 'open')
      } catch (error) {
        log.warn('toggle failed, restoring the list', error.message)
        items.set(before)
      }
    }

    const remove = async (id) => {
      const todo = items.get().find((item) => item.id === id)
      await deleteTodo(api, id)
      items.set((current) => current.filter((item) => item.id !== id))
      notify({ kind: 'info', title: t('todos.deleted', { title: todo.title }) })
    }

    const visible = computed(
      [items, filter, lang],
      (all, current, language) =>
        sortTodos(filterTodos(all ?? [], current)).map((todo) => toListItem(todo, language)),
    )

    const rowActions = (item) =>
      flex(
        { gap: 1 },
        button({
          size: 'sm',
          square: true,
          pressed: item.done,
          label: t('todos.markDone', { title: item.title }),
          events: { click: () => toggle(item.id) },
        }, icon(luCheck)),
        button({
          size: 'sm',
          square: true,
          variant: 'ghost',
          label: t('todos.delete', { title: item.title }),
          events: { click: () => remove(item.id) },
        }, icon(luTrash)),
      )

    const loaded = computed([items], (all) => all !== undefined)
    const counts = computed([items], countTodos)
    const today = computed(
      [lang],
      (language) =>
        new Intl.DateTimeFormat(language, { weekday: 'long', month: 'long', day: 'numeric' })
          .format(new Date()),
    )

    return div(
      { class: 'page' },
      hero({
        eyebrow: today.text(),
        title: tr('todos.title'),
        subtitle: computed([counts, lang], ({ open }) => t('todos.remaining', { count: open }))
          .text(),
        actions: loader({ label: translated('todos.title'), size: 'sm', client: 'todo.api' }),
      }),
      notice({ client: 'todo.api' }),
      div(
        { class: 'tiles' },
        statTile({
          glyph: luCircleDot,
          tone: 'violet',
          value: counts.text(({ open }) => String(open)),
          label: tr('todos.active'),
        }),
        statTile({
          glyph: luCircleCheck,
          tone: 'green',
          value: counts.text(({ done }) => String(done)),
          label: tr('todos.completed'),
        }),
        statTile({
          glyph: luListChecks,
          tone: 'sky',
          value: counts.text(({ total }) => String(total)),
          label: tr('todos.all'),
        }),
      ),
      todoProgress({ todos: items }),
      zone({ name: 'add-form' }, card(addForm(api, items))),
      zone(
        { name: 'todo-list' },
        card(
          {
            header: flex(
              { horizontalAlign: 'justify', verticalAlign: 'center', wrap: true },
              lang.view(() =>
                segmented({
                  value: filter,
                  ariaLabel: t('todos.filter'),
                  size: 'sm',
                  options: FILTERS.map((value) => ({ value, label: t(FILTER_KEYS[value]) })),
                })
              ),
              flag('BULK_ACTIONS') && clearDoneButton(api, items),
            ),
          },
          loaded.view((ready) =>
            ready
              ? list({ label: translated('todos.listLabel'), items: visible, actions: rowActions })
              : skeleton({ lines: 3 })
          ),
        ),
      ),
    )
  },
})
