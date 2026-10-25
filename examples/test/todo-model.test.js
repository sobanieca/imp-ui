import { expect, test } from 'imp/test'
import {
  countByPriority,
  countTodos,
  filterTodos,
  formatDate,
  replaceTodo,
  sortTodos,
} from '../src/todos/todo-model.js'

const todos = [
  { id: '1', title: 'Write docs', priority: 'low', done: true },
  { id: '2', title: 'Fix bug', priority: 'high', due: '2026-10-02', done: false },
  { id: '3', title: 'Review', priority: 'high', due: '2026-10-01', done: false },
  { id: '4', title: 'Plan', priority: 'normal', done: false },
]

const ids = (list) => list.map((todo) => todo.id)

test('the filters keep the open, the done or every todo', () => {
  expect(ids(filterTodos(todos, 'all'))).toEqual(['1', '2', '3', '4'])
  expect(ids(filterTodos(todos, 'active'))).toEqual(['2', '3', '4'])
  expect(ids(filterTodos(todos, 'completed'))).toEqual(['1'])
})

test('the sort puts open todos first, then priority, then the due date', () => {
  expect(ids(sortTodos(todos))).toEqual(['3', '2', '4', '1'])
})

test('the sort does not change the list it gets', () => {
  sortTodos(todos)
  expect(ids(todos)).toEqual(['1', '2', '3', '4'])
})

test('the counts treat an unknown list as empty', () => {
  expect(countTodos(todos)).toEqual({ total: 4, done: 1, open: 3 })
  expect(countTodos(undefined)).toEqual({ total: 0, done: 0, open: 0 })
})

test('the counts per priority split open and done', () => {
  expect(countByPriority(todos)).toEqual([
    { priority: 'low', open: 0, done: 1 },
    { priority: 'normal', open: 1, done: 0 },
    { priority: 'high', open: 2, done: 0 },
  ])
})

test('a replace swaps one todo by id', () => {
  const updated = { ...todos[3], done: true }
  expect(replaceTodo(todos, updated)[3]).toEqual(updated)
  expect(replaceTodo(todos, updated)[0]).toEqual(todos[0])
})

test('a date is formatted in the language of the app', () => {
  expect(formatDate('2026-10-01', 'en')).toEqual('Oct 1, 2026')
  expect(formatDate('2026-10-01', 'pl')).toMatch('2026')
})
