export type AppearancePreference = 'system' | 'light' | 'dark'

export const APPEARANCE_STORAGE_KEY = 'looplog-appearance'
export const APPEARANCE_CHANGE_EVENT = 'looplog:appearance-change'

export function readAppearancePreference(): AppearancePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolvedAppearance(preference: AppearancePreference, prefersDark = systemPrefersDark()): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

export function applyAppearance(preference: AppearancePreference, prefersDark = systemPrefersDark()): void {
  if (typeof document === 'undefined') return
  const resolved = resolvedAppearance(preference, prefersDark)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0d1411' : '#f3f5f1')
  document.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE_EVENT, { detail: { preference, resolved } }))
}

export function saveAppearancePreference(preference: AppearancePreference): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference) } catch { /* Private browsing may deny local storage. */ }
  applyAppearance(preference)
}
