/** Storage schema currently consumed by the app metadata record. Keep this
 * adapter-facing constant in UI code so screens do not import Dexie. */
export const CURRENT_DATABASE_VERSION = 3

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayMode = window.matchMedia?.('(display-mode: standalone)')
  return displayMode?.matches === true || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function isValidIanaTimezone(value: string): boolean {
  if (!value.trim()) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (typeof navigator === 'undefined') return undefined
  if (!navigator.storage?.persist) return undefined
  return navigator.storage.persist()
}

export async function getStorageEstimate(): Promise<{ usageBytes?: number; quotaBytes?: number }> {
  if (typeof navigator === 'undefined') return {}
  if (!navigator.storage?.estimate) return {}
  const estimate = await navigator.storage.estimate()
  return { usageBytes: estimate.usage, quotaBytes: estimate.quota }
}
