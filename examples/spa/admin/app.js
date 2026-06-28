import { button, div, mount, span } from '../../../src/imp.js'
import { activity, roles, stats, users } from './data.js'
import {
  activityFeed,
  inviteForm,
  pageHeader,
  sidebar,
  statCard,
  toast,
  userTable,
} from './components.js'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'team', label: 'Team', icon: '☺' },
  { id: 'activity', label: 'Activity', icon: '↻' },
]

const state = {
  route: 'dashboard',
  users: users.map((u) => ({ ...u })),
}

function flash(message) {
  const node = toast(message)
  document.querySelector('#toasts').appendChild(node)
  setTimeout(() => node.remove(), 2600)
}

function navigate(route) {
  state.route = route
  render()
}

function toggleStatus(id) {
  const user = state.users.find((u) => u.id === id)
  user.status = user.status === 'suspended' ? 'active' : 'suspended'
  flash(`${user.name} is now ${user.status}`)
  render()
}

function sendInvite({ email, role }) {
  if (!email) return flash('Enter an email to send an invite')
  state.users.push({
    id: state.users.length + 1,
    name: email.split('@')[0],
    email,
    role,
    status: 'invited',
    seats: 1,
  })
  flash(`Invited ${email} as ${role}`)
  render()
}

function dashboard() {
  return div(
    pageHeader({
      title: 'Dashboard',
      subtitle: 'Overview of your workspace',
    }),
    div({ class: 'stat-grid' }, stats.map(statCard)),
    div(
      { class: 'split' },
      div(
        { class: 'card' },
        pageHeader({ title: 'Team', subtitle: `${state.users.length} members` }),
        userTable({ rows: state.users.slice(0, 4), onToggleStatus: toggleStatus }),
      ),
      activityFeed({ items: activity }),
    ),
  )
}

function team() {
  return div(
    pageHeader({
      title: 'Team',
      subtitle: 'Manage members and invitations',
      action: button(
        { class: 'btn btn-ghost', events: { click: () => navigate('dashboard') } },
        '← Back',
      ),
    }),
    inviteForm({ roleOptions: roles, onSubmit: sendInvite }),
    div(
      { class: 'card' },
      userTable({ rows: state.users, onToggleStatus: toggleStatus }),
    ),
  )
}

function activityPage() {
  return div(
    pageHeader({ title: 'Activity', subtitle: 'Everything happening in your workspace' }),
    activityFeed({ items: activity }),
  )
}

const pages = { dashboard, team, activity: activityPage }

function render() {
  mount('#app', () =>
    div(
      { class: 'shell' },
      sidebar({ items: navItems, current: state.route, onNavigate: navigate }),
      div(
        { class: 'content' },
        div(
          { class: 'topbar' },
          span({ class: 'muted' }, 'Workspace / ', state.route),
          div(
            { class: 'topbar-right' },
            span({ class: 'badge badge-active' }, 'Live'),
            span({ class: 'avatar avatar-sm' }, 'A'),
          ),
        ),
        div({ class: 'page' }, pages[state.route]()),
      ),
    ))
}

render()
