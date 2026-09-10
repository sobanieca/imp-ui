import { button, icon } from 'imp/std'
import { tooltip } from 'imp/std/display'
import { luCheck, luCopy } from 'imp/icons'
import { initState } from 'imp/state'

const COPIED_FEEDBACK_MS = 1200

const IDLE = 'copy'

export const copyButton = (self, name, content) => {
  const feedback = initState(self, `imp.preview.copy.${name}`, IDLE)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof content === 'function' ? content() : content)
      feedback.set('copied')
    } catch {
      feedback.set('could not copy')
    }
    setTimeout(() => feedback.set(IDLE), COPIED_FEEDBACK_MS)
  }
  return tooltip(
    { text: feedback },
    button(
      { size: 'sm', variant: 'ghost', label: feedback, events: { click: copy } },
      feedback.view((state) => icon(state === 'copied' ? luCheck : luCopy)),
    ),
  )
}
