import { faIcon } from 'imp/std'
import {
  faBell,
  fabGithub,
  fabLinkedin,
  fabXTwitter,
  faCalendar,
  faCircleCheck,
  faCloudArrowUp,
  faGear,
  faHouse,
  faMagnifyingGlass,
  farBell,
  farCalendar,
  farCircleCheck,
  farHeart,
  farStar,
  faStar,
  faTrash,
  faTriangleExclamation,
  faUser,
} from 'imp/icons'
import { flex } from 'imp/std/layout'
import { div, span } from 'imp/html'

export const name = 'Font Awesome icon'
export const category = 'General'
export const description = "Run 'imp skill std/faIcon' to learn what faIcon can do before using it."

const labelled = (label, node) =>
  div(
    { style: 'display: grid; justify-items: center; gap: 4px; inline-size: 7rem' },
    node,
    span({ style: 'font-size: 0.75rem; opacity: 0.7' }, label),
  )

export const solid = flex(
  { wrap: true, gap: 3 },
  ...[
    ['faHouse', faHouse],
    ['faMagnifyingGlass', faMagnifyingGlass],
    ['faGear', faGear],
    ['faUser', faUser],
    ['faBell', faBell],
    ['faTrash', faTrash],
    ['faStar', faStar],
    ['faCalendar', faCalendar],
    ['faCloudArrowUp', faCloudArrowUp],
  ].map(([label, glyph]) => labelled(label, faIcon(glyph))),
)

export const regular = flex(
  { wrap: true, gap: 3 },
  ...[
    ['farBell', farBell],
    ['farStar', farStar],
    ['farHeart', farHeart],
    ['farCalendar', farCalendar],
    ['farCircleCheck', farCircleCheck],
  ].map(([label, glyph]) => labelled(label, faIcon(glyph))),
)

export const brands = flex(
  { wrap: true, gap: 3 },
  ...[
    ['fabGithub', fabGithub],
    ['fabLinkedin', fabLinkedin],
    ['fabXTwitter', fabXTwitter],
  ].map(([label, glyph]) => labelled(label, faIcon(glyph))),
)

export const sizes = flex(
  { verticalAlign: 'center', gap: 3 },
  faIcon(faStar, { size: 'sm' }),
  faIcon(faStar, { size: 'md' }),
  faIcon(faStar, { size: 'lg' }),
  faIcon(faStar, { size: '3rem' }),
)

export const themeColors = flex(
  { wrap: true, gap: 3 },
  ...['primary', 'secondary', 'danger', 'success', 'warning', 'info', 'jade', 'violet'].map(
    (color) => labelled(color, faIcon(faCircleCheck, { color, size: 'lg' })),
  ),
)

export const inheritsTheTextColor = div(
  { style: 'color: crimson; display: flex; gap: 8px; align-items: center' },
  faIcon(faTriangleExclamation),
  span('colored by the box around it'),
)

export const named = faIcon(faTrash, { label: 'Delete invoice' })

export const missingIconWarns = faIcon({ label: 'Nothing to draw' })
