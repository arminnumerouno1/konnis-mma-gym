import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ComponentProps } from 'react'
import * as THREE from 'three'
import { sampleLights, type LightKey } from '../lib/cameraPath'
import type { QualityLevel } from '../lib/quality'
import { introReveal, scrollProgress } from '../store'

type Channel = Exclude<keyof LightKey, 't' | 'fog' | 'exposure'>

const SCALE: Record<Channel, number> = {
  intro: 96,
  gym: 52,
  side: 90,
  city: 28,
  finale: 72,
}

type AimedSpotProps = Omit<ComponentProps<'spotLight'>, 'ref'> & {
  lookAt: [number, number, number]
  channel: Channel
  scale?: number
  reveal?: boolean
}

function AimedSpot({ lookAt, channel, scale, reveal, ...props }: AimedSpotProps) {
  const ref = useRef<THREE.SpotLight>(null)
  const [lx, ly, lz] = lookAt

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.set(lx, ly, lz)
    light.target.updateMatrixWorld()
    if (light.parent && light.target.parent !== light.parent) {
      light.parent.add(light.target)
    }
  }, [lx, ly, lz])

  useFrame(() => {
    const light = ref.current
    if (!light) return
    const sampled = sampleLights(scrollProgress.current)[channel]
    const mul = scale ?? SCALE[channel]
    const gate = reveal ? introReveal.value : 1
    light.intensity = sampled * gate * mul
  })

  return <spotLight ref={ref} {...props} />
}

export function Lights({ quality }: { quality: QualityLevel }) {
  const red = useRef<THREE.PointLight>(null)
  const cityDir = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const { gl, scene } = useThree()

  useFrame(() => {
    const s = sampleLights(scrollProgress.current)
    if (red.current) red.current.intensity = s.gym * 5
    if (cityDir.current) cityDir.current.intensity = s.city * 2.6
    if (fill.current) fill.current.intensity = (s.intro * introReveal.value + s.finale * 0.8) * 1.15
    gl.toneMappingExposure = s.exposure
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = s.fog
    }
  })

  const shadows = quality === 'high'

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fogExp2 attach="fog" args={['#070706', 0.05]} />
      <hemisphereLight args={['#3a3a36', '#080807', 0.28]} />
      <ambientLight intensity={0.12} color="#1a1a18" />
      <directionalLight ref={fill} position={[0.35, 2.4, 7.2]} color="#f2eee6" />

      <AimedSpot
        channel="intro"
        reveal
        lookAt={[0, 1.05, 0]}
        position={[1.15, 4.6, 3.4]}
        angle={0.38}
        penumbra={0.55}
        color="#f2eee6"
        distance={16}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <AimedSpot
        channel="intro"
        reveal
        scale={20}
        lookAt={[0, 1.05, 0]}
        position={[-2.4, 1.6, -2.2]}
        angle={0.5}
        penumbra={0.7}
        color="#d8d4cc"
        distance={10}
      />

      <AimedSpot
        channel="gym"
        scale={42}
        lookAt={[0, 0, -16]}
        position={[0, 6.1, -14]}
        angle={0.62}
        penumbra={0.72}
        color="#efeae1"
        distance={22}
      />
      {quality !== 'low' && (
        <AimedSpot
          channel="gym"
          scale={28}
          lookAt={[-2, 0, -26]}
          position={[-3.1, 6.1, -26]}
          angle={0.55}
          penumbra={0.75}
          color="#ebe6dc"
          distance={20}
        />
      )}
      {quality === 'high' && (
        <AimedSpot
          channel="gym"
          scale={24}
          lookAt={[1, 0, -38]}
          position={[3, 6.1, -38]}
          angle={0.5}
          penumbra={0.7}
          color="#efeae2"
          distance={20}
        />
      )}
      <pointLight ref={red} position={[-3.1, 2.2, -18.5]} color="#4a1010" distance={8} decay={2} />

      <AimedSpot
        channel="side"
        lookAt={[0.4, 1.3, -67]}
        position={[7.2, 3.4, -66]}
        angle={0.72}
        penumbra={0.35}
        color="#f4efe6"
        distance={18}
      />

      <directionalLight ref={cityDir} position={[-6, 10, -108]} color="#d8d4cc" />
      <AimedSpot
        channel="city"
        lookAt={[0, 2, -94]}
        position={[0, 8, -82]}
        angle={0.7}
        penumbra={0.8}
        color="#cfcabe"
        distance={36}
      />

      <AimedSpot
        channel="finale"
        lookAt={[0, 1.1, -114]}
        position={[0.8, 4.2, -110]}
        angle={0.4}
        penumbra={0.6}
        color="#f1ece3"
        distance={14}
      />
    </>
  )
}
