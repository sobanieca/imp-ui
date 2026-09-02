import { tabs } from 'imp/std/navigation'
import { text } from 'imp/std'
import { div } from 'imp/html'

export const name = 'Tabs'
export const group = 'Navigation'
export const description = "Run 'imp skill std/tabs' to learn what tabs can do before using it."

const panel = (body) =>
  div({ style: 'display: flex; flex-direction: column; gap: var(--imp-space-2, 8px)' }, text(body))

const accountItems = () => [
  { id: 'overview', label: 'Overview', content: panel('What this account is for.') },
  { id: 'usage', label: 'Usage', content: panel('How much of the plan is used.') },
  { id: 'billing', label: 'Billing', content: panel('Invoices and payment method.') },
]

export const horizontal = tabs({ label: 'Account sections', items: accountItems() })

export const vertical = tabs({
  label: 'Account sections',
  orientation: 'vertical',
  items: accountItems(),
})

export const preselected = tabs({
  label: 'Account sections',
  selected: 'billing',
  items: accountItems(),
})

export const withDisabledItem = tabs({
  label: 'Account sections',
  items: [
    { id: 'overview', label: 'Overview', content: panel('Always available.') },
    { id: 'usage', label: 'Usage', content: panel('Unreachable.'), disabled: true },
    { id: 'billing', label: 'Billing', content: panel('Also available.') },
  ],
})

export const manyItems = tabs({
  label: 'Report sections',
  items: Array.from({ length: 8 }, (_unused, index) => ({
    id: `section-${index}`,
    label: `Section ${index + 1}`,
    content: panel(`The body of section ${index + 1}.`),
  })),
})

export const withSelectHandler = tabs({
  label: 'Account sections',
  items: accountItems(),
  events: { select: (event) => console.log('selected', event.detail.id) },
})
