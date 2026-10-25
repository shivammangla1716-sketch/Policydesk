export function changeAdminStep(current, action) {
  if (action === 'back') return 'login'
  if (current === 'login' && action === 'create-account') return 'payment'
  if (current === 'payment' && action === 'payment-success') return 'signup'
  return current
}
