import { HttpError } from 'imp/http'

export const clientOptions = ({ baseUrl, token }) => ({
  baseUrl,
  headers: { accept: 'application/json' },
  retry: { attempts: 3, retryOn: [502, 503, 504], delay: 200 },
  timeout: 8_000,
  onRequest: (request) => {
    const current = token()
    if (current) request.headers.authorization = `Bearer ${current}`
    return request
  },
})

export const loadSession = async (api) => {
  try {
    return await api.get('/session')
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      api.clearError()
      return null
    }
    throw error
  }
}

export const signIn = (api, credentials) => api.post('/session', { body: credentials })

export const loadTodos = (api) => api.get('/todos')

export const loadTodo = (api, id) => api.get(`/todos/${id}`)

export const createTodo = (api, draft) => api.post('/todos', { body: draft, track: 'todo.create' })

export const updateTodo = (api, id, changes) =>
  api.patch(`/todos/${id}`, { body: changes, track: 'todo.save' })

export const deleteTodo = (api, id) => api.delete(`/todos/${id}`)

export const clearCompleted = (api) => api.post('/todos/clear-completed')

export const sendBugReport = (api, report) => api.post('/bug-reports', { body: report })
