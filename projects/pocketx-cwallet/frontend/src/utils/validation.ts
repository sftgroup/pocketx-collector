/**
 * Validation utilities.
 */

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// FIXME: Backward-compat alias — remove after all callers migrated
export const isValidPhone = isValidEmail

export function isValidAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') return false
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0
}

export function isValidAddress(address: string, chain: string): boolean {
  if (!address) return false
  if (chain === 'solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }
  if (chain === 'bnb') {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
  return address.length > 0
}

export function isValidPayPassword(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}

export function isValidVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
