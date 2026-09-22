import { div } from 'imp/html'
import { skeleton } from 'imp/std/feedback'
import { card } from 'imp/std/display'
import { flex, stack } from 'imp/std/layout'
import { groups } from '../preview-groups.js'

export const name = 'Skeleton'
export const group = groups.feedback

const sized = (inlineSize, blockSize, ...children) =>
  div(
    {
      style: {
        '--imp-skeleton-inline-size': inlineSize,
        '--imp-skeleton-block-size': blockSize,
      },
    },
    ...children,
  )

export const line = { scenario: 'One line', component: skeleton() }

export const paragraph = { scenario: 'Paragraph', component: skeleton({ lines: 3 }) }

export const circle = {
  scenario: 'Circle',
  component: flex(
    { gap: 3, verticalAlign: 'center' },
    skeleton({ shape: 'circle' }),
    sized('4rem', null, skeleton({ shape: 'circle' })),
  ),
}

export const block = {
  scenario: 'Block',
  component: stack(
    { gap: 3 },
    skeleton({ shape: 'block' }),
    sized('12rem', '6rem', skeleton({ shape: 'block' })),
  ),
}

export const loadingCard = {
  scenario: 'A card that loads',
  component: div(
    { 'aria-busy': 'true', style: { maxInlineSize: '22rem' } },
    card(
      stack(
        { gap: 4 },
        skeleton({ shape: 'block' }),
        flex(
          { gap: 3, verticalAlign: 'center' },
          skeleton({ shape: 'circle' }),
          div({ style: { flex: '1 1 auto' } }, skeleton({ lines: 2 })),
        ),
        skeleton({ lines: 3 }),
      ),
    ),
  ),
}
