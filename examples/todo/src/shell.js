import { component, flag } from 'imp'
import { div } from 'imp/html'
import { computed, initState } from 'imp/state'
import { lang, setLang, t } from 'imp/i18n'
import { applyTheme, theme } from 'imp/theme'
import { useRoute } from 'imp/router'
import { createLogger } from 'imp/log'
import { heading, link, text } from 'imp/std'
import { app, footer, navbar, sidebar, stack } from 'imp/std/layout'
import { navMenu } from 'imp/std/navigation'
import { select, toggle } from 'imp/std/inputs'
import midnight from './theme/midnight.js'

const log = createLogger('todo.shell')

const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' }]

const navEntries = () => {
  const entries = [['/', 'app.nav.list'], ['/todos/new', 'app.nav.add']]
  if (flag('TODO_STATS')) entries.push(['/stats', 'app.nav.stats'])
  entries.push(['/about', 'app.nav.about'])
  return entries
}

const sections = (current) =>
  navMenu({
    label: t('app.title'),
    selected: current,
    items: navEntries().map(([href, key]) => ({ id: href, href, label: t(key) })),
  })

export const appShell = component('todo-app-shell', {
  onMount: (_instance, slot) => {
    const route = useRoute()
    const dark = initState('todo.dark', theme.get()?.name === midnight.name)
    const language = initState('todo.language', lang.get())
    const languageLabel = computed([lang], () => t('app.language'))
    const themeLabel = computed([lang], () => t('app.darkTheme'))

    dark.watch((on) => {
      applyTheme(on ? midnight : 'imp-light')
      localStorage.setItem('todo.theme', on ? midnight.name : 'imp-light')
    })

    language.watch((code) => {
      if (code === lang.get()) return
      localStorage.setItem('todo.lang', code)
      setLang(code).catch((error) => log.error(`could not switch to '${code}'`, error))
    })

    const content = div({ id: 'main', tabindex: -1 }, slot)
    let shownPath = route.get().path

    route.watch(({ path }) => {
      if (path === shownPath) return
      shownPath = path
      content.focus()
    })

    return app(
      { maxWidth: 'md', padding: 4 },
      navbar(
        { label: lang.text(() => t('app.title')), justify: 'between', wrap: true },
        stack(
          { gap: 1 },
          heading({ level: 1 }, lang.text(() => t('app.title'))),
          stack(
            { direction: 'row', hideOnMobile: true },
            text({ tone: 'secondary', size: 'sm' }, lang.text(() => t('app.tagline'))),
          ),
        ),
        stack(
          { direction: 'row', gap: 4, align: 'end' },
          select({ value: language, label: languageLabel, options: LANGUAGES }),
          toggle({ value: dark, label: themeLabel }),
        ),
      ),
      sidebar(
        { side: 'left', label: lang.text(() => t('app.title')), width: 'sm' },
        lang.view(() => route.view((current) => sections(current.path))),
      ),
      footer(
        { label: 'imp' },
        text(
          { tone: 'secondary', size: 'sm' },
          link(
            { href: 'https://github.com/sobanieca/imp-ui', external: true, size: 'sm' },
            'imp',
          ),
        ),
      ),
      content,
    )
  },
})
