import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollProgress } from '../store'
import { sharedParticle } from './textures'

export function Dust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 14
      pos[i * 3 + 1] = Math.random() * 6.1
      pos[i * 3 + 2] = -6 - Math.random() * 108
      spd[i] = 0.03 + Math.random() * 0.07
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.userData.spd = spd
    return g
  }, [count])

  const tex = useMemo(() => sharedParticle(), [])

  useFrame((_, dt) => {
    const points = ref.current
    if (!points) return
    const p = scrollProgress.current
    points.visible = p > 0.12 && p < 0.92
    if (!points.visible) return
    const attr = geo.getAttribute('position')
    const spd = geo.userData.spd as Float32Array
    for (let i = 0; i < count; i += 1) {
      let y = attr.getY(i) + spd[i] * dt
      if (y > 6.3) y = 0.08
      attr.setY(i, y)
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        color="#c4c0b6"
        size={0.042}
        transparent
        opacity={0.26}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
