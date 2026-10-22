export const mocks = [
  {
    route: 'GET /api/orders/:orderId/lines/:line',
    handler: (request) => ({
      body: {
        params: request.params,
        idLength: crypto.randomUUID().length,
        bytes: crypto.getRandomValues(new Uint8Array(4)).length,
      },
    }),
  },
]
