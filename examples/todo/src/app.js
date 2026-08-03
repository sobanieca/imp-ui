import { component, env, flag } from 'imp'
import { initState } from 'imp/state'
import { initHttpClient } from 'imp/http'
import { area, router } from 'imp/router'
import { createLogger } from 'imp/log'
import { appShell } from './shell.js'
import { loadingPanel, messagePanel } from './panels.js'
import { aboutScreen } from './screens/about.js'
import { newTodoScreen } from './screens/new_todo.js'
import { todoScreen } from './screens/todo.js'
import { todosScreen } from './screens/todos.js'

const log = createLogger('todo.app')

export const app = component('todo-app-root', {
  onMount: () => {
    initHttpClient('todo.api', {
      baseUrl: env.API_URL ?? '/api',
      headers: { accept: 'application/json' },
      timeout: 8000,
      retry: { attempts: 3, retryOn: [502, 503, 504] },
      onRequest: (request) => {
        log.debug(`${request.method} ${request.url}`)
        return request
      },
    })
    initState('todo.items', [])

    const routes = {
      '/': () => todosScreen(),
      '/todos/new': () => newTodoScreen(),
      '/todos/:id': ({ params }) => todoScreen(params.id),
      '/about': () => aboutScreen(),
    }
    if (flag('TODO_STATS')) routes['/stats'] = area(() => import('./stats/area.js'))

    return appShell(
      router({
        routes,
        placeholder: () => loadingPanel(),
        onError: (error) => messagePanel('app.failed', error.message),
        onNotFound: () => messagePanel('app.notFound'),
      }),
    )
  },
})
