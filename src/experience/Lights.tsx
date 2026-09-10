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

function ChannelPoint({
  channel,
  scale,
  reveal,
  ...props
}: Omit<ComponentProps<'pointLight'>, 'ref' | 'intensity'> & {
  channel: Channel
  scale: number
  reveal?: boolean
}) {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const light = ref.current
    if (!light) return
    const sampled = sampleLights(scrollProgress.current)[channel]
    light.intensity = sampled * (reveal ? introReveal.value : 1) * scale
  })
  return <pointLight ref={ref} intensity={0} {...props} />
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
  const cityDir = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const { gl, scene } = useThree()

  useFrame(() => {
    const s = sampleLights(scrollProgress.current)
    if (cityDir.current) cityDir.current.intensity = s.city * 2.2
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
        lookAt={[-2.4, 0.4, -17]}
        position={[0.4, 6.1, -12]}
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
      <ChannelPoint channel="gym" scale={6.2} position={[-3.35, 1.55, -17.6]} color="#5c1010" distance={8} decay={2} />
      <ChannelPoint channel="gym" scale={3.4} position={[4.5, 1.25, -24.8]} color="#4a1010" distance={6.5} decay={2} />
      <ChannelPoint channel="gym" scale={2.4} position={[-6.6, 1.7, -18.4]} color="#3a0c0c" distance={5.5} decay={2} />
      <ChannelPoint channel="gym" scale={2.8} position={[-3.9, 2.35, -25.1]} color="#4a1010" distance={5.2} decay={2} />
      <AimedSpot
        channel="gym"
        scale={16}
        lookAt={[-3.35, 0.35, -17.6]}
        position={[-3.35, 5.9, -17.6]}
        angle={0.4}
        penumbra={0.55}
        color="#8a1812"
        distance={11}
      />
      <AimedSpot
        channel="side"
        lookAt={[0.4, 1.3, -67]}
        position={[7.2, 3.4, -66]}
        angle={0.72}
        penumbra={0.35}
        color="#f4efe6"
        distance={18}
      />
      <AimedSpot
        channel="side"
        scale={22}
        lookAt={[0.15, 1.15, -66.8]}
        position={[-5.8, 3.1, -66.4]}
        angle={0.55}
        penumbra={0.62}
        color="#7a1410"
        distance={16}
      />
      <ChannelPoint channel="side" scale={4.2} position={[0.15, 1.45, -66.8]} color="#4a1010" distance={7} decay={2} />
      <ChannelPoint channel="intro" reveal scale={2.2} position={[0.55, 0.32, 0.7]} color="#3a0c0c" distance={4.2} decay={2} />
      <ChannelPoint channel="finale" scale={3.6} position={[0, 0.38, -113.5]} color="#4a1010" distance={5.5} decay={2} />

      <directionalLight ref={cityDir} position={[-4.2, 7.2, -86]} color="#e8e2d6" />
      <AimedSpot
        channel="city"
        scale={42}
        lookAt={[0, 1.0, -94]}
        position={[1.2, 6.4, -86]}
        angle={0.55}
        penumbra={0.72}
        color="#efeae1"
        distance={24}
      />
      {quality !== 'low' && (
        <AimedSpot
          channel="city"
          scale={22}
          lookAt={[0, 0.85, -94]}
          position={[-5.4, 5.8, -90]}
          angle={0.5}
          penumbra={0.75}
          color="#ebe6dc"
          distance={20}
        />
      )}
      <AimedSpot
        channel="city"
        scale={18}
        lookAt={[0, 0.45, -94]}
        position={[0, 6.1, -94]}
        angle={0.42}
        penumbra={0.55}
        color="#8a1812"
        distance={12}
      />
      <ChannelPoint channel="city" scale={5.2} position={[0, 1.45, -94]} color="#5c1010" distance={8} decay={2} />

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
