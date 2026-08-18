import type { BackupEnvelope } from '../domain/types'

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function shareJson(filename: string, value: unknown): Promise<'shared' | 'downloaded'> {
  const text = JSON.stringify(value, null, 2)
  const file = typeof File !== 'undefined' ? new File([text], filename, { type: 'application/json' }) : undefined
  if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title: 'LoopLog backup', files: [file] })
    return 'shared'
  }
  downloadJson(filename, value)
  return 'downloaded'
}

export async function readBackupFile(file: File): Promise<BackupEnvelope> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read backup file.'))
    reader.readAsText(file)
  })
  return JSON.parse(text) as BackupEnvelope
}
