import { component } from 'imp'
import { div } from 'imp/html'
import { computed, useState } from 'imp/state'
import { heading, link, text } from 'imp/std'
import { grid, row, stack } from 'imp/std/layout'
import { PRIORITIES, summarize } from '../todos.js'
import { words } from '../panels.js'

const statCard = (key, value) =>
  stack(
    { gap: 1 },
    text({ tone: 'secondary', size: 'sm' }, words(`stats.${key}`)),
    div({ id: `stat-${key}` }, text({ size: 'lg', weight: 'bold' }, value.text())),
  )

export const summaryScreen = component('todo-stats-summary', {
  onMount: () => {
    const counts = computed([useState('todo.items')], summarize)
    const field = (name) => computed([counts], (current) => current[name])

    return stack(
      { gap: 5 },
      grid(
        { minItemWidth: '9rem', gap: 4 },
        statCard('total', field('total')),
        statCard('open', field('open')),
        statCard('done', field('done')),
        statCard('hours', field('hours')),
      ),
      stack(
        { gap: 2 },
        heading({ level: 3 }, words('stats.byPriority')),
        row(
          { gap: 4, wrap: true },
          ...PRIORITIES.map((name) =>
            link({ href: `/stats/priority/${name}` }, words(`todo.priority.${name}`))
          ),
        ),
      ),
    )
  },
})
