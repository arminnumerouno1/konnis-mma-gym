/** Allowed portrait data-URL prefixes. SVG and other types are rejected. */
export const PHOTO_MIME_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i
export const PHOTO_MAX = 140_000

export function readPhotoData(value, { max = PHOTO_MAX, min = 0 } = {}) {
  if (value == null || value === '') return { ok: true, photoData: null }
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    return { ok: false, error: 'photo' }
  }
  if (!PHOTO_MIME_RE.test(value)) return { ok: false, error: 'photo' }
  return { ok: true, photoData: value }
}
