import { component, init, mount } from 'imp'
import { button, div, h1, input, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { applyTheme } from 'imp/theme'
import { lang, setLang, t } from 'imp/i18n'
import { button as stdButton, heading, link, text } from 'imp/std'
import { emptyState } from 'imp/std/display'
import { box, container, flex, grid, section, sidebar } from 'imp/std/layout'
import { checkbox, form, select, submitButton, textField } from 'imp/std/inputs'
import { bugReport } from 'imp/std/feedback'

const demoMessages = {
  en: { demo: { title: 'Translations', notes: 'Notes: {total}' } },
  pl: {
    demo: { title: 'Tłumaczenia', notes: 'Notatki: {total}' },
    imp: { state: { empty: 'Nic tu jeszcze nie ma' } },
  },
}

await init({
  theme: 'imp-light',
  lang: 'en',
  translations: {
    en: () => Promise.resolve({ default: demoMessages.en }),
    pl: () => Promise.resolve({ default: demoMessages.pl }),
  },
})

const todoList = component('todo-list', {
  onMount: () => {
    const items = useState('todo.items')
    const toggleItem = (index) => {
      items.set(
        items.get().map((item, i) => i === index ? { ...item, done: !item.done } : item),
      )
    }
    return ul(
      { id: 'list' },
      items.each((item, index) =>
        li(
          {
            class: { done: item.done },
            events: { click: () => toggleItem(index) },
          },
          item.text,
        )
      ),
    )
  },
})

const todoCount = component('todo-count', {
  placeholder: () => span({ id: 'count' }, '…'),
  onMount: () => {
    const items = useState('todo.items')
    const remainingLabel = computed(
      [items],
      (current) => `${current.filter((item) => !item.done).length} left`,
    )
    return span({ id: 'count' }, remainingLabel.text())
  },
})

const boardCard = component('board-card', {
  onMount: () => {
    const sort = useState('board.sort')
    return div(
      input({ id: 'card-input' }),
      span({ id: 'card-sort' }, sort.text()),
    )
  },
})

const boardColumn = component('board-column', {
  onMount: (_instance, sortValue, slot) => {
    initState('board.sort', sortValue)
    return slot
  },
})

const todoBoard = component('todo-board', {
  onMount: () => {
    const card = boardCard()
    const columnA = div({ id: 'column-a' }, card)
    const columnB = div({ id: 'column-b' })
    const moveCard = () => {
      const target = columnA.contains(card) ? columnB : columnA
      target.append(card)
    }
    return div(
      button({ id: 'move-card', events: { click: moveCard } }, 'move card'),
      boardColumn('alpha', columnA),
      boardColumn('beta', columnB),
    )
  },
})

const keyedNotes = component('keyed-notes', {
  onMount: () => {
    const notes = initState('notes.items', [
      { id: 'one', title: 'first note', done: false },
      { id: 'two', title: 'second note', done: false },
    ])
    const toggleNote = (id) => {
      notes.set(
        notes.get().map((note) => note.id === id ? { ...note, done: !note.done } : note),
      )
    }
    return ul(
      { id: 'notes' },
      notes.each(
        (note) =>
          li(
            { id: `note-${note.id}`, class: { done: note.done } },
            span(note.title),
            input({ class: 'note-draft' }),
            button(
              { class: 'note-toggle', events: { click: () => toggleNote(note.id) } },
              'toggle',
            ),
          ),
        (note) => note.id,
      ),
    )
  },
})

const todoApp = component('todo-app', {
  onMount: () => {
    const items = initState('todo.items', [])
    const draft = input({ id: 'draft', placeholder: 'what needs doing?' })
    const addItem = () => {
      const text = draft.value.trim()
      if (!text) return
      items.set([...items.get(), { text, done: false }])
      draft.value = ''
    }
    return div(
      h1('imp todo'),
      div(
        draft,
        button({ id: 'add', events: { click: addItem } }, 'add'),
      ),
      todoList(),
      todoCount(),
      button({ id: 'clear', events: { click: () => items.set([]) } }, 'clear'),
    )
  },
})

const stdShowcase = component('std-showcase', {
  onMount: () =>
    div(
      { id: 'std' },
      heading({ level: 2 }, 'std components'),
      text({ tone: 'secondary' }, 'secondary copy'),
      stdButton(
        { variant: 'primary', events: { click: () => applyTheme('imp-dark') } },
        'go dark',
      ),
      link({ href: '/about' }, 'about'),
    ),
})

const i18nShowcase = component('i18n-showcase', {
  onMount: () =>
    div(
      { id: 'i18n' },
      span({ id: 'i18n-title' }, lang.text(() => t('demo.title'))),
      span({ id: 'i18n-notes' }, lang.text(() => t('demo.notes', { total: 3 }))),
      button({ id: 'to-polish', events: { click: () => setLang('pl') } }, 'polski'),
      button({ id: 'to-english', events: { click: () => setLang('en') } }, 'english'),
      emptyState({ description: 'nothing to show' }),
    ),
})

const layoutShowcase = component('layout-showcase', {
  onMount: () =>
    div(
      { id: 'layout' },
      div(
        { id: 'switching' },
        flex(
          { direction: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 5 } },
          span('first'),
          span('second'),
        ),
      ),
      div({ id: 'cards' }, grid({ columns: { xs: 1, md: 3 } }, span('a'), span('b'), span('c'))),
      div({ id: 'bar' }, flex(flex({ grow: true }, span('grows')), span('fixed'))),
      div({ id: 'desktop-only' }, flex({ hideBelow: 'md' }, span('wide screens only'))),
      div(
        { id: 'resizing' },
        sidebar(
          {
            label: 'Sections',
            resizable: true,
            collapsible: false,
            minWidth: 'sm',
            maxWidth: 'lg',
          },
          span('sections'),
        ),
      ),
      div(
        { id: 'panel' },
        box(
          { padding: { xs: 2, md: 5 }, radius: 'lg', border: true, ratio: '2/1' },
          span('panel'),
        ),
      ),
      div({ id: 'centred' }, container({ size: 'sm' }, span('centred'))),
      div({ id: 'band' }, section({ size: 'lg', label: 'Band' }, span('band'))),
    ),
})

const submissions = []

const formShowcase = component('form-showcase', {
  onMount: () =>
    div(
      { id: 'forms' },
      form(
        {
          initialValues: { user: { firstName: 'Ada' }, plan: 'pro', terms: false },
          onSubmit: (values) => {
            submissions.push(values)
            globalThis.__impSubmitted = JSON.stringify(values)
          },
        },
        textField({ field: 'user.firstName', label: 'First name', required: true }),
        select({ field: 'plan', label: 'Plan', options: ['free', 'pro', 'team'] }),
        checkbox({ field: 'terms', label: 'I accept the terms', required: true }),
        submitButton('Save'),
      ),
    ),
})

const bugShowcase = component('bug-showcase', {
  onMount: () => {
    initState('bug.screen', { step: 'checkout', retries: 2 })
    return div(
      { id: 'bugs' },
      span({ id: 'faulty' }, 'the faulty bit'),
      input({ id: 'note', name: 'note', value: '' }),
      bugReport({
        onSubmit: (report) => {
          globalThis.__impBugReport = JSON.stringify(report)
        },
      }),
    )
  },
})

mount(
  '#app',
  div(
    todoApp(),
    todoBoard(),
    keyedNotes(),
    stdShowcase(),
    layoutShowcase(),
    formShowcase(),
    i18nShowcase(),
    bugShowcase(),
  ),
)
