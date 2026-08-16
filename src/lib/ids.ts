export function nowIso(): string {
  return new Date().toISOString()
}

export function newId(): string {
  if (typeof crypto === 'undefined') throw new Error('Secure randomness is unavailable; cannot create a persisted identifier.')
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto.getRandomValues !== 'function') throw new Error('Secure randomness is unavailable; cannot create a persisted identifier.')
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
