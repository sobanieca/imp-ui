const onlyOwn = (listener) =>
  function (event) {
    if (event.target === event.currentTarget) listener.call(this, event)
  }

export const ownEvents = (events, names) => {
  if (!events || typeof events !== 'object') return events
  const filtered = { ...events }
  for (const name of names) {
    const entry = filtered[name]
    const [listener, options] = Array.isArray(entry) ? entry : [entry, null]
    if (typeof listener !== 'function') continue
    filtered[name] = options ? [onlyOwn(listener), options] : onlyOwn(listener)
  }
  return filtered
}
