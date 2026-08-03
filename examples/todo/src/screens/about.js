import { component } from 'imp'
import { heading, link, text } from 'imp/std'
import { container, divider, grid, stack } from 'imp/std/layout'
import { words } from '../panels.js'

const FEATURES = ['state', 'router', 'http', 'forms', 'i18n', 'theming']

const featureCard = (name) =>
  stack(
    { gap: 1 },
    text({ weight: 'medium' }, name),
    text({ tone: 'secondary', size: 'sm' }, words(`about.features.${name}`)),
  )

export const aboutScreen = component('todo-app-about', {
  onMount: () =>
    container(
      { size: 'md', padding: 4 },
      stack(
        { gap: 5 },
        heading({ level: 2 }, words('about.title')),
        text({ tone: 'secondary' }, words('about.intro')),
        divider(),
        grid({ minItemWidth: '14rem', gap: 4 }, ...FEATURES.map(featureCard)),
        divider(),
        link(
          { href: 'https://github.com/sobanieca/imp-ui', external: true },
          words('about.docs'),
        ),
      ),
    ),
})
