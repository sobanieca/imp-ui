export const mocks = [
  {
    match: (request) => request.method === 'GET' && request.path === '/api/users',
    handler: () => ({ status: 200, body: [{ id: 'u1', name: 'Ada' }] }),
  },
]
