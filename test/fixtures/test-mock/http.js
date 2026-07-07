export const get = async (url) => {
  const response = await fetch(url)
  return response.json()
}

export const post = async (url, body) => {
  const response = await fetch(url, { method: 'POST', body: JSON.stringify(body) })
  return response.json()
}
