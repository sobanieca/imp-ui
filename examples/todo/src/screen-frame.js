import { component } from 'imp'
import { div } from 'imp/html'
import { useRoute } from 'imp/router'

export const screenFrame = component('todo-screen-frame', {
  styles: `
    .frame:focus { outline: none; }
    .announcer { position: absolute; clip-path: inset(50%); white-space: nowrap; }
  `,
  setup: (self, slot) => {
    const frame = div({ class: 'frame', tabindex: '-1' }, slot)
    const announcer = div({ class: 'announcer', role: 'status' })
    let lastPath = useRoute().get().path
    useRoute().watch(self, ({ path }) => {
      if (path === lastPath) return
      lastPath = path
      frame.focus({ preventScroll: true })
      queueMicrotask(() => announcer.textContent = document.title)
    })
    return div(frame, announcer)
  },
})
