/** Client-side portrait compress for signup and desk. Matches server PHOTO_MAX ~140k. */

function canvasToJpeg(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, 420 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

function loadViaImageElement(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      try {
        const data = canvasToJpeg(image, image.naturalWidth || image.width, image.naturalHeight || image.height)
        URL.revokeObjectURL(url)
        resolve(data)
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    image.src = url
  })
}

/**
 * Compresses a photo for upload. Uses createImageBitmap with EXIF orientation when available,
 * so phone photos are not sideways / corner-cropped in the preview.
 */
export async function compressPhoto(file: File) {
  if (!file || !file.type.startsWith('image/')) {
    // iPhone gallery sometimes leaves type empty for HEIC/JPEG — still try
    if (!file || file.size < 32) throw new Error('image')
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      try {
        return canvasToJpeg(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    } catch {
      // fall through — older Safari / HEIC quirks
    }
  }

  return loadViaImageElement(file)
}
