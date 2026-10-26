import { component, env } from 'imp'
import { luChartColumn, luInfo, luListTodo } from 'imp/icons'
import { initHttpClient } from 'imp/http'
import { t } from 'imp/i18n'
import { createLogger } from 'imp/log'
import { area, redirect, router, wait } from 'imp/router'
import { initState } from 'imp/state'
import { emptyState } from 'imp/std/display'
import { toast } from 'imp/std/feedback'
import { appLogo, notifications, shell } from 'imp/std/shell'
import { aboutScreen } from './about/about-screen.js'
import { app } from './app-map.js'
import { screenFrame, screenLoader } from './screen-frame.js'
import { THEME_CHOICES } from './theme.js'
import { accountMenu } from './ui/account-menu.js'
import { backdrop } from './ui/backdrop.js'
import { logoMark } from './ui/logo-mark.js'
import { readToken, writeToken } from './session-token.js'
import { signInPage } from './sign-in.js'
import { clientOptions, loadSession, loadTodos } from './todos/todo-api.js'
import { countTodos } from './todos/todo-model.js'
import { todoDetailScreen } from './todos/todo-detail-screen.js'
import { todoListScreen } from './todos/todo-list-screen.js'

const log = createLogger('todo.app')

const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' }]

const signedIn = {
  states: ['todo.session'],
  check: (session, { node, path }) => {
    if (node === app.signIn) return true
    if (session === undefined) return wait
    return Boolean(session) || `${app.signIn.href()}?next=${encodeURIComponent(path)}`
  },
}

const openTag = (todos) => {
  const { open } = countTodos(todos)
  return open > 0 ? { text: String(open), color: 'blue' } : null
}

const appRouter = () =>
  router({
    map: app,
    guards: { [app]: signedIn },
    screens: {
      [app]: redirect(app.todos),
      [app.signIn]: () => signInPage(),
      [app.todos]: () => todoListScreen(),
      [app.todos.$todoId]: ({ params }) => todoDetailScreen({ id: params.todoId }),
      [app.stats]: area(() => import('./stats/area.js')),
      [app.about]: () => aboutScreen(),
    },
    title: ({ crumbs }) => `${crumbs.at(-1)} - ${t('app.name')}`,
    loading: () => screenLoader({ label: t('app.name') }),
    notFound: () => emptyState({ variant: 'noResults' }),
  })

export const root = component('todo-root', {
  setup: (self) => {
    const session = initState(self, 'todo.session')
    const items = initState(self, 'todo.items')
    const openTodos = initState(self, 'todo.openTodos', openTag(items.get()))
    items.watch(self, (todos) => openTodos.set(openTag(todos)))
    const api = initHttpClient(
      self,
      'todo.api',
      clientOptions({ baseUrl: env.API_URL, token: readToken }),
    )

    session.watch(self, (user) => {
      if (!user) return items.set(undefined)
      log.info('signed in as', user.email)
      loadTodos(api).then(items.set, (error) => log.warn('could not load the todos', error.message))
    })
    loadSession(api).then(session.set, (error) => {
      log.warn('could not restore the session', error.message)
      session.set(null)
    })

    const signOut = () => {
      writeToken(null)
      session.set(null)
    }

    return shell(
      {
        logo: appLogo({ label: 'Todo', tagline: 'imp', icon: logoMark() }),
        gap: 3,
        background: backdrop(),
        map: app,
        nav: {
          [app.signIn]: { hidden: true },
          [app.todos]: { icon: luListTodo, tag: 'todo.openTodos' },
          [app.stats]: { icon: luChartColumn },
          [app.about]: { icon: luInfo },
        },
        extras: [
          notifications(),
          accountMenu({ languages: LANGUAGES, themes: THEME_CHOICES, onSignOut: signOut }),
        ],
        signIn: app.signIn,
      },
      toast(),
      screenFrame(appRouter()),
    )
  },
})
