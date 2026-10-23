import { formatUnits, getAddress, isAddress, parseUnits } from 'ethers'

export function shortenAddress(value, start = 6, end = 4) {
  if (!value) return '—'
  return value.length > start + end + 1 ? value.slice(0, start) + '…' + value.slice(-end) : value
}
export const shortenOrderId = value => shortenAddress(value, 10, 6)
export const sameAddress = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())
export const isOrderId = value => /^0x[0-9a-fA-F]{64}$/.test(value || '')
export function validAddress(value) {
  return isAddress(value || '') ? getAddress(value) : null
}
export function parseAmount(value, decimals, { positive = false } = {}) {
  if (!/^\d+(\.\d+)?$/.test(String(value))) throw Object.assign(new Error('Invalid amount'), { code: 'INVALID_AMOUNT' })
  let amount
  try { amount = parseUnits(String(value), decimals) } catch { throw Object.assign(new Error('Invalid precision'), { code: 'INVALID_AMOUNT' }) }
  if (amount < 0n || (positive && amount === 0n) || amount > (1n << 256n) - 1n) throw Object.assign(new Error('Invalid amount'), { code: 'INVALID_AMOUNT' })
  return amount
}
export function formatAmount(value, decimals = 18, precision = decimals) {
  if (value === null || value === undefined) return '—'
  const [whole, fraction = ''] = formatUnits(BigInt(value), decimals).split('.')
  const trimmed = fraction.slice(0, precision).replace(/0+$/, '')
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (BigInt(value) > 0n && whole === '0' && !trimmed) return '< ' + '0.' + '0'.repeat(precision - 1) + '1'
  return formatted + (trimmed ? '.' + trimmed : '')
}
