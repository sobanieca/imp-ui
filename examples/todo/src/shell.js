import { component, flag } from 'imp'
import { footer, header, main, nav } from 'imp/html'
import { computed, initState } from 'imp/state'
import { lang, setLang, t } from 'imp/i18n'
import { applyTheme, theme } from 'imp/theme'
import { useRoute } from 'imp/router'
import { createLogger } from 'imp/log'
import { heading, link, text } from 'imp/std'
import { container, divider, item, row, stack } from 'imp/std/layout'
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

const navBar = (current) =>
  nav(
    { 'aria-label': t('app.title') },
    row(
      { gap: 4, align: 'center', wrap: true },
      ...navEntries().map(([href, key]) =>
        link({
          href,
          weight: current === href ? 'bold' : 'normal',
          tone: current === href ? 'default' : 'secondary',
        }, t(key))
      ),
    ),
  )

export const appShell = component('todo-app-shell', {
  styles: `
    :host {
      display: block;
      min-block-size: 100vh;
      background: var(--imp-color-surface, #ffffff);
      color: var(--imp-color-text, #0f172a);
      font-family: var(--imp-font-family, system-ui);
    }

    main {
      display: block;
      padding-block: var(--imp-space-4, 16px);
    }

    main:focus {
      outline: none;
    }
  `,
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

    const content = main({ id: 'main', tabindex: -1 }, slot)
    let shownPath = route.get().path

    route.watch(({ path }) => {
      if (path === shownPath) return
      shownPath = path
      content.focus()
    })

    return [
      header(
        container(
          { size: 'lg', padding: 4 },
          stack(
            { gap: 4 },
            row(
              { justify: 'between', align: 'center', wrap: true, gap: 4 },
              stack(
                { gap: 1 },
                heading({ level: 1 }, lang.text(() => t('app.title'))),
                item(
                  { hideBelow: 'sm' },
                  text({ tone: 'secondary', size: 'sm' }, lang.text(() => t('app.tagline'))),
                ),
              ),
              row(
                { gap: 4, align: 'end' },
                select({ value: language, label: languageLabel, options: LANGUAGES }),
                toggle({ value: dark, label: themeLabel }),
              ),
            ),
            lang.view(() => route.view((current) => navBar(current.path))),
            divider(),
          ),
        ),
      ),
      content,
      footer(
        container(
          { size: 'lg', padding: 4 },
          stack(
            { gap: 2 },
            divider(),
            text(
              { tone: 'secondary', size: 'sm' },
              link(
                { href: 'https://github.com/sobanieca/imp-ui', external: true, size: 'sm' },
                'imp',
              ),
            ),
          ),
        ),
      ),
    ]
  },
})
