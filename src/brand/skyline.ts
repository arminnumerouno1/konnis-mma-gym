export type SkylineKind = 'block' | 'spire' | 'church' | 'rathaus' | 'highrise' | 'monument' | 'dome'

export type SkylineBuilding = {
  id: string
  /** 0–1 along the skyline width */
  x: number
  w: number
  h: number
  kind: SkylineKind
}

/**
 * Stylized Leipzig silhouette for the 3D city scene.
 * Oriented toward the skyline in the original KONNI'S emblem:
 * monument, church towers, Neues Rathaus, City-Hochhaus.
 */
export const LEIPZIG_SKYLINE: SkylineBuilding[] = [
  { id: 'blocks-west', x: 0.0, w: 0.055, h: 0.28, kind: 'block' },
  { id: 'volkerschlacht', x: 0.055, w: 0.11, h: 0.7, kind: 'monument' },
  { id: 'ware-a', x: 0.17, w: 0.045, h: 0.32, kind: 'block' },
  { id: 'peterskirche', x: 0.218, w: 0.055, h: 0.96, kind: 'spire' },
  { id: 'ware-b', x: 0.278, w: 0.06, h: 0.38, kind: 'block' },
  { id: 'rathaus', x: 0.345, w: 0.1, h: 0.9, kind: 'rathaus' },
  { id: 'thomaskirche', x: 0.455, w: 0.078, h: 0.72, kind: 'church' },
  { id: 'cityhochhaus', x: 0.545, w: 0.09, h: 1, kind: 'highrise' },
  { id: 'nikolai', x: 0.648, w: 0.07, h: 0.78, kind: 'church' },
  { id: 'dome', x: 0.728, w: 0.07, h: 0.5, kind: 'dome' },
  { id: 'ware-c', x: 0.805, w: 0.08, h: 0.34, kind: 'block' },
  { id: 'ware-d', x: 0.89, w: 0.07, h: 0.44, kind: 'block' },
  { id: 'ware-e', x: 0.962, w: 0.038, h: 0.26, kind: 'block' },
]

export function drawBuildingSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  w: number,
  h: number,
  kind: SkylineKind,
): void {
  ctx.beginPath()

  if (kind === 'spire') {
    const shaft = w * 0.38
    const sx = x + (w - shaft) / 2
    ctx.moveTo(sx, baseline)
    ctx.lineTo(sx, baseline - h * 0.62)
    ctx.lineTo(x + w * 0.5, baseline - h)
    ctx.lineTo(sx + shaft, baseline - h * 0.62)
    ctx.lineTo(sx + shaft, baseline)
  } else if (kind === 'church') {
    const nave = w * 0.72
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h * 0.42)
    ctx.lineTo(x + w * 0.18, baseline - h * 0.42)
    ctx.lineTo(x + w * 0.18, baseline - h * 0.7)
    ctx.lineTo(x + w * 0.5, baseline - h)
    ctx.lineTo(x + w * 0.82, baseline - h * 0.7)
    ctx.lineTo(x + w * 0.82, baseline - h * 0.42)
    ctx.lineTo(x + nave, baseline - h * 0.42)
    ctx.lineTo(x + nave, baseline)
  } else if (kind === 'rathaus') {
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h * 0.4)
    ctx.lineTo(x + w * 0.42, baseline - h * 0.4)
    ctx.lineTo(x + w * 0.42, baseline - h * 0.78)
    ctx.lineTo(x + w * 0.5, baseline - h)
    ctx.lineTo(x + w * 0.58, baseline - h * 0.78)
    ctx.lineTo(x + w * 0.58, baseline - h * 0.4)
    ctx.lineTo(x + w, baseline - h * 0.4)
    ctx.lineTo(x + w, baseline)
  } else if (kind === 'highrise') {
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h * 0.9)
    ctx.lineTo(x + w * 0.12, baseline - h)
    ctx.lineTo(x + w * 0.88, baseline - h)
    ctx.lineTo(x + w, baseline - h * 0.9)
    ctx.lineTo(x + w, baseline)
  } else if (kind === 'monument') {
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h * 0.28)
    ctx.lineTo(x + w * 0.16, baseline - h * 0.28)
    ctx.lineTo(x + w * 0.16, baseline - h * 0.55)
    ctx.lineTo(x + w * 0.3, baseline - h * 0.55)
    ctx.lineTo(x + w * 0.3, baseline - h * 0.78)
    ctx.lineTo(x + w * 0.5, baseline - h)
    ctx.lineTo(x + w * 0.7, baseline - h * 0.78)
    ctx.lineTo(x + w * 0.7, baseline - h * 0.55)
    ctx.lineTo(x + w * 0.84, baseline - h * 0.55)
    ctx.lineTo(x + w * 0.84, baseline - h * 0.28)
    ctx.lineTo(x + w, baseline - h * 0.28)
    ctx.lineTo(x + w, baseline)
  } else if (kind === 'dome') {
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h * 0.45)
    ctx.quadraticCurveTo(x + w * 0.5, baseline - h * 1.05, x + w, baseline - h * 0.45)
    ctx.lineTo(x + w, baseline)
  } else {
    ctx.moveTo(x, baseline)
    ctx.lineTo(x, baseline - h)
    ctx.lineTo(x + w, baseline - h)
    ctx.lineTo(x + w, baseline)
  }

  ctx.closePath()
  ctx.fill()
}
