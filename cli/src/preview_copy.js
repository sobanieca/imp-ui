import { button } from 'imp/std'

const COPIED_FEEDBACK_MS = 1200

export const copyButton = (content) => {
  const label = document.createTextNode('copy')
  return button(
    {
      size: 'sm',
      variant: 'ghost',
      events: {
        click: async () => {
          try {
            await navigator.clipboard.writeText(content)
            label.data = 'copied'
          } catch {
            label.data = 'could not copy'
          }
          setTimeout(() => {
            label.data = 'copy'
          }, COPIED_FEEDBACK_MS)
        },
      },
    },
    label,
  )
}
