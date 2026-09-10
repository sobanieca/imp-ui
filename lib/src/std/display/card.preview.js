import { card, tag } from 'imp/std/display'
import { button, heading, text } from 'imp/std'
import { div } from 'imp/html'
import { flex, stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Card'
export const group = groups.display

const grid = (...cards) =>
  div(
    {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
        gap: 'var(--imp-space-4, 16px)',
      },
    },
    ...cards,
  )

export const plain = {
  scenario: 'Plain',
  component: card(text('A block of content on a surface, lifted off the page.')),
}

export const withHeaderAndFooter = {
  scenario: 'With a header and a footer',
  component: card(
    {
      header: flex(
        { horizontalAlign: 'justify', verticalAlign: 'center', gap: 2 },
        heading({ level: 2 }, 'Invoices'),
        tag({ size: 'sm' }, '3'),
      ),
      footer: flex(
        { horizontalAlign: 'end', gap: 2 },
        button({ variant: 'primary' }, 'New invoice'),
      ),
    },
    text({ tone: 'secondary' }, 'Three invoices are overdue.'),
  ),
}

export const asLink = {
  scenario: 'As a link',
  component: grid(
    card(
      { href: '/projects/1', label: 'Atlas', header: 'Atlas' },
      text({ tone: 'secondary' }, 'A link card. The whole panel is one anchor.'),
    ),
    card(
      { href: 'https://example.com', label: 'Example', header: 'Example' },
      text({ tone: 'secondary' }, 'An absolute URL leaves the app.'),
    ),
  ),
}

export const paddings = {
  scenario: 'Paddings',
  component: grid(
    card({ padding: 'sm', header: 'Small' }, text('Dense, for a gallery.')),
    card({ header: 'Medium' }, text('The default, for a dashboard.')),
    card({ padding: 'lg', header: 'Large' }, text('Roomy, for one section.')),
  ),
}

export const equalHeights = {
  scenario: 'Equal heights',
  component: grid(
    card({ header: 'Short' }, text('One line.')),
    card(
      { header: 'Tall' },
      stack(
        { gap: 2 },
        text('Several lines.'),
        text('The grid stretches every card.'),
        text('So the rows line up.'),
      ),
    ),
    card({ header: 'Short again' }, text('One line.')),
  ),
}
