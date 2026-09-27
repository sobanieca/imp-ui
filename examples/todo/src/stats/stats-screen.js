import { component } from 'imp'
import { div } from 'imp/html'
import { luCircleCheck, luCircleDot, luTrendingUp } from 'imp/icons'
import { lang, t } from 'imp/i18n'
import { computed, useState } from 'imp/state'
import { card } from 'imp/std/display'
import { chart } from 'imp/std/data'
import { progress } from 'imp/std/feedback'
import { flex } from 'imp/std/layout'
import { tr, translated } from '../translate.js'
import { countByPriority, countTodos, PRIORITIES } from '../todos/todo-model.js'
import { hero } from '../ui/hero.js'
import { pageStyles } from '../ui/page-styles.js'
import { statTile } from '../ui/stat-tile.js'

const percentDone = ({ done, total }) => (total ? Math.round((done / total) * 100) : 0)

export const statsScreen = component('todo-stats-screen', {
  styles: pageStyles,
  setup: (self) => {
    const items = useState(self, 'todo.items')
    const counts = computed([items], countTodos)
    const perPriority = computed([items], countByPriority)
    return div(
      { class: 'page' },
      hero({
        eyebrow: tr('stats.eyebrow'),
        title: tr('stats.title'),
        subtitle: computed([counts, lang], (current) => t('stats.summary', current)).text(),
      }),
      div(
        { class: 'tiles' },
        statTile({
          glyph: luCircleDot,
          tone: 'amber',
          value: counts.text(({ open }) => String(open)),
          label: tr('stats.open'),
        }),
        statTile({
          glyph: luCircleCheck,
          tone: 'green',
          value: counts.text(({ done }) => String(done)),
          label: tr('stats.done'),
        }),
        statTile({
          glyph: luTrendingUp,
          tone: 'violet',
          value: counts.text((current) => `${percentDone(current)}%`),
          label: tr('stats.completion'),
        }),
      ),
      div(
        { class: 'columns' },
        card(
          { header: tr('stats.chart') },
          chart({
            type: 'column',
            stacked: true,
            label: translated('stats.chart'),
            labels: computed([lang], () => PRIORITIES.map((key) => t(`todos.priorities.${key}`))),
            series: computed([perPriority, lang], (rows) => [
              { name: t('stats.open'), values: rows.map((row) => row.open), color: 'amber' },
              { name: t('stats.done'), values: rows.map((row) => row.done), color: 'green' },
            ]),
          }),
        ),
        card(
          { header: tr('stats.completion') },
          flex(
            { horizontalAlign: 'center' },
            progress({
              shape: 'ring',
              size: 'lg',
              label: translated('stats.completion'),
              value: computed([counts], percentDone),
              showValue: true,
              color: 'violet',
            }),
          ),
        ),
      ),
    )
  },
})
