import { columns, stack } from 'imp/std/layout'
import { card } from 'imp/std/display'
import { heading, text } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Columns'
export const group = groups.layout

const panel = (title, body) =>
  card({ header: heading({ level: 2 }, title) }, text({ tone: 'secondary' }, body))

export const defaults = {
  scenario: 'Two equal columns',
  component: columns(
    panel('Members', 'Who is in the team.'),
    panel('Reminders', 'What goes out every week.'),
  ),
}

export const weighted = {
  scenario: 'A main column and a side column',
  component: columns(
    { weights: [2, 1] },
    stack(
      { gap: 4 },
      panel('Answers', 'Who said ready.'),
      panel('Waiting', 'Who has not answered.'),
    ),
    panel('Links', 'The personal links of the check.'),
  ),
}

export const narrow = {
  scenario: 'A large minimum, so the columns wrap',
  component: columns(
    { minInlineSize: '40rem', gap: 3 },
    panel('First', 'Wraps under the second when the row is narrow.'),
    panel('Second', 'Each column takes the whole row then.'),
  ),
}
