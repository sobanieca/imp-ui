import {
  button,
  component,
  div,
  h1,
  h2,
  initState,
  input,
  mount,
  span,
  strong,
  useState,
} from 'imp'

let draggedCard = null

const STAGES = [
  { id: 'new', label: 'new' },
  { id: 'progress', label: 'in progress' },
  { id: 'done', label: 'done' },
]

const todoCard = component('todo-card', {
  onMount: () => {
    const stage = useState('board.stage')
    const title = initState('card.title', 'untitled')
    const field = input({ placeholder: 'what needs doing?' })
    const save = () => title.set(field.value.trim() || 'untitled')
    const startDrag = (event) => {
      draggedCard = event.target.closest('todo-card')
      event.dataTransfer.setData('text/plain', 'todo-card')
      event.dataTransfer.effectAllowed = 'move'
    }
    return div(
      { class: 'card' },
      div(
        { class: 'card-top' },
        span(
          {
            class: 'grip',
            draggable: true,
            events: {
              dragstart: startDrag,
              dragend: () => {
                draggedCard = null
              },
            },
          },
          '⠿',
        ),
        strong(title.text()),
        stage.view((current) =>
          span({ class: ['badge', `badge-${current.replaceAll(' ', '-')}`] }, current)
        ),
      ),
      div({ class: 'card-edit' }, field, button({ events: { click: save } }, 'save')),
    )
  },
})

const boardColumn = component('board-column', {
  onMount: ({ id, label }) => {
    initState('board.stage', label)
    const acceptCard = (event) => {
      event.preventDefault()
      event.currentTarget.classList.remove('drag-over')
      if (draggedCard) event.currentTarget.querySelector('.cards').append(draggedCard)
    }
    return div(
      {
        class: 'column',
        id: `column-${id}`,
        events: {
          dragover: (event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            event.currentTarget.classList.add('drag-over')
          },
          dragleave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              event.currentTarget.classList.remove('drag-over')
            }
          },
          drop: acceptCard,
        },
      },
      h2(label),
      div({ class: 'cards' }),
    )
  },
})

const todoBoard = component('todo-board', {
  onMount: () => {
    const addCard = () => document.querySelector('#column-new .cards').prepend(todoCard())
    return div(
      { class: 'board-wrap' },
      div(
        { class: 'toolbar' },
        h1('imp board'),
        button({ class: 'add', events: { click: addCard } }, '+ new card'),
      ),
      div({ class: 'board' }, STAGES.map((stage) => boardColumn(stage))),
    )
  },
})

mount('#app', todoBoard())
