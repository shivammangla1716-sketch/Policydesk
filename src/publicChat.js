export function screenForPath(pathname) {
  return pathname === '/admin' || pathname === '/admin/' ? 'admin' : 'public'
}

export function toApiHistory(messages) {
  return messages
    .filter(message => ['user', 'assistant'].includes(message.role) && typeof message.text === 'string' && message.text.trim())
    .slice(-8)
    .map(({ role, text }) => ({ role, text }))
}
