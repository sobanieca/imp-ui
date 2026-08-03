import { expect, test } from 'imp/test'
import { summarize, visibleTodos } from '../src/todos.js'

const todos = [
  { id: 't1', title: 'Buy milk', notes: 'oat', priority: 'low', estimate: 1, done: false },
  { id: 't2', title: 'Write tests', notes: '', priority: 'high', estimate: 2, done: false },
  {
    id: 't3',
    title: 'Ship it',
    notes: 'after the tests',
    priority: 'normal',
    estimate: 4,
    done: true,
  },
  {
    id: 't4',
    title: 'Call the bank',
    notes: '',
    priority: 'normal',
    estimate: 0.5,
    pinned: true,
    done: false,
  },
]

for (const [status, expected] of [['all', 4], ['open', 3], ['done', 1]]) {
  test(`the '${status}' filter keeps ${expected} of them`, () => {
    expect(visibleTodos(todos, { status }).length).toEqual(expected)
  })
}

test('the search looks at the notes as well as the title', () => {
  expect(visibleTodos(todos, { query: 'tests' }).map((todo) => todo.id))
    .toEqual(['t2', 't3'])
})

test('the search ignores case and surrounding spaces', () => {
  expect(visibleTodos(todos, { query: '  MILK ' }).map((todo) => todo.id)).toEqual(['t1'])
})

test('pinned todos come first, then the higher priority', () => {
  expect(visibleTodos(todos, { status: 'open' }).map((todo) => todo.id))
    .toEqual(['t4', 't2', 't1'])
})

test('filters combine', () => {
  expect(visibleTodos(todos, { query: 'the', status: 'done' }).map((todo) => todo.id))
    .toEqual(['t3'])
})

test('the summary counts what is left to do', () => {
  expect(summarize(todos)).toEqual({ total: 4, done: 1, open: 3, hours: 3.5 })
})
