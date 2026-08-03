import { component } from 'imp'
import { article, span } from 'imp/html'
import { initState, useState } from 'imp/state'
import { useHttpClient } from 'imp/http'
import { lang, t } from 'imp/i18n'
import { createLogger } from 'imp/log'
import { link, text } from 'imp/std'
import { item, row, stack } from 'imp/std/layout'
import { toggle } from 'imp/std/inputs'

const log = createLogger('todo.item')

const details = (todo) => {
  const parts = [t('todo.item.estimate', { hours: todo.estimate ?? 0 })]
  if (todo.notes) parts.push(todo.notes)
  return parts.join(' · ')
}

export const todoItem = component('todo-app-item', {
  styles: `
    :host {
      display: block;
    }

    .card {
      display: block;
      padding: var(--imp-space-3, 12px);
      border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
      border-radius: var(--imp-radius-md, 6px);
      background: var(--imp-color-surface, #ffffff);
    }

    .card.done {
      opacity: 0.7;
    }

    .badge {
      display: inline-block;
      padding-inline: var(--imp-space-2, 8px);
      padding-block: 2px;
      border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
      border-radius: var(--imp-radius-sm, 4px);
      font-size: var(--imp-font-size-sm, 0.875rem);
      white-space: nowrap;
    }

    .badge-high {
      border-color: var(--imp-color-danger, #dc2626);
      color: var(--imp-color-danger, #dc2626);
    }

    .badge-pinned {
      border-color: var(--imp-color-primary, #2563eb);
      color: var(--imp-color-primary, #2563eb);
    }

    @media (forced-colors: active) {
      .card,
      .badge {
        border-color: ButtonBorder;
      }

      .badge-high,
      .badge-pinned {
        color: ButtonText;
      }
    }
  `,
  onMount: (_instance, { todo }) => {
    const items = useState('todo.items')
    const api = useHttpClient('todo.api')
    const done = initState('todo.item.done', todo.done)

    const persist = async (value) => {
      try {
        await api.patch(`/todos/${todo.id}`, { body: { done: value } })
        items.set((all) =>
          all.map((entry) => entry.id === todo.id ? { ...entry, done: value } : entry)
        )
      } catch (error) {
        log.error(`could not update '${todo.title}'`, error)
        done.set(todo.done)
      }
    }

    done.watch((value) => {
      if (value !== todo.done) persist(value)
    })

    return article(
      { id: `todo-${todo.id}`, class: { card: true, done: todo.done } },
      row(
        { align: 'center', gap: 3 },
        toggle({ value: done, ariaLabel: t('todo.item.toggle', { title: todo.title }) }),
        item(
          { grow: true },
          stack(
            { gap: 1 },
            link({ href: `/todos/${todo.id}`, weight: 'medium' }, todo.title),
            text({ tone: 'secondary', size: 'sm' }, lang.text(() => details(todo))),
          ),
        ),
        todo.pinned &&
          span({ class: 'badge badge-pinned' }, lang.text(() => t('todo.item.pinned'))),
        span(
          { class: `badge badge-${todo.priority}` },
          lang.text(() => t(`todo.priority.${todo.priority}`)),
        ),
      ),
    )
  },
})
