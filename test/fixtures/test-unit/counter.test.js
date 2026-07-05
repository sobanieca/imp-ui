import { button, div, mount } from 'imp'
import { beforeEach, expect, test } from 'imp/test'

let clicks

const counter = () => div(button({ id: 'inc', events: { click: () => clicks++ } }, 'add'))

beforeEach(() => {
  clicks = 0
  document.body.replaceChildren()
})

test('renders and reacts to clicks', () => {
  mount(document.body, counter)
  document.querySelector('#inc').click()
  document.querySelector('#inc').click()
  expect(clicks).toBe(2)
  expect(document.querySelector('#inc')).toBeInstanceOf(HTMLButtonElement)
})

test('mount replaces previous content', () => {
  document.body.appendChild(div('old'))
  mount(document.body, () => div('new'))
  expect(document.body.textContent).toBe('new')
})
