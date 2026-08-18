/* eslint-disable react-refresh/only-export-components -- provider hooks intentionally share their owning contexts */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { AppMeta } from '../../domain/types'
import type { StorageAdapter } from '../../storage/adapter'
import { IndexedDbStorageAdapter } from '../../storage/indexeddb-adapter'
import { CURRENT_DATABASE_VERSION, isOnline, isStandalone } from '../../lib/browser'
import { activateWaitingServiceWorker } from '../../lib/pwa'
import { applyAppearance, readAppearancePreference } from '../../lib/theme'

interface RuntimeContextValue {
  storage: StorageAdapter
  online: boolean
  updateReady: boolean
  activateUpdate: () => void
  dismissUpdate: () => void
}

const StorageContext = createContext<StorageAdapter | undefined>(undefined)
const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined)

function appMeta(now = new Date().toISOString()): AppMeta {
  return {
    id: 'app',
    databaseVersion: CURRENT_DATABASE_VERSION,
    dismissedNotices: [],
    installState: isStandalone() ? 'installed' : 'browser',
    createdAt: now,
    updatedAt: now,
  }
}

export function AppProvider({ children, adapter }: PropsWithChildren<{ adapter?: StorageAdapter }>) {
  const storage = useMemo(() => adapter ?? new IndexedDbStorageAdapter(), [adapter])
  const [online, setOnline] = useState(isOnline)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const preference = readAppearancePreference()
    applyAppearance(preference)
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined
    const onSystemChange = (event: MediaQueryListEvent) => { if (readAppearancePreference() === 'system') applyAppearance('system', event.matches) }
    const onStorageChange = (event: StorageEvent) => { if (event.key === null || event.key === 'looplog-appearance') applyAppearance(readAppearancePreference(), media?.matches) }
    if (media?.addEventListener) media.addEventListener('change', onSystemChange)
    else media?.addListener?.(onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', onSystemChange)
      else media?.removeListener?.(onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    const saveUpdateMeta = (ready: boolean) => {
      void Promise.resolve(storage.getAppMeta()).then((meta) => {
        if (meta) return storage.saveAppMeta({ ...meta, updateReady: ready, updatedAt: new Date().toISOString() })
        return undefined
      }).catch(() => undefined)
    }
    const onUpdateReady = () => { setUpdateReady(true); saveUpdateMeta(true) }
    const onUpdateActivated = () => { setUpdateReady(false); saveUpdateMeta(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('training-tracker:update-ready', onUpdateReady)
    window.addEventListener('training-tracker:update-activated', onUpdateActivated)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('training-tracker:update-ready', onUpdateReady)
      window.removeEventListener('training-tracker:update-activated', onUpdateActivated)
    }
  }, [storage])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve(storage.getAppMeta()).then(async (existing) => {
      if (cancelled) return
      if (!existing) {
        try { await storage.saveAppMeta(appMeta()) } catch { /* local storage may be unavailable; the app remains usable */ }
      } else {
        if (existing.updateReady) setUpdateReady(true)
        if (existing.installState !== (isStandalone() ? 'installed' : 'browser')) {
          try { await storage.saveAppMeta({ ...existing, installState: isStandalone() ? 'installed' : 'browser', updatedAt: new Date().toISOString() }) } catch { /* best effort metadata */ }
        }
      }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [storage])

  const persistUpdateReady = useCallback((ready: boolean) => {
    void Promise.resolve(storage.getAppMeta()).then((meta) => meta ? storage.saveAppMeta({ ...meta, updateReady: ready, updatedAt: new Date().toISOString() }) : undefined).catch(() => undefined)
  }, [storage])
  const activateUpdate = useCallback(() => {
    setUpdateReady(false)
    persistUpdateReady(false)
    activateWaitingServiceWorker()
  }, [persistUpdateReady])
  const dismissUpdate = useCallback(() => { setUpdateReady(false); persistUpdateReady(false) }, [persistUpdateReady])
  const runtime = useMemo(() => ({ storage, online, updateReady, activateUpdate, dismissUpdate }), [storage, online, updateReady, activateUpdate, dismissUpdate])

  return <StorageContext.Provider value={storage}><RuntimeContext.Provider value={runtime}><div data-online={online ? 'true' : 'false'}>{children}</div></RuntimeContext.Provider></StorageContext.Provider>
}

export function useStorage(): StorageAdapter {
  const value = useContext(StorageContext)
  if (!value) throw new Error('StorageProvider is missing')
  return value
}

export function useOnline(): boolean {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error('AppProvider is missing')
  return value.online
}

export function useUpdate(): Pick<RuntimeContextValue, 'updateReady' | 'activateUpdate' | 'dismissUpdate'> {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error('AppProvider is missing')
  return value
}
