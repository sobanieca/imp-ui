import { accordion, tag } from 'imp/std/display'
import { button, text } from 'imp/std'
import { stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Accordion'
export const group = groups.display

const shippingPanel = () =>
  stack(
    { gap: 2 },
    text('Orders leave the warehouse within two working days.'),
    text({ tone: 'secondary', size: 'sm' }, 'Delivery in the EU takes three to five days.'),
  )

const faqItems = () => [
  { id: 'shipping', title: 'Shipping', content: shippingPanel(), open: true },
  { id: 'returns', title: 'Returns', content: 'Send it back within 30 days.' },
  {
    id: 'warranty',
    title: 'Warranty',
    content: 'Every product has a warranty of two years from the day of delivery.',
  },
]

export const oneAtATime = {
  scenario: 'One section at a time',
  component: accordion({ items: faqItems() }),
}

export const severalOpen = {
  scenario: 'Several sections open',
  component: accordion({
    multiple: true,
    items: [
      { id: 'profile', title: 'Profile', content: 'Your name and your picture.', open: true },
      { id: 'security', title: 'Security', content: 'Password and sign-in keys.', open: true },
      { id: 'billing', title: 'Billing', content: 'The plan and the payment method.' },
    ],
  }),
}

export const richContent = {
  scenario: 'Components as content',
  component: accordion({
    items: [
      {
        id: 'plan',
        title: 'Your plan',
        open: true,
        content: stack(
          { gap: 3, horizontalAlign: 'start' },
          tag({ color: 'green', dot: true }, 'Active'),
          text('The Team plan renews on the first day of each month.'),
          button({ variant: 'primary' }, 'Change the plan'),
        ),
      },
      { id: 'invoices', title: 'Invoices', content: 'There are no invoices yet.' },
    ],
  }),
}

export const longTitle = {
  scenario: 'A long title',
  component: accordion({
    items: [
      {
        id: 'long',
        title:
          'What happens to the data of my team when the owner of the workspace deletes the account?',
        content: 'The data stays for 30 days. After that, the service deletes it.',
      },
      { id: 'short', title: 'Can I export it?', content: 'Yes, as one archive.' },
    ],
  }),
}
