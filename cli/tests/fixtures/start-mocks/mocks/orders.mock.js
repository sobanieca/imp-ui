import { fake } from 'imp/fake'

export const mocks = [
  {
    route: 'GET /api/orders/:orderId/lines/:line',
    handler: (request) => ({
      body: {
        params: request.params,
        guid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          fake.guid(),
        ),
        hash: fake.hash(40).length,
        email: /^ada\.lovelace\d+@example\.(com|org|net)$/.test(fake.email('Ada Lovelace')),
        address: Object.keys(fake.address()),
        phone: /^\+1 \d{3} 555 01\d{2}$/.test(fake.phone()),
        name: /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(fake.name()),
      },
    }),
  },
]
