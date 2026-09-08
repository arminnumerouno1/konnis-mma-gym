import { LEIPZIG_SKYLINE, drawBuildingSilhouette } from './skyline'

const SILVER = '#e6e1d6'
const STEEL = '#c8c2b6'
const INK = '#0b0b0b'
const RED = '#6a1b1b'

function octagonPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI / 8 + i * (Math.PI / 4)
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number,
): void {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(0, chars.length - 1)
  let x = cx - total / 2
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], x, y)
    x += widths[i] + tracking
  }
}

/** Brand emblem — treated as the original logo, only staged in 3D. */
export function drawLogo(size = 2048): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.47

  ctx.clearRect(0, 0, size, size)

  octagonPath(ctx, cx, cy, r)
  ctx.fillStyle = INK
  ctx.fill()

  octagonPath(ctx, cx, cy, r * 0.985)
  ctx.strokeStyle = SILVER
  ctx.lineWidth = size * 0.014
  ctx.stroke()

  octagonPath(ctx, cx, cy, r * 0.935)
  ctx.lineWidth = size * 0.0032
  ctx.strokeStyle = STEEL
  ctx.stroke()

  ctx.save()
  octagonPath(ctx, cx, cy, r * 0.92)
  ctx.clip()

  ctx.strokeStyle = RED
  ctx.globalAlpha = 0.55
  ctx.lineWidth = size * 0.002
  octagonPath(ctx, cx, cy, r * 0.905)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.fillStyle = SILVER
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `400 ${Math.round(size * 0.122)}px "Bebas Neue"`
  fillTracked(ctx, "KONNI'S", cx, size * 0.3, size * 0.01)

  ctx.strokeStyle = STEEL
  ctx.lineWidth = size * 0.002
  ctx.beginPath()
  ctx.moveTo(size * 0.24, size * 0.368)
  ctx.lineTo(size * 0.76, size * 0.368)
  ctx.stroke()

  const skyX = size * 0.22
  const skyW = size * 0.56
  const skyBase = size * 0.62
  const skyH = size * 0.2
  ctx.fillStyle = SILVER
  for (const building of LEIPZIG_SKYLINE) {
    drawBuildingSilhouette(
      ctx,
      skyX + building.x * skyW,
      skyBase,
      building.w * skyW,
      building.h * skyH,
      building.kind,
    )
  }

  ctx.beginPath()
  ctx.moveTo(size * 0.24, size * 0.648)
  ctx.lineTo(size * 0.76, size * 0.648)
  ctx.stroke()

  ctx.fillStyle = SILVER
  ctx.font = `400 ${Math.round(size * 0.078)}px "Bebas Neue"`
  fillTracked(ctx, 'MMA GYM', cx, size * 0.71, size * 0.014)

  ctx.fillStyle = '#b8b3a8'
  ctx.font = `400 ${Math.round(size * 0.038)}px "Bebas Neue"`
  fillTracked(ctx, 'LEIPZIG', cx, size * 0.775, size * 0.018)

  ctx.restore()

  return canvas
}

export function drawLogoRoughness(size = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#6a6a6a'
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  octagonPath(ctx, cx, cy, size * 0.47)
  ctx.fillStyle = '#4a4a4a'
  ctx.fill()

  ctx.strokeStyle = '#d0d0d0'
  ctx.lineWidth = size * 0.014
  octagonPath(ctx, cx, cy, size * 0.47)
  ctx.stroke()

  ctx.fillStyle = '#e8e8e8'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `400 ${Math.round(size * 0.122)}px "Bebas Neue"`
  fillTracked(ctx, "KONNI'S", cx, size * 0.3, size * 0.01)
  ctx.font = `400 ${Math.round(size * 0.078)}px "Bebas Neue"`
  fillTracked(ctx, 'MMA GYM', cx, size * 0.71, size * 0.014)

  return canvas
}
