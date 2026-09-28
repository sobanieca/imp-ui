export const mocks = [
  {
    match: (request) => request.method === 'POST' && request.path === '/api/analytics',
    handler: () => ({ status: 204 }),
  },
]
