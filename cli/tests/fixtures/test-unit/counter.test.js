import { mount } from 'imp'
import { button, div } from 'imp/html'
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
  expect(clicks).toEqual(2)
  expect(document.querySelector('#inc')).toEqual(expect.any(HTMLButtonElement))
})

test('mount replaces previous content', () => {
  document.body.appendChild(div('old'))
  mount(document.body, () => div('new'))
  expect(document.body.textContent).toEqual('new')
})
