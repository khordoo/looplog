import { validateCustomPhotoDataUrl } from '../../domain/custom-exercises'

/** Resize and center-crop a local image. No network or upload is involved. */
export async function processCustomPhoto(file: File): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Photo processing is only available in a browser.')
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); const url = URL.createObjectURL(file); element.onload = () => { URL.revokeObjectURL(url); resolve(element) }; element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')) }; element.src = url })
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640
  const context = canvas.getContext('2d'); if (!context) throw new Error('Photo processing is unavailable in this browser.')
  const scale = Math.max(640 / image.width, 640 / image.height); const width = image.width * scale; const height = image.height * scale
  context.fillStyle = '#faf4e8'; context.fillRect(0, 0, 640, 640); context.drawImage(image, (640 - width) / 2, (640 - height) / 2, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The image could not be compressed as WebP.')), 'image/webp', .82))
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(blob) })
  if (!validateCustomPhotoDataUrl(dataUrl)) throw new Error('Choose a smaller image; compressed photos must be WebP under 1.5 MB.')
  return dataUrl
}
