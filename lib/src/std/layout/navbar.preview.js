import { navbar } from 'imp/std/layout'
import { button, heading, text } from 'imp/std'

export const name = 'Navbar'
export const category = 'Layout'
export const description = "Run 'imp skill std/navbar' to learn what navbar can do before using it."

export const plain = navbar(
  { label: 'Top bar' },
  heading({ level: 1 }, 'Acme'),
  text({ tone: 'secondary', size: 'sm' }, 'staging'),
)

export const spread = navbar(
  { label: 'Top bar', justify: 'between' },
  heading({ level: 1 }, 'Acme'),
  button({ variant: 'ghost' }, 'Sign out'),
)

export const wrapping = navbar(
  { label: 'Top bar', wrap: true, gap: 2 },
  heading({ level: 1 }, 'Acme'),
  ...['Overview', 'Reports', 'Settings', 'Members', 'Billing', 'Integrations'].map((label) =>
    button({ variant: 'ghost', size: 'sm' }, label)
  ),
)
