import { component } from 'imp'
import { div, html } from 'imp/html'
import { computed, useState } from 'imp/state'
import { text } from 'imp/std'
import { flex } from 'imp/std/layout'
import { micromark } from 'micromark'
import { words } from '../panels.js'

const valueAt = (values, path) => path.split('.').reduce((current, key) => current?.[key], values)

const isState = (value) => typeof value?.view === 'function'

export const markdownNote = component('todo-app-note', {
  styles: `
    :host {
      display: block;
    }

    .note {
      padding: var(--imp-space-3, 12px);
      border: var(--imp-border-width, 1px) solid var(--imp-color-border, #cbd5e1);
      border-radius: var(--imp-radius-md, 6px);
      background: var(--imp-color-surface, #ffffff);
      color: var(--imp-color-text, #0f172a);
      font-family: var(--imp-font-family, system-ui, sans-serif);
      line-height: var(--imp-line-height-normal, 1.6);
    }

    .note > :first-child {
      margin-block-start: 0;
    }

    .note > :last-child {
      margin-block-end: 0;
    }

    .note h1,
    .note h2,
    .note h3 {
      margin-block: var(--imp-space-3, 12px) var(--imp-space-2, 8px);
      font-size: var(--imp-font-size-md, 1rem);
    }

    .note ul,
    .note ol {
      margin-block: var(--imp-space-2, 8px);
      padding-inline-start: var(--imp-space-5, 24px);
    }

    .note a {
      color: var(--imp-color-link, #2563eb);
    }

    .note code {
      padding-inline: var(--imp-space-1, 4px);
      border-radius: var(--imp-radius-sm, 4px);
      background: var(--imp-color-surface-hover, #f1f5f9);
      font-family: var(--imp-font-family-mono, ui-monospace, monospace);
      font-size: var(--imp-font-size-sm, 0.875rem);
    }

    .note pre {
      overflow: auto;
      padding: var(--imp-space-3, 12px);
      border-radius: var(--imp-radius-md, 6px);
      background: var(--imp-color-surface-hover, #f1f5f9);
    }

    .note pre code {
      padding: 0;
      background: none;
    }

    .note blockquote {
      margin-inline: 0;
      padding-inline-start: var(--imp-space-3, 12px);
      border-inline-start: calc(var(--imp-border-width, 1px) * 3) solid
        var(--imp-color-border, #cbd5e1);
      color: var(--imp-color-secondary, #64748b);
    }

    @media (forced-colors: active) {
      .note,
      .note blockquote {
        border-color: ButtonBorder;
      }

      .note code,
      .note pre {
        border: var(--imp-border-width, 1px) solid ButtonBorder;
      }
    }
  `,
  onMount: (_instance, { source = null, field = null, label = null } = {}) => {
    const markdown = field
      ? computed([useState('imp.form')], (values) => valueAt(values, field) ?? '')
      : source

    const render = (value) =>
      value?.trim()
        ? div({ class: 'note' }, html(micromark(value)))
        : text({ tone: 'secondary', size: 'sm' }, words('todo.form.notesEmpty'))

    return flex(
      { direction: 'column', gap: 1 },
      label && text({ size: 'sm', weight: 'medium' }, label),
      isState(markdown) ? markdown.view(render) : render(markdown),
    )
  },
})
