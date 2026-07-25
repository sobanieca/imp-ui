import { component, mount } from 'imp'
import { button, div, h1, input, li, span, ul } from 'imp/html'
import { computed, initState, useState } from 'imp/state'
import { applyTheme } from 'imp/theme'
import { button as stdButton, heading, link, text } from 'imp/std'

applyTheme('default-light')

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
        { variant: 'primary', events: { click: () => applyTheme('default-dark') } },
        'go dark',
      ),
      link({ href: '/about' }, 'about'),
    ),
})

mount('#app', div(todoApp(), todoBoard(), keyedNotes(), stdShowcase()))
