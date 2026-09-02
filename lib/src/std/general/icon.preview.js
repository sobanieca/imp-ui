import { icon } from 'imp/std'
import {
  luBell,
  luCalendar,
  luChartColumn,
  luCircleCheck,
  luCloudUpload,
  luFolder,
  luHeart,
  luHouse,
  luPencil,
  luSearch,
  luSettings,
  luStar,
  luTrash,
  luTriangleAlert,
  luUser,
  luUsers,
} from 'imp/icons'
import { flex } from 'imp/std/layout'
import { div, span } from 'imp/html'

export const name = 'Icon'
export const group = 'General'
export const description = "Run 'imp skill std/icon' to learn what icon can do before using it."

const labelled = (label, drawing) =>
  div(
    { style: 'display: grid; justify-items: center; gap: 4px; inline-size: 7rem' },
    icon(drawing),
    span({ style: 'font-size: 0.75rem; opacity: 0.7' }, label),
  )

export const someIcons = flex(
  { wrap: true, gap: 3 },
  ...[
    ['luHouse', luHouse],
    ['luSearch', luSearch],
    ['luSettings', luSettings],
    ['luUser', luUser],
    ['luUsers', luUsers],
    ['luBell', luBell],
    ['luFolder', luFolder],
    ['luPencil', luPencil],
    ['luTrash', luTrash],
    ['luChartColumn', luChartColumn],
    ['luCalendar', luCalendar],
    ['luCloudUpload', luCloudUpload],
  ].map(([label, drawing]) => labelled(label, drawing)),
)

export const sizes = flex(
  { verticalAlign: 'center', gap: 3 },
  icon(luStar, { size: 'sm' }),
  icon(luStar, { size: 'md' }),
  icon(luStar, { size: 'lg' }),
  icon(luStar, { size: '3rem' }),
)

export const themeColors = flex(
  { wrap: true, gap: 3 },
  ...['primary', 'secondary', 'danger', 'success', 'warning', 'info', 'jade', 'violet'].map(
    (color) =>
      div(
        { style: 'display: grid; justify-items: center; gap: 4px; inline-size: 7rem' },
        icon(luCircleCheck, { color, size: 'lg' }),
        span({ style: 'font-size: 0.75rem; opacity: 0.7' }, color),
      ),
  ),
)

export const inheritsTheTextColor = div(
  { style: 'color: crimson; display: flex; gap: 8px; align-items: center' },
  icon(luHeart),
  icon(luTriangleAlert),
  span('colored by the box around it'),
)

export const named = icon(luTrash, { label: 'Delete invoice' })

export const missingIconWarns = icon({ label: 'Nothing to draw' })
