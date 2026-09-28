const tokenFor = (user) => btoa(encodeURIComponent(JSON.stringify(user)))

export const userFromToken = (authorization) => {
  const token = authorization?.replace(/^Bearer /, '')
  if (!token) return null
  try {
    return JSON.parse(decodeURIComponent(atob(token)))
  } catch {
    return null
  }
}

export const mocks = [
  {
    match: (request) => request.method === 'POST' && request.path === '/api/session',
    delay: 400,
    handler: ({ body }) => {
      if (body.email.startsWith('locked@')) {
        return { status: 403, body: { message: 'Account locked' } }
      }
      const user = { name: body.name, email: body.email }
      return { status: 201, body: { ...user, token: tokenFor(user) } }
    },
  },
  {
    match: (request) => request.method === 'GET' && request.path === '/api/session',
    handler: ({ headers }) => {
      const user = userFromToken(headers.authorization)
      if (!user) return { status: 401, body: { message: 'Not signed in' } }
      return { body: { ...user, token: tokenFor(user) } }
    },
  },
  {
    match: (request) => request.method === 'POST' && request.path === '/api/bug-reports',
    handler: () => ({ status: 202, body: { received: true } }),
  },
]
