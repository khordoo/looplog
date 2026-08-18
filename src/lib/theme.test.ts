import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAppearancePreference, resolvedAppearance, saveAppearancePreference } from './theme'

afterEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
  vi.restoreAllMocks()
})

describe('appearance preferences', () => {
  it('defaults to system and resolves against the operating system', () => {
    expect(readAppearancePreference()).toBe('system')
    expect(resolvedAppearance('system', false)).toBe('light')
    expect(resolvedAppearance('system', true)).toBe('dark')
    expect(resolvedAppearance('light', true)).toBe('light')
  })

  it('persists explicit choices and updates browser chrome tokens', () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    saveAppearancePreference('dark')
    expect(readAppearancePreference()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(meta.content).toBe('#0d1411')
    saveAppearancePreference('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(meta.content).toBe('#f3f5f1')
  })

  it('ignores malformed persisted values', () => {
    window.localStorage.setItem('looplog-appearance', 'sepia')
    expect(readAppearancePreference()).toBe('system')
  })
})
