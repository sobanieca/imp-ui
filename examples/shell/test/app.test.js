import { mount } from 'imp'
import { navigate } from 'imp/router'
import { beforeEach, expect, test } from 'imp/test'
import { app } from '../src/app.js'

const shellRoot = (root) => root.shadowRoot.querySelector('imp-shell').shadowRoot

const region = (root, selector) => shellRoot(root).querySelector(selector)

const collectDeep = (node, tag) => {
  const root = node.shadowRoot ?? node
  const found = [...root.querySelectorAll(tag)]
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) found.push(...collectDeep(child, tag))
  }
  return found
}

const menu = (root, label) => shellRoot(root).querySelector(`nav[aria-label="${label}"]`)

const links = (root, label) => [...menu(root, label).querySelectorAll('a')]

const hrefs = (root, label) => links(root, label).map((anchor) => anchor.getAttribute('href'))

const marked = (root, label) =>
  links(root, label)
    .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
    .map((anchor) => anchor.getAttribute('href'))

const crumbs = (root) =>
  [...region(root, '.trail imp-breadcrumbs').shadowRoot.querySelectorAll('.crumb')]
    .map((crumb) => crumb.textContent)

const settled = () => new Promise((resolve) => setTimeout(resolve))

const render = () => {
  mount(document.body, app())
  return document.querySelector('app-root')
}

beforeEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
  navigate('/tasks/all', { replace: true })
})

test('the shell frames the screen with a navbar, a sidebar and the extras', () => {
  const root = render()
  expect(region(root, '.topbar')).toEqual(expect.anything())
  expect(region(root, '.sidebar')).toEqual(expect.anything())
  expect(region(root, '.main')).toEqual(expect.anything())
  expect(region(root, '.bar-logo imp-app-logo')).toEqual(expect.anything())
  expect(region(root, '.tools imp-user-card')).toEqual(expect.anything())
})

test('the map gives the navbar the sections and the sidebar the filters under the current one', () => {
  const root = render()
  expect(hrefs(root, 'Sections')).toEqual(['/tasks', '/settings'])
  expect(hrefs(root, 'Filters')).toEqual(['/tasks/all', '/tasks/active', '/tasks/done'])
})

test('the section and the filter for the current path are the marked ones', () => {
  const root = render()
  expect(marked(root, 'Sections')).toEqual(['/tasks'])
  expect(marked(root, 'Filters')).toEqual(['/tasks/all'])
})

test('the trail and the document title follow the route', async () => {
  const root = render()
  expect(crumbs(root)).toEqual(['Tasks', 'All tasks'])
  expect(document.title).toEqual('All tasks - imp tasks')
  navigate('/tasks/2')
  await settled()
  expect(crumbs(root)).toEqual(['Tasks', 'Feed the sidebar from the route'])
  expect(marked(root, 'Filters')).toEqual([])
})

test('the root forwards to the tasks, and the tasks to the first filter', async () => {
  navigate('/', { replace: true })
  render()
  await settled()
  await settled()
  expect(location.pathname).toEqual('/tasks/all')
})

test('the screen lists the seeded tasks', () => {
  const root = render()
  expect(collectDeep(region(root, '.main'), 'todo-row').length).toEqual(4)
})
