import {
  a,
  button,
  code,
  div,
  h1,
  h2,
  input,
  label,
  li,
  mount,
  p,
  pre,
  span,
  strong,
  ul,
} from 'imp'

function demo(title, source, node) {
  return div(
    { class: 'demo' },
    h2(title),
    pre(code(source)),
    div({ class: 'demo-output' }, node),
  )
}

const typeDispatch = demo(
  'Argument dispatch by type, order-independent',
  `p('Hello ', strong('world'), { class: 'lead' })`,
  p({ class: 'lead' }, 'Hello ', strong('world')),
)

const arrayChildren = demo(
  'Arrays are flattened recursively',
  `ul([1, 2, 3].map((n) => li('Item ' + n)))`,
  ul([1, 2, 3].map((n) => li('Item ' + n))),
)

const conditionals = demo(
  'false / null / undefined children are skipped',
  `div('Always', false, null, true && span(' + conditional'))`,
  div('Always', false, null, true && span(' + conditional')),
)

const classForms = demo(
  'class: string, array, or object map',
  `span({ class: ['tag', 'tag-ok'] })\nspan({ class: { tag: true, muted: false } })`,
  div(
    span({ class: ['tag', 'tag-ok'] }, 'array'),
    ' ',
    span({ class: { tag: true, muted: false } }, 'object'),
  ),
)

const styleObject = demo(
  'style: object with camelCase -> kebab and --custom props',
  `div({ style: { padding: '8px', borderRadius: '8px', '--bar': '#6d8bff' } })`,
  div(
    {
      style: {
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'var(--bar)',
        color: '#0f1115',
        fontWeight: 700,
        '--bar': '#6d8bff',
      },
    },
    'Styled via object',
  ),
)

const propertyFirst = demo(
  'Property-first: disabled/checked/value set node properties',
  `input({ type: 'checkbox', checked: true })`,
  label(
    { class: 'inline' },
    input({ type: 'checkbox', checked: true }),
    ' checked is a property, not the literal string',
  ),
)

const events = (() => {
  const out = span({ class: 'count' }, '0')
  let n = 0
  const btn = button(
    {
      class: 'btn',
      events: {
        click: () => {
          out.textContent = String(++n)
        },
      },
    },
    'Click me',
  )
  return demo(
    'events: native names, no "on" prefix — node is a real reference you mutate',
    `events: { click: () => out.textContent = ++n }`,
    div({ class: 'inline' }, btn, ' count: ', out),
  )
})()

const links = demo(
  'Unknown keys (data-*, aria-*, href) become attributes verbatim',
  `a({ href: '#', 'data-id': 42, 'aria-label': 'home' }, 'link')`,
  a({ href: '#', 'data-id': 42, 'aria-label': 'home' }, 'A link with data-id=42'),
)

mount('#app', () =>
  div(
    { class: 'wrap' },
    h1('render.js basics'),
    p({ class: 'muted' }, 'Each block shows the call and its live DOM output.'),
    typeDispatch,
    arrayChildren,
    conditionals,
    classForms,
    styleObject,
    propertyFirst,
    events,
    links,
  ))
