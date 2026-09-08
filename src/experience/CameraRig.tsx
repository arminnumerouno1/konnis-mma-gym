import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleCameraInto } from '../lib/cameraPath'
import { scrollProgress } from '../store'

export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree()
  const pos = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    const fov = sampleCameraInto(reducedMotion ? 0.1 : 0, pos, target)
    camera.position.copy(pos)
    look.copy(target)
    camera.lookAt(look)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, look, pos, reducedMotion, target])

  useFrame((_, dt) => {
    if (reducedMotion) return
    const fov = sampleCameraInto(scrollProgress.current, pos, target)
    const lambda = 8.5
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pos.x, lambda, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pos.y, lambda, dt)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pos.z, lambda, dt)
    look.x = THREE.MathUtils.damp(look.x, target.x, lambda, dt)
    look.y = THREE.MathUtils.damp(look.y, target.y, lambda, dt)
    look.z = THREE.MathUtils.damp(look.z, target.z, lambda, dt)
    camera.lookAt(look)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 6.5, dt)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
