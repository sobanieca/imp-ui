import {
  el, render, h1, h2, p, div, ul, li, button, span, strong, hr,
} from '../src/imp.js'

// `code` isn't in the explicit tag list — show how to fall back to raw el().
const code = (text) => el('code', text)

// Components are lowercase functions returning real DOM nodes —
// same casing as tag factories. See notes.md §1.
function greeting({ name }) {
  return p([
    'Hello, ',
    strong(name),
    '! This paragraph was built by ',
    code('el()'),
    '.',
  ])
}

// Imperative interactivity, no signals yet (layer 2). The notes say plain
// DOM mutation is a first-class path — useful as proof that el() returns real
// nodes we can hold a reference to.
function counter() {
  let count = 0
  const display = span({ style: { fontWeight: 'bold' } }, '0')

  return div({ style: { marginTop: '12px' } }, [
    button({
      onClick: () => { count -= 1; display.textContent = String(count) },
    }, '−'),
    span({ style: { margin: '0 12px' } }, [display]),
    button({
      onClick: () => { count += 1; display.textContent = String(count) },
    }, '+'),
  ])
}

function app() {
  return div(
    { style: { fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: '600px' } },
    [
      h1('imp-ui — Layer 1 draft'),
      greeting({ name: 'world' }),
      hr(),
      h2('Counter (imperative)'),
      p('No signals yet. The button handlers mutate the textContent of a node reference returned by el().'),
      counter(),
      hr(),
      h2('Static list'),
      ul(['element factory', 'real DOM', 'no build step'].map(item => li(item))),
    ],
  )
}

render(app(), '#app')
