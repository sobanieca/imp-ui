import { component } from 'imp'
import { computed, useState } from 'imp/state'
import { HttpError, useHttpClient } from 'imp/http'
import { navigate } from 'imp/router'
import { lang, t } from 'imp/i18n'
import { button, heading, link, text } from 'imp/std'
import { flex } from 'imp/std/layout'
import {
  checkbox,
  form,
  numberField,
  resetButton,
  select,
  submitButton,
  textArea,
  textField,
} from 'imp/std/inputs'
import { markdownNote } from '../components/markdown_note.js'
import { loadingPanel, message, messagePanel, words } from '../panels.js'
import { priorityOptions } from './new_todo.js'

export const todoScreen = component('todo-app-detail', {
  placeholder: () => loadingPanel(),
  onError: (error) =>
    error instanceof HttpError && error.status === 404
      ? messagePanel('todo.detail.missing')
      : messagePanel('app.failed', error.message),
  onMount: async (_instance, id) => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')
    const removing = computed([api.tracked('todo.remove').pending], (count) => count > 0)

    const todo = await api.get(`/todos/${id}`)

    const save = async (values) => {
      const saved = await api.patch(`/todos/${id}`, { body: values })
      items.set((all) => all.map((entry) => (entry.id === id ? saved : entry)))
      navigate('/')
    }

    const remove = async () => {
      await api.delete(`/todos/${id}`, { track: 'todo.remove' })
      items.set((all) => all.filter((entry) => entry.id !== id))
      navigate('/', { replace: true })
    }

    return flex(
      { direction: 'column', gap: 5 },
      heading({ level: 2 }, words('todo.form.editTitle')),
      form(
        { initialValues: todo, onSubmit: save },
        textField({
          field: 'title',
          label: message('todo.form.title'),
          required: true,
          maxLength: 80,
        }),
        textArea({
          field: 'notes',
          label: message('todo.form.notes'),
          help: message('todo.form.notesHelp'),
          rows: 3,
        }),
        markdownNote({ field: 'notes', label: words('todo.form.notesPreview') }),
        flex(
          { gap: 3, wrap: true },
          flex(
            { grow: true },
            lang.view(() =>
              select({
                field: 'priority',
                label: t('todo.form.priority'),
                options: priorityOptions(),
              })
            ),
          ),
          flex(
            { grow: true },
            numberField({
              field: 'estimate',
              label: message('todo.form.estimate'),
              min: 0,
              max: 40,
              step: 0.5,
            }),
          ),
        ),
        checkbox({ field: 'done', label: message('todo.form.done') }),
        checkbox({ field: 'pinned', label: message('todo.form.pinned') }),
        flex(
          { gap: 2, wrap: true },
          submitButton(words('todo.form.save')),
          resetButton(words('todo.form.reset')),
          button(
            { variant: 'danger', loading: removing, events: { click: remove } },
            words('todo.form.delete'),
          ),
        ),
      ),
      api.lastError.view((error) =>
        error && text({ tone: 'secondary', size: 'sm' }, error.message)
      ),
      link({ href: '/' }, words('app.home')),
    )
  },
})
