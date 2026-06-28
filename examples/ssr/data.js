export const product = {
  id: 'imp-tee',
  name: 'imp-ui Developer Tee',
  tagline: 'Buildless. No virtual DOM. Just DOM.',
  price: 29,
  rating: 4.6,
  image: '👕',
  description: 'A soft cotton tee for people who ship without a bundler. The front reads ' +
    '`div(props, ...children)`; the back is blank, like your build config.',
  specs: [
    { label: 'Material', value: '100% combed cotton' },
    { label: 'Weight', value: '180 gsm' },
    { label: 'Fit', value: 'Regular' },
    { label: 'Ships in', value: '2–4 days' },
  ],
}

const clampRating = (n) => Math.min(5, Math.max(1, Math.round(Number(n) || 0)))

let nextReviewId = 4
let reviews = [
  {
    id: 1,
    author: 'Ada L.',
    rating: 5,
    body: 'Wore it to a code review. Zero dependencies, zero regrets.',
    date: '2026-06-12',
  },
  {
    id: 2,
    author: 'Grace H.',
    rating: 4,
    body: 'Comfortable and honest. Docked a star because I wanted long sleeves.',
    date: '2026-06-18',
  },
  {
    id: 3,
    author: 'Linus P.',
    rating: 5,
    body: 'The fit is regular, the philosophy is minimal. Exactly as described.',
    date: '2026-06-24',
  },
]

export const listReviews = () => reviews

export function addReview({ author, rating, body }) {
  const review = {
    id: nextReviewId++,
    author: String(author || 'Anonymous').slice(0, 40),
    rating: clampRating(rating),
    body: String(body || '').slice(0, 280),
    date: new Date().toISOString().slice(0, 10),
  }
  reviews = [review, ...reviews]
  return review
}

let cart = { count: 0, total: 0 }

export const getCart = () => cart

export function addToCart(quantity) {
  const units = Math.min(99, Math.max(1, Math.round(Number(quantity) || 1)))
  cart = { count: cart.count + units, total: (cart.count + units) * product.price }
  return cart
}
