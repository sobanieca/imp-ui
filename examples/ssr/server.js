import { Hono } from 'jsr:@hono/hono@4.12.27'
import { serveStatic } from 'jsr:@hono/hono@4.12.27/deno'
import { addReview, addToCart, getCart, listReviews, product } from './data.js'
import { productPage } from './page.js'

const repoRoot = new URL('../../', import.meta.url)
Deno.chdir(repoRoot)

const app = new Hono()

app.get('/', (c) => c.html(productPage(product, listReviews(), getCart())))

app.get('/api/reviews', (c) => c.json(listReviews()))

app.post('/api/reviews', async (c) => {
  const body = await c.req.json()
  return c.json(addReview(body), 201)
})

app.post('/api/cart', async (c) => {
  const { quantity } = await c.req.json()
  return c.json(addToCart(quantity))
})

app.use('/*', serveStatic({ root: '.' }))

const port = 8000
console.log(`imp shop running at http://localhost:${port}`)
Deno.serve({ port }, app.fetch)
