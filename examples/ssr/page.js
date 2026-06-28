const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const embedJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c')

const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)

function serverReview(review) {
  return `
    <li class="review-item">
      <div class="review-meta">
        <span class="review-author">${escapeHtml(review.author)}</span>
        <span class="review-stars" aria-label="${review.rating} out of 5">${
    stars(review.rating)
  }</span>
        <span class="review-date">${escapeHtml(review.date)}</span>
      </div>
      <p class="review-body">${escapeHtml(review.body)}</p>
    </li>`
}

export function productPage(product, reviews, cart) {
  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(product.name)} — imp shop</title>
    <meta name="description" content="${escapeHtml(product.tagline)}" />
    <link rel="stylesheet" href="/examples/ssr/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/"><span class="brand-mark">◆</span> imp shop</a>
      <div id="cart-widget" data-count="${cart.count}" data-total="${cart.total}">
        <span class="cart-fallback">Cart · ${cart.count} items · $${cart.total}</span>
      </div>
    </header>

    <main class="product">
      <div class="gallery" aria-hidden="true">${product.image}</div>

      <div class="summary">
        <h1>${escapeHtml(product.name)}</h1>
        <p class="tagline">${escapeHtml(product.tagline)}</p>
        <div class="rating">
          <span class="rating-stars">${stars(Math.round(product.rating))}</span>
          <span class="rating-value">${product.rating.toFixed(1)}</span>
        </div>
        <p class="price">$${product.price}</p>
        <p class="description">${escapeHtml(product.description)}</p>

        <div id="add-to-cart" data-price="${product.price}">
          <noscript>Enable JavaScript to add this item to your cart.</noscript>
        </div>

        <dl class="specs">
          ${
    product.specs
      .map((s) => `<dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}</dd>`)
      .join('\n          ')
  }
        </dl>
      </div>
    </main>

    <section id="reviews" class="reviews">
      <div class="reviews-head">
        <h2>Reviews (${reviews.length})</h2>
        <span class="reviews-avg">${average.toFixed(1)} ${stars(Math.round(average))}</span>
      </div>
      <ul class="review-list">${reviews.map(serverReview).join('')}
      </ul>
    </section>

    <script id="reviews-data" type="application/json">${embedJson(reviews)}</script>
    <script type="module" src="/examples/ssr/islands/main.js"></script>
  </body>
</html>`
}
