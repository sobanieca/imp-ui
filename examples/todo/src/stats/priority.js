import { component } from 'imp'
import { computed, useState } from 'imp/state'
import { lang, t } from 'imp/i18n'
import { heading, link } from 'imp/std'
import { stack } from 'imp/std/layout'
import { emptyState } from 'imp/std/display'
import { todoItem } from '../components/todo_item.js'
import { words } from '../panels.js'

export const priorityScreen = component('todo-stats-priority', {
  onMount: (_instance, name) => {
    const items = useState('todo.items')
    const matching = computed([items], (all) => all.filter((todo) => todo.priority === name))
    const nothing = computed([matching], (list) => list.length === 0)

    return stack(
      { gap: 4 },
      heading(
        { level: 3 },
        lang.text(() => t('stats.priorityTitle', { priority: t(`todo.priority.${name}`) })),
      ),
      nothing.view((empty) => empty && emptyState({ variant: 'noResults' })),
      stack({ gap: 3 }, matching.each((todo) => todoItem({ todo }), (todo) => todo.id)),
      link({ href: '/stats' }, words('stats.title')),
    )
  },
})
