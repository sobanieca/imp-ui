import { component } from 'imp'
import { heading, link, text } from 'imp/std'
import { flex, grid } from 'imp/std/layout'
import { words } from '../panels.js'

const FEATURES = ['state', 'router', 'http', 'forms', 'i18n', 'theming']

const featureCard = (name) =>
  flex(
    { direction: 'column', gap: 1 },
    text({ weight: 'medium' }, name),
    text({ tone: 'secondary', size: 'sm' }, words(`about.features.${name}`)),
  )

export const aboutScreen = component('todo-app-about', {
  onMount: () =>
    flex(
      { direction: 'column', gap: 5 },
      heading({ level: 2 }, words('about.title')),
      text({ tone: 'secondary' }, words('about.intro')),
      grid({ minItemWidth: '14rem', gap: 4 }, ...FEATURES.map(featureCard)),
      link(
        { href: 'https://github.com/sobanieca/imp-ui', external: true },
        words('about.docs'),
      ),
    ),
})
