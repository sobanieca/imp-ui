import { component } from 'imp'
import { div } from 'imp/html'
import { useRoute } from 'imp/router'
import { loader } from 'imp/std/feedback'

export const screenFrame = component('todo-screen-frame', {
  styles: `
    .frame { flex: 1; }
    .frame:focus { outline: none; }
  `,
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

export const screenLoader = component('todo-screen-loader', {
  styles: `
    .wait {
      display: grid;
      place-items: center;
      block-size: 100%;
      min-block-size: 12rem;
    }
  `,
  setup: (_self, { label }) => div({ class: 'wait' }, loader({ label, size: 'lg' })),
})
