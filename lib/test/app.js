import {
  button,
  component,
  div,
  h1,
  initState,
  input,
  li,
  mergeStates,
  mount,
  span,
  ul,
  useState,
} from 'imp'

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
    const remainingLabel = mergeStates(
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
  onMount: (name, sortValue, child) => {
    initState('board.sort', sortValue)
    return div({ id: `column-${name}` }, child)
  },
})

const todoBoard = component('todo-board', {
  onMount: () => {
    const card = boardCard()
    const moveCard = () => {
      const target = card.closest('#column-a') ? '#column-b' : '#column-a'
      document.querySelector(target).append(card)
    }
    return div(
      button({ id: 'move-card', events: { click: moveCard } }, 'move card'),
      boardColumn('a', 'alpha', card),
      boardColumn('b', 'beta'),
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
    const addItem = () => {
      const draft = document.querySelector('#draft')
      const text = draft.value.trim()
      if (!text) return
      items.set([...items.get(), { text, done: false }])
      draft.value = ''
    }
    return div(
      h1('imp todo'),
      div(
        input({ id: 'draft', placeholder: 'what needs doing?' }),
        button({ id: 'add', events: { click: addItem } }, 'add'),
      ),
      todoList(),
      todoCount(),
      button({ id: 'clear', events: { click: () => items.set([]) } }, 'clear'),
    )
  },
})

mount('#app', div(todoApp(), todoBoard(), keyedNotes()))
