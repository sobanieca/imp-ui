export const stats = [
  { label: 'Revenue', value: '$48,290', delta: '+12.4%', trend: 'up' },
  { label: 'Active users', value: '3,128', delta: '+4.1%', trend: 'up' },
  { label: 'Orders', value: '892', delta: '-2.3%', trend: 'down' },
  { label: 'Refunds', value: '$1,204', delta: '-0.8%', trend: 'down' },
]

export const users = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@imp.dev', role: 'Admin', status: 'active', seats: 5 },
  { id: 2, name: 'Alan Turing', email: 'alan@imp.dev', role: 'Editor', status: 'active', seats: 2 },
  {
    id: 3,
    name: 'Grace Hopper',
    email: 'grace@imp.dev',
    role: 'Editor',
    status: 'invited',
    seats: 1,
  },
  {
    id: 4,
    name: 'Linus Pauling',
    email: 'linus@imp.dev',
    role: 'Viewer',
    status: 'suspended',
    seats: 0,
  },
  { id: 5, name: 'Marie Curie', email: 'marie@imp.dev', role: 'Admin', status: 'active', seats: 8 },
  {
    id: 6,
    name: 'Nikola Tesla',
    email: 'nikola@imp.dev',
    role: 'Viewer',
    status: 'invited',
    seats: 1,
  },
]

export const activity = [
  { who: 'Marie Curie', what: 'updated billing plan to Scale', when: '2m ago' },
  { who: 'Alan Turing', what: 'invited grace@imp.dev', when: '1h ago' },
  { who: 'Ada Lovelace', what: 'rotated API keys', when: '3h ago' },
  { who: 'System', what: 'nightly backup completed', when: '6h ago' },
]

export const roles = ['Admin', 'Editor', 'Viewer']
