import { component } from 'imp'
import { div } from 'imp/html'
import { useRoute } from 'imp/router'

export const screenFrame = component('todo-screen-frame', {
  styles: '.frame:focus { outline: none; }',
  setup: (self, slot) => {
    const frame = div({ class: 'frame', tabindex: '-1', role: 'region' }, slot)
    let lastPath = useRoute().get().path
    useRoute().watch(self, ({ path }) => {
      const moved = path !== lastPath
      lastPath = path
      queueMicrotask(() => {
        frame.setAttribute('aria-label', document.title)
        if (moved) frame.focus({ preventScroll: true })
      })
    })
    return frame
  },
})
