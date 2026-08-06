import { component } from 'imp'
import { useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { navigate } from 'imp/router'
import { lang, t } from 'imp/i18n'
import { button, heading } from 'imp/std'
import { flex } from 'imp/std/layout'
import {
  checkbox,
  form,
  numberField,
  select,
  submitButton,
  textArea,
  textField,
} from 'imp/std/inputs'
import { PRIORITIES } from '../todos.js'
import { markdownNote } from '../components/markdown_note.js'
import { message, words } from '../panels.js'

export const priorityOptions = () =>
  PRIORITIES.map((value) => ({ value, label: t(`todo.priority.${value}`) }))

export const newTodoScreen = component('todo-app-new', {
  onMount: () => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')

    const isTaken = (value) =>
      items.get().some((todo) => todo.title.trim().toLowerCase() === value.trim().toLowerCase())

    const save = async (values) => {
      const created = await api.post('/todos', { body: values })
      items.set((all) => [created, ...all])
      navigate('/', { replace: true })
    }

    return flex(
      { direction: 'column', gap: 5 },
      heading({ level: 2 }, words('todo.form.newTitle')),
      form(
        {
          initialValues: { title: '', notes: '', priority: 'normal', estimate: 1, pinned: false },
          onSubmit: save,
        },
        textField({
          field: 'title',
          label: message('todo.form.title'),
          help: message('todo.form.titleHelp'),
          required: true,
          maxLength: 80,
          validateAsync: (value) =>
            Promise.resolve(value && isTaken(value) ? t('todo.form.taken') : null),
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
        checkbox({ field: 'pinned', label: message('todo.form.pinned') }),
        flex(
          { gap: 2 },
          submitButton(words('todo.form.add')),
          button(
            { variant: 'ghost', events: { click: () => navigate('/') } },
            words('todo.form.cancel'),
          ),
        ),
      ),
    )
  },
})
