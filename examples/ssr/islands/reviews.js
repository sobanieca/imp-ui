import {
  button,
  div,
  form,
  h2,
  input,
  label,
  li,
  mount,
  option,
  p,
  select,
  span,
  textarea,
  ul,
} from '../../../lib/src/imp.js'

const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)

export function mountReviews() {
  const host = document.querySelector('#reviews')
  if (!host) return

  const seed = document.querySelector('#reviews-data')
  let reviews = seed ? JSON.parse(seed.textContent) : []
  let draft = { author: '', rating: 5, body: '' }
  let pending = false

  const render = () => mount(host, view)

  async function submit() {
    if (!draft.author.trim() || !draft.body.trim()) return
    pending = true
    render()
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const review = await response.json()
    reviews = [review, ...reviews]
    draft = { author: '', rating: 5, body: '' }
    pending = false
    render()
  }

  function reviewForm() {
    const authorInput = input({
      class: 'field-input',
      placeholder: 'Your name',
      value: draft.author,
      maxlength: 40,
    })
    const ratingSelect = select(
      { class: 'field-input' },
      [5, 4, 3, 2, 1].map((n) =>
        option({ value: String(n), selected: n === draft.rating }, `${n} ${stars(n)}`)
      ),
    )
    const bodyInput = textarea(
      { class: 'field-input', rows: 3, placeholder: 'Share your thoughts', maxlength: 280 },
      draft.body,
    )

    return form(
      {
        class: 'review-form',
        events: {
          submit: (e) => {
            e.preventDefault()
            draft = {
              author: authorInput.value,
              rating: Number(ratingSelect.value),
              body: bodyInput.value,
            }
            submit()
          },
        },
      },
      div(
        { class: 'field-grid' },
        label({ class: 'field' }, span('Name'), authorInput),
        label({ class: 'field' }, span('Rating'), ratingSelect),
      ),
      label({ class: 'field' }, span('Review'), bodyInput),
      button(
        { type: 'submit', class: 'btn-buy', disabled: pending },
        pending ? 'Posting…' : 'Post review',
      ),
    )
  }

  function reviewItem(review) {
    return li(
      { class: 'review-item' },
      div(
        { class: 'review-meta' },
        span({ class: 'review-author' }, review.author),
        span(
          { class: 'review-stars', 'aria-label': `${review.rating} out of 5` },
          stars(review.rating),
        ),
        span({ class: 'review-date' }, review.date),
      ),
      p({ class: 'review-body' }, review.body),
    )
  }

  function view() {
    const average = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0
    return div(
      div(
        { class: 'reviews-head' },
        h2(`Reviews (${reviews.length})`),
        span({ class: 'reviews-avg' }, `${average.toFixed(1)} ${stars(Math.round(average))}`),
      ),
      reviewForm(),
      ul({ class: 'review-list' }, reviews.map(reviewItem)),
    )
  }

  render()
}
