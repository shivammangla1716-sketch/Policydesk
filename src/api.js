export async function api(path, options = {}) {
  const multipart = options.body instanceof FormData
  let response
  try {
    response = await fetch(`/api${path}`, {
      ...options, credentials: 'include',
      headers: multipart ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? (multipart ? options.body : JSON.stringify(options.body)) : undefined,
    })
  } catch { throw new Error('We couldn’t connect. Check your connection and try again.') }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.')
    error.status = response.status
    throw error
  }
  return data
}
