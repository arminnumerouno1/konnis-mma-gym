import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { sampleLights } from '../lib/cameraPath'
import { windowOpacity } from '../lib/math'
import { scrollProgress, useExperience } from '../store'
import { sharedParticle } from './textures'

const DESKTOP_POS: [number, number, number] = [1.14, 0, -39.35]
const COMPACT_POS: [number, number, number] = [0.12, 0, -38.4]
const HEIGHT = 2.04
const WIDTH = HEIGHT * (644 / 1360)

const FOG_COLOR = new THREE.Color('#070706')

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vDist;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uReveal;
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec2 vUv;
  varying float vDist;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float alpha = smoothstep(0.02, 0.42, tex.a);
    float body = 1.0 - distance(vUv, vec2(0.48, 0.42));
    alpha *= smoothstep(0.0, 0.28, uReveal);
    alpha *= smoothstep(0.12, 0.9, uReveal + body * 0.2);
    alpha *= smoothstep(0.02, 0.2, vUv.y);
    alpha *= smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);

    vec3 col = tex.rgb;
    col = pow(max(col, vec3(0.0)), vec3(1.04));
    col *= vec3(1.04, 0.97, 0.9);
    col *= 0.2 + 0.8 * uReveal;
    col *= smoothstep(0.03, 0.28, vUv.y);

    float lift = mix(-0.05, 1.12, uReveal);
    col *= 0.42 + 0.58 * smoothstep(lift - 0.4, lift + 0.08, vUv.y);
    float band = 1.0 - smoothstep(0.0, 0.22, abs(vUv.y - mix(0.12, 0.7, uReveal)));
    col += vec3(1.06, 0.94, 0.72) * band * 0.16 * uReveal;

    float haze = 0.84 + 0.16 * sin(uTime * 0.4 + vUv.y * 3.4);
    col *= haze;

    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 0.82);
    col = mix(col, uFogColor, fogFactor);
    alpha *= 1.0 - fogFactor * 0.28;

    if (alpha < 0.02) discard;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function HaloDust({
  reveal,
  compact,
}: {
  reveal: MutableRefObject<number>
  compact: boolean
}) {
  const ref = useRef<THREE.Points>(null)
  const count = compact ? 36 : 16
  const tex = useMemo(() => sharedParticle(), [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 1.7
      pos[i * 3 + 1] = 0.15 + Math.random() * 2.05
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.9
      spd[i] = 0.04 + Math.random() * 0.08
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.userData.spd = spd
    return g
  }, [count])

  useFrame((_, dt) => {
    const points = ref.current
    if (!points) return
    const amount = reveal.current
    points.visible = amount > 0.04
    const mat = points.material as THREE.PointsMaterial
    mat.opacity = amount * (compact ? 0.42 : 0.22)
    if (!points.visible) return
    const attr = geo.getAttribute('position')
    const spd = geo.userData.spd as Float32Array
    for (let i = 0; i < count; i += 1) {
      let y = attr.getY(i) + spd[i] * dt
      if (y > 2.25) y = 0.12
      attr.setY(i, y)
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        color="#e4d3a8"
        size={compact ? 0.055 : 0.036}
        transparent
        opacity={0}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

type KonradProps = {
  position?: [number, number, number]
}

export function Konrad({ position = DESKTOP_POS }: KonradProps) {
  const compact = useExperience((s) => s.compact)
  const map = useTexture('/brand/konrad.png')
  const particle = useMemo(() => sharedParticle(), [])
  const group = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const wash = useRef<THREE.MeshBasicMaterial>(null)
  const pool = useRef<THREE.MeshBasicMaterial>(null)
  const cone = useRef<THREE.MeshBasicMaterial>(null)
  const ray = useRef<THREE.MeshBasicMaterial>(null)
  const key = useRef<THREE.SpotLight>(null)
  const rim = useRef<THREE.SpotLight>(null)
  const bounce = useRef<THREE.PointLight>(null)
  const revealRef = useRef(0)
  const origin = compact ? COMPACT_POS : position
  const scale = compact ? 1.16 : 1.04

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uReveal: { value: 0 },
        uTime: { value: 0 },
        uFogColor: { value: FOG_COLOR.clone() },
        uFogDensity: { value: 0.03 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      toneMapped: true,
      fog: false,
      side: THREE.FrontSide,
    })
  }, [map])

  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    map.generateMipmaps = true
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.magFilter = THREE.LinearFilter
    map.needsUpdate = true
  }, [map])

  useEffect(() => {
    matRef.current = material
    return () => material.dispose()
  }, [material])

  useFrame((state) => {
    const p = scrollProgress.current
    const reveal = compact
      ? windowOpacity(p, 0.4, 0.432, 0.452, 0.478)
      : windowOpacity(p, 0.328, 0.368, 0.442, 0.508)
    const light = compact
      ? windowOpacity(p, 0.382, 0.414, 0.456, 0.484)
      : reveal
    revealRef.current = Math.max(reveal, light * 0.35)

    material.uniforms.uReveal.value = reveal
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uFogDensity.value = sampleLights(p).fog

    if (glow.current) glow.current.opacity = light * (compact ? 0.38 : 0.12)
    if (wash.current) wash.current.opacity = light * (compact ? 0.22 : 0.06)
    if (pool.current) pool.current.opacity = light * (compact ? 0.32 : 0.12)
    if (cone.current) cone.current.opacity = light * (compact ? 0.2 : 0.08)
    if (ray.current) ray.current.opacity = light * (compact ? 0.14 : 0.05)
    if (key.current) key.current.intensity = light * (compact ? 28 : 14)
    if (rim.current) rim.current.intensity = light * (compact ? 14 : 6)
    if (bounce.current) bounce.current.intensity = light * (compact ? 4.2 : 1.6)

    const g = group.current
    if (!g) return
    g.visible = reveal > 0.015 || light > 0.04
    g.scale.setScalar(scale * (0.96 + 0.04 * reveal))
    g.position.y = origin[1] + (1 - reveal) * (compact ? -0.1 : -0.05)
    g.rotation.y = compact ? 0.02 : -0.035
  })

  return (
    <group ref={group} position={origin} scale={scale}>
      <spotLight
        ref={key}
        position={[0.52, 2.55, 1.55]}
        angle={0.42}
        penumbra={0.72}
        color="#f4efe4"
        intensity={0}
        distance={7.5}
        decay={2}
      >
        <object3D attach="target" position={[0.04, 1.12, 0.02]} />
      </spotLight>
      <spotLight
        ref={rim}
        position={[-0.62, 1.85, -0.72]}
        angle={0.55}
        penumbra={0.8}
        color="#c9b48a"
        intensity={0}
        distance={5.5}
        decay={2}
      >
        <object3D attach="target" position={[0.08, 1.25, 0.04]} />
      </spotLight>
      <pointLight ref={bounce} position={[-0.28, 1.15, 0.35]} color="#4a1612" intensity={0} distance={3.2} decay={2} />

      <mesh position={[0.04, HEIGHT * 0.55, -0.14]} scale={[WIDTH * 1.85, HEIGHT * 1.35, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={glow}
          map={particle}
          color="#d7bc7c"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0.02, HEIGHT * 0.48, -0.22]} scale={[WIDTH * 2.4, HEIGHT * 1.7, 1]} renderOrder={0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={wash}
          map={particle}
          color="#8a6a3a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0.05, 2.55, -0.1]} scale={[0.72, 4.2, 1]} renderOrder={0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={cone}
          map={particle}
          color="#f0e4c4"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.05, 2.55, -0.1]} rotation={[0, Math.PI / 2, 0]} scale={[0.55, 4.2, 1]} renderOrder={0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={ray}
          map={particle}
          color="#e8d7a4"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, HEIGHT / 2, 0]} renderOrder={3} frustumCulled={false}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <primitive object={material} attach="material" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.03, 0.016, 0.1]} renderOrder={1}>
        <circleGeometry args={[1.05, 28]} />
        <meshBasicMaterial
          ref={pool}
          map={particle}
          color="#c8b48a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.04, 0.012, 0.08]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>

      <HaloDust reveal={revealRef} compact={compact} />
    </group>
  )
}
