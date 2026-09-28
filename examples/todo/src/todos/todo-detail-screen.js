import { component } from 'imp'
import { luCircleX, luPencil, luTrash } from 'imp/icons'
import { useHttpClient } from 'imp/http'
import { track, zone } from 'imp/analytics'
import { lang, t } from 'imp/i18n'
import { navigate } from 'imp/router'
import { computed, initState, useState } from 'imp/state'
import { button, icon, link, text } from 'imp/std'
import { card, descriptionList, emptyState, markdown, tag } from 'imp/std/display'
import { notify, skeleton } from 'imp/std/feedback'
import { datePicker, form, select, textField, toggle } from 'imp/std/inputs'
import { div } from 'imp/html'
import { dialog, flex, stack } from 'imp/std/layout'
import { app } from '../app-map.js'
import { hero } from '../ui/hero.js'
import { pageStyles } from '../ui/page-styles.js'
import { saveChangesButton } from '../submit-button.js'
import { tr, translated } from '../translate.js'
import { deleteTodo, loadTodo, updateTodo } from './todo-api.js'
import { formatDate, PRIORITIES, PRIORITY_COLORS, replaceTodo } from './todo-model.js'

const details = (todo, language) => [
  {
    term: t('todo.status'),
    details: tag(
      { color: todo.done ? 'green' : 'amber', dot: true },
      t(todo.done ? 'todo.done' : 'todo.open'),
    ),
  },
  {
    term: t('todos.priority'),
    details: tag({ color: PRIORITY_COLORS[todo.priority] }, t(`todos.priorities.${todo.priority}`)),
  },
  { term: t('todos.due'), details: todo.due ? formatDate(todo.due, language) : '-' },
]

const editForm = (todo, onSave) =>
  form(
    { initialValues: todo, onSubmit: onSave },
    textField({ field: 'title', label: translated('todo.title'), required: true, minLength: 2 }),
    textField({ field: 'notes', label: translated('todo.notes'), rows: 4 }),
    lang.view(() =>
      select({
        field: 'priority',
        label: t('todos.priority'),
        options: PRIORITIES.map((value) => ({ value, label: t(`todos.priorities.${value}`) })),
      })
    ),
    datePicker({ field: 'due', label: translated('todos.due') }),
    toggle({ field: 'done', label: translated('todo.done') }),
    saveChangesButton('todo.save'),
  )

export const todoDetailScreen = component('todo-detail-screen', {
  styles: pageStyles,
  loading: () => skeleton({ lines: 4 }),
  setup: async (self, { id }) => {
    const api = useHttpClient(self, 'todo.api')
    const items = useState(self, 'todo.items')
    const loadedTodo = await loadTodo(api, id)
    if (self.abortSignal.aborted) return null

    const todo = initState(self, 'todo.current', loadedTodo)
    const editing = initState(self, 'todo.editing', false)
    const confirming = initState(self, 'todo.confirming', false)

    const save = async (values) => {
      const saved = await updateTodo(api, id, values)
      todo.set(saved)
      items.set((current) => replaceTodo(current ?? [], saved))
      editing.set(false)
      track('todo-saved')
      notify({ kind: 'success', title: t('todo.saved', { title: saved.title }) })
    }

    const remove = async () => {
      await deleteTodo(api, id)
      track('todo-deleted')
      items.set((current) => (current ?? []).filter((item) => item.id !== id))
      confirming.set(false)
      notify({ kind: 'info', title: t('todos.deleted', { title: todo.get().title }) })
      navigate(app.todos.href(), { replace: true })
    }

    const withLanguage = computed([todo, lang], (current, language) => ({ current, language }))

    return div(
      { class: 'page' },
      link({ href: app.todos.href(), tone: 'secondary', size: 'sm' }, tr('todo.back')),
      hero({
        eyebrow: computed([todo, lang], (current) => t(`todos.priorities.${current.priority}`))
          .text(),
        title: todo.text((current) => current.title),
        actions: [
          button(
            { events: { click: () => editing.set(true) } },
            icon(luPencil, { size: 'sm' }),
            tr('todo.edit'),
          ),
          button(
            { variant: 'danger', events: { click: () => confirming.set(true) } },
            icon(luTrash, { size: 'sm' }),
            tr('todo.delete'),
          ),
        ],
      }),
      div(
        { class: 'columns' },
        card(
          withLanguage.view(({ current, language }) =>
            descriptionList({ items: details(current, language) })
          ),
        ),
        card(
          { header: tr('todo.notes') },
          markdown({
            text: computed([todo, lang], (current) => current.notes || t('todo.noNotes')),
          }),
        ),
      ),
      dialog(
        { title: translated('todo.edit'), open: editing },
        zone({ name: 'edit-form' }, editForm(loadedTodo, save)),
      ),
      dialog(
        { title: translated('todo.confirmTitle'), open: confirming },
        stack(
          { gap: 4 },
          text(lang.text(() => t('todo.confirmBody', { title: todo.get().title }))),
          flex(
            { horizontalAlign: 'end' },
            button({ events: { click: () => confirming.set(false) } }, tr('todo.cancel')),
            button({ variant: 'danger', events: { click: remove } }, tr('todo.delete')),
          ),
        ),
      ),
    )
  },
  error: () =>
    div(
      { class: 'page' },
      card(
        emptyState(
          { icon: luCircleX, kind: 'error', title: translated('todo.notFound') },
          link({ href: app.todos.href() }, tr('todo.back')),
        ),
      ),
    ),
})
