import { button, div, h1, input, li, mount, span, ul } from 'imp'

const items = []

const render = () => {
  document.querySelector('#list').replaceChildren(
    ...items.map((item) =>
      li(
        {
          class: { done: item.done },
          events: {
            click: () => {
              item.done = !item.done
              render()
            },
          },
        },
        item.text,
      )
    ),
  )
  const remaining = items.filter((item) => !item.done).length
  document.querySelector('#count').textContent = `${remaining} left`
}

const addItem = () => {
  const draft = document.querySelector('#draft')
  const text = draft.value.trim()
  if (!text) return
  items.push({ text, done: false })
  draft.value = ''
  render()
}

const clearItems = () => {
  items.length = 0
  render()
}

const view = () =>
  div(
    h1('imp todo'),
    div(
      input({ id: 'draft', placeholder: 'what needs doing?' }),
      button({ id: 'add', events: { click: addItem } }, 'add'),
    ),
    ul({ id: 'list' }),
    span({ id: 'count' }, '0 left'),
    button({ id: 'clear', events: { click: clearItems } }, 'clear'),
  )

mount('#app', view)
