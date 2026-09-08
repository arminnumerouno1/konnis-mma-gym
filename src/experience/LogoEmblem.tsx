import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { drawLogo, drawLogoRoughness } from '../brand/drawLogo'

type LogoEmblemProps = {
  position: [number, number, number]
  scale?: number
}

function makeTexture(canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = colorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function LogoEmblem({ position, scale = 1 }: LogoEmblemProps) {
  const [maps, setMaps] = useState<{
    albedo: THREE.CanvasTexture
    roughness: THREE.CanvasTexture
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await document.fonts.load('400 120px "Bebas Neue"')
      if (cancelled) return
      const albedo = makeTexture(drawLogo(2048), THREE.SRGBColorSpace)
      const roughness = makeTexture(drawLogoRoughness(1024), THREE.NoColorSpace)
      setMaps({ albedo, roughness })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const plateMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1c1c1b',
        metalness: 0.88,
        roughness: 0.38,
        envMapIntensity: 0.35,
      }),
    [],
  )

  const faceMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      metalness: 0.72,
      roughness: 0.42,
      transparent: true,
    })
    return mat
  }, [])

  useEffect(() => {
    if (!maps) return
    faceMat.map = maps.albedo
    faceMat.roughnessMap = maps.roughness
    faceMat.needsUpdate = true
    return () => {
      maps.albedo.dispose()
      maps.roughness.dispose()
    }
  }, [maps, faceMat])

  return (
    <group position={position} scale={scale} rotation={[0, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 8]} material={plateMat} castShadow>
        <cylinderGeometry args={[1.22, 1.22, 0.09, 8]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 8]} position={[0, 0, 0.05]} material={faceMat}>
        <cylinderGeometry args={[1.145, 1.145, 0.012, 8]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 8]} position={[0, 0, -0.05]} material={plateMat}>
        <cylinderGeometry args={[1.145, 1.145, 0.01, 8]} />
      </mesh>
    </group>
  )
}
