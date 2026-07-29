export const mocks = [
  {
    match: (request) => request.path.startsWith('/api/reports'),
    handler: (request) => ({ status: 200, body: { report: request.query.name ?? 'none' } }),
  },
]
