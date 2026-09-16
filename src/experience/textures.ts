import * as THREE from 'three'

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function makeNoiseTexture(size = 256, contrast = 46): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n =
        noise(x * 0.08, y * 0.08) * 0.55 +
        noise(x * 0.2, y * 0.2) * 0.3 +
        noise(x * 0.6, y * 0.6) * 0.15
      const c = 110 + (n - 0.5) * contrast
      const i = (y * size + x) * 4
      img.data[i] = c
      img.data[i + 1] = c
      img.data[i + 2] = c
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export function makeChainLinkTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 7
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(size / 2, 2)
  ctx.lineTo(size - 2, size / 2)
  ctx.lineTo(size / 2, size - 2)
  ctx.lineTo(2, size / 2)
  ctx.closePath()
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function makeSoftParticle(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

const cache: {
  noise?: THREE.CanvasTexture
  chain?: THREE.CanvasTexture
  particle?: THREE.CanvasTexture
} = {}

export function sharedNoise(): THREE.CanvasTexture {
  cache.noise ??= makeNoiseTexture()
  return cache.noise
}

export function sharedChain(): THREE.CanvasTexture {
  cache.chain ??= makeChainLinkTexture()
  return cache.chain
}

export function sharedParticle(): THREE.CanvasTexture {
  cache.particle ??= makeSoftParticle()
  return cache.particle
}

export function chainWithRepeat(x: number, y: number): THREE.CanvasTexture {
  const tex = sharedChain().clone()
  tex.repeat.set(x, y)
  tex.needsUpdate = true
  return tex
}
