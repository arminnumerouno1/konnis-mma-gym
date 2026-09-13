import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import * as THREE from 'three'
import type { QualityLevel } from '../lib/quality'
import { useExperience } from '../store'
import { AccentLights } from './AccentLights'
import { CameraRig } from './CameraRig'
import { Lights } from './Lights'
import { PostFX } from './PostFX'
import { World } from './World'

function ReadyFlag() {
  const setReady = useExperience((s) => s.setReady)
  const sent = useRef(false)
  useFrame(() => {
    if (sent.current) return
    sent.current = true
    setReady(true)
  })
  return null
}

export function Experience({
  quality,
  reducedMotion,
}: {
  quality: QualityLevel
  reducedMotion: boolean
}) {
  useEffect(() => {
    return () => {
      useExperience.getState().setReady(false)
    }
  }, [])

  return (
    <Canvas
      className="canvas"
      frameloop={reducedMotion ? 'demand' : 'always'}
      dpr={quality === 'low' ? [1, 1.15] : quality === 'medium' ? [1, 1.5] : [1, 1.75]}
      performance={{ min: quality === 'low' ? 0.55 : 0.7 }}
      shadows={quality === 'high'}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        stencil: false,
        alpha: false,
      }}
      camera={{ fov: 30, near: 0.12, far: 180, position: [0.18, 1.08, 10.6] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#050505', 1)
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.08
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <Suspense fallback={null}>
        <Lights quality={quality} />
        <AccentLights quality={quality} />
        <World quality={quality} />
        <CameraRig reducedMotion={reducedMotion} />
        <PostFX quality={quality} />
        {quality === 'high' && <Preload all />}
        <ReadyFlag />
      </Suspense>
    </Canvas>
  )
}
