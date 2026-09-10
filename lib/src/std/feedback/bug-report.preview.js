import { bugReport } from 'imp/std/feedback'
import { div } from 'imp/html'
import { text } from 'imp/std'
import { groups } from '../preview-groups.js'

export const name = 'Bug report'
export const group = groups.feedback

const remember = (report) => {
  const saved = JSON.parse(localStorage.getItem('preview.bugs') ?? '[]')
  saved.push(report)
  localStorage.setItem('preview.bugs', JSON.stringify(saved))
}

export const asButton = {
  scenario: 'As a button',
  component: div(
    { style: 'display: flex; flex-direction: column; gap: var(--imp-space-3, 12px)' },
    text('Press the button, then click anything on this page to report it.'),
    bugReport({ onSubmit: remember }),
  ),
}

export const asLink = {
  scenario: 'As a link',
  component: div(
    { style: 'display: flex; flex-direction: column; gap: var(--imp-space-3, 12px)' },
    text('The same flow, rendered as a link in a line of text.'),
    bugReport({ as: 'link', onSubmit: remember }),
  ),
}

export const withOwnWording = {
  scenario: 'With its own wording',
  component: bugReport(
    {
      as: 'button',
      variant: 'ghost',
      size: 'sm',
      label: 'Something looks wrong',
      onSubmit: remember,
    },
  ),
}

export const postingToAnApi = {
  scenario: 'Posting to an API',
  component: bugReport({
    variant: 'primary',
    onSubmit: (report) =>
      fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(report),
      }),
  }, 'Report a bug'),
}
