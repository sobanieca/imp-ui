export const fetchTodos = async () => {
  const response = await fetch('/api/todos')
  return response.json()
}
