import { component } from 'imp'
import { lang, t } from 'imp/i18n'
import { computed, initState } from 'imp/state'
import { progress } from 'imp/std/feedback'
import { countTodos } from './todo-model.js'

const percentDone = ({ done, total }) => (total === 0 ? 0 : Math.round((done / total) * 100))

export const todoProgress = component('todo-progress', {
  styles: ':host { display: block; }',
  setup: (self, { todos }) => {
    const source = Array.isArray(todos) ? initState(self, 'todo.progress', todos) : todos
    const counts = computed([source], countTodos)
    return progress({
      label: computed([counts, lang], (current) => t('todos.progress', current)),
      value: computed([counts], percentDone),
      showValue: true,
      color: 'violet',
    })
  },
})
