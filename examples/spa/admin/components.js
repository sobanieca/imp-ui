import {
  a,
  button,
  div,
  h2,
  h3,
  input,
  label,
  li,
  nav,
  option,
  select,
  span,
  table,
  tbody,
  td,
  th,
  thead,
  tr,
  ul,
} from 'imp'

export function statCard({ label: name, value, delta, trend }) {
  return div(
    { class: 'card stat' },
    span({ class: 'stat-label' }, name),
    span({ class: 'stat-value' }, value),
    span({ class: ['stat-delta', `trend-${trend}`] }, delta),
  )
}

export function sidebar({ items, current, onNavigate }) {
  const link = (item) =>
    li(
      a(
        {
          href: `#${item.id}`,
          class: { 'nav-link': true, active: item.id === current },
          events: {
            click: (e) => {
              e.preventDefault()
              onNavigate(item.id)
            },
          },
        },
        span({ class: 'nav-icon', 'aria-hidden': true }, item.icon),
        item.label,
      ),
    )

  return nav(
    { class: 'sidebar' },
    div({ class: 'brand' }, span({ class: 'brand-mark' }, '◆'), 'imp admin'),
    ul({ class: 'nav-list' }, items.map(link)),
  )
}

export function badge(status) {
  return span({ class: ['badge', `badge-${status}`] }, status)
}

export function userTable({ rows, onToggleStatus }) {
  const head = thead(
    tr(['User', 'Role', 'Status', 'Seats', ''].map((h) => th(h))),
  )

  const body = tbody(
    rows.map((u) =>
      tr(
        { 'data-user-id': u.id },
        td(
          div(
            { class: 'user-cell' },
            div({ class: 'avatar' }, u.name.slice(0, 1)),
            div(
              div({ class: 'user-name' }, u.name),
              div({ class: 'user-email' }, u.email),
            ),
          ),
        ),
        td(u.role),
        td(badge(u.status)),
        td(String(u.seats)),
        td(
          { class: 'row-actions' },
          button(
            {
              class: 'btn btn-ghost btn-sm',
              events: { click: () => onToggleStatus(u.id) },
            },
            u.status === 'suspended' ? 'Reactivate' : 'Suspend',
          ),
        ),
      )
    ),
  )

  return table({ class: 'data-table' }, head, body)
}

export function inviteForm({ roleOptions, onSubmit }) {
  const emailInput = input({
    type: 'email',
    name: 'email',
    required: true,
    placeholder: 'name@company.com',
    class: 'input',
  })

  const roleSelect = select(
    { name: 'role', class: 'input' },
    roleOptions.map((r) => option({ value: r }, r)),
  )

  return div(
    { class: 'card' },
    h3('Invite a teammate'),
    div(
      { class: 'form-row' },
      label({ class: 'field' }, span('Email'), emailInput),
      label({ class: 'field' }, span('Role'), roleSelect),
      button(
        {
          class: 'btn btn-primary',
          events: {
            click: () => onSubmit({ email: emailInput.value, role: roleSelect.value }),
          },
        },
        'Send invite',
      ),
    ),
  )
}

export function activityFeed({ items }) {
  return div(
    { class: 'card' },
    h3('Recent activity'),
    ul(
      { class: 'feed' },
      items.map((a) =>
        li(
          { class: 'feed-item' },
          span({ class: 'feed-dot', 'aria-hidden': true }, '•'),
          div(
            div([span({ class: 'feed-who' }, a.who), ' ', a.what]),
            div({ class: 'feed-when' }, a.when),
          ),
        )
      ),
    ),
  )
}

export function pageHeader({ title, subtitle, action }) {
  return div(
    { class: 'page-header' },
    div(h2(title), subtitle && div({ class: 'muted' }, subtitle)),
    action,
  )
}

export function toast(message) {
  return div(
    {
      class: 'toast',
      style: { animationDelay: '0ms' },
    },
    message,
  )
}
