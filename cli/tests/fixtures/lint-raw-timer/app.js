import { component, delay, interval } from 'imp'
import { button, div } from 'imp/html'

export const flagged = component('demo-flagged', {
  setup: (self) => {
    self.timer = setInterval(() => {}, 1000)
    window.setTimeout(() => {}, 500)
    return button({ events: { click: () => setTimeout(() => {}, 100) } }, 'go')
  },
  onRemove: (self) => clearInterval(self.timer),
})

export const flaggedMethod = component('demo-flagged-method', {
  onMount() {
    globalThis.setInterval(() => {}, 1000)
  },
  setup: () => div('hi'),
})

export const allowed = component('demo-allowed', {
  setup: (self) => {
    interval(self, 15_000, async () => {}, { whenVisible: true })
    delay(self, 3000, () => {})
    return div('hi')
  },
})

export const allowedShadowed = component('demo-allowed-shadowed', {
  setup: () => {
    const setTimeout = (run) => run()
    setTimeout(() => {})
    return div('hi')
  },
})

const outside = () => setTimeout(() => {}, 100)

export const notADefinition = {
  setup: () => setInterval(() => {}, 1000),
}

outside()
