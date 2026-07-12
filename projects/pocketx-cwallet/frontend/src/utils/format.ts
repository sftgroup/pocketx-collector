/**
 * Formatting utilities for addresses, amounts, dates.
 */

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ''
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0'
  if (num === 0) return '0'
  if (num < 0.000001) return '<0.000001'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(decimals, 8),
  })
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateFull(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function toBigInt(amount: string, decimals: number): string {
  try {
    const parts = amount.split('.')
    const intPart = parts[0] || '0'
    const fracPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
    return intPart + fracPart
  } catch {
    return '0'
  }
}

export function fromBigInt(amount: string, decimals: number): string {
  try {
    const padded = amount.padStart(decimals + 1, '0')
    const intPart = padded.slice(0, padded.length - decimals) || '0'
    const fracPart = padded.slice(padded.length - decimals)
    return `${intPart}.${fracPart}`
  } catch {
    return '0'
  }
}
