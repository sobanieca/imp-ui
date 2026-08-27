import { bugReport } from 'imp/std/feedback'
import { div } from 'imp/html'
import { text } from 'imp/std'

export const name = 'Bug report'
export const category = 'Feedback'
export const description =
  "Run 'imp skill std/bugReport' to learn what bugReport can do before using it."

const remember = (report) => {
  const saved = JSON.parse(localStorage.getItem('preview.bugs') ?? '[]')
  saved.push(report)
  localStorage.setItem('preview.bugs', JSON.stringify(saved))
}

export const asButton = div(
  { style: 'display: flex; flex-direction: column; gap: var(--imp-space-3, 12px)' },
  text('Press the button, then click anything on this page to report it.'),
  bugReport({ onSubmit: remember }),
)

export const asLink = div(
  { style: 'display: flex; flex-direction: column; gap: var(--imp-space-3, 12px)' },
  text('The same flow, rendered as a link in a line of text.'),
  bugReport({ as: 'link', onSubmit: remember }),
)

export const withOwnWording = bugReport(
  {
    as: 'button',
    variant: 'ghost',
    size: 'sm',
    label: 'Something looks wrong',
    onSubmit: remember,
  },
)

export const postingToAnApi = bugReport({
  variant: 'primary',
  onSubmit: (report) =>
    fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    }),
}, 'Report a bug')
