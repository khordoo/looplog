let waitingWorker: ServiceWorker | undefined
let serviceWorkerRegistration: ServiceWorkerRegistration | undefined
let reloadAfterControllerChange = false

function announce(name: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(name))
}

function trackWaiting(registration: ServiceWorkerRegistration): void {
  serviceWorkerRegistration = registration
  if (registration.waiting) {
    waitingWorker = registration.waiting
    announce('training-tracker:update-ready')
  }
}

export function activateWaitingServiceWorker(): void {
  const worker = waitingWorker ?? serviceWorkerRegistration?.waiting
  if (!worker) {
    if (typeof window !== 'undefined') window.location.reload()
    return
  }
  reloadAfterControllerChange = true
  worker.postMessage({ type: 'SKIP_WAITING' })
  // A test seam and older service workers may not emit controllerchange. The
  // normal path reloads only after the new worker controls the page.
  window.setTimeout(() => {
    if (reloadAfterControllerChange) {
      reloadAfterControllerChange = false
      window.location.reload()
    }
  }, 3000)
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadAfterControllerChange) return
    reloadAfterControllerChange = false
    announce('training-tracker:update-activated')
    window.location.reload()
  })
  void navigator.serviceWorker.register('/sw.js').then((registration) => {
    trackWaiting(registration)
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting ?? worker
          announce('training-tracker:update-ready')
        }
      })
    })
  }).catch(() => undefined)
}
