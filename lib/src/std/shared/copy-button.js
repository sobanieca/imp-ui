import { button } from '../general/button.js'
import { icon } from '../general/icon.js'
import { tooltip } from '../display/tooltip.js'
import { luCheck, luCopy } from '../../icons/lucide-icons.js'
import { initState } from '../../state.js'

const COPIED_FEEDBACK_MS = 1200

const IDLE = 'copy'

export const copyButton = (self, name, content) => {
  const feedback = initState(self, `imp.copyButton.${name}`, IDLE)
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
