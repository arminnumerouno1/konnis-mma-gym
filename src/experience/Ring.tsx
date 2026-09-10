function Steel({ color = '#1c1c1c' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.4} roughness={0.46} />
}

function RopeSkin() {
  return <meshStandardMaterial color="#f2ebe0" roughness={0.48} metalness={0.06} />
}

const CANVAS = 4.22
const HALF = CANVAS / 2
const DECK = 0.4
const POST_H = 1.52
const ROPE_Y = [DECK + 0.34, DECK + 0.68, DECK + 1.02] as const

const CORNERS: [number, number][] = [
  [-HALF, -HALF],
  [HALF, -HALF],
  [HALF, HALF],
  [-HALF, HALF],
]

function side(i: number) {
  const a = CORNERS[i]
  const b = CORNERS[(i + 1) % 4]
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  return {
    midX: (a[0] + b[0]) / 2,
    midZ: (a[1] + b[1]) / 2,
    span: Math.hypot(dx, dz) - 0.18,
    rotY: Math.atan2(dx, dz),
  }
}

export function SparringRing({ position }: { position: [number, number, number] }) {
  const sides = CORNERS.map((_, i) => side(i))

  return (
    <group position={position}>
      <mesh position={[0, DECK / 2, 0]}>
        <boxGeometry args={[CANVAS + 0.62, DECK, CANVAS + 0.62]} />
        <meshStandardMaterial color="#161412" roughness={0.9} metalness={0.06} />
      </mesh>
      <mesh position={[0, DECK + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CANVAS, CANVAS]} />
        <meshStandardMaterial color="#e4d9c8" roughness={0.72} metalness={0.03} />
      </mesh>
      {sides.map((s, i) => (
        <mesh key={`apron-${i}`} position={[s.midX * 1.06, DECK + 0.04, s.midZ * 1.06]} rotation={[0, s.rotY, 0]}>
          <boxGeometry args={[0.05, 0.09, s.span + 0.28]} />
          <meshStandardMaterial color="#5c1210" roughness={0.78} metalness={0.08} />
        </mesh>
      ))}

      {CORNERS.map(([x, z], i) => {
        const red = i === 0 || i === 3
        return (
          <group key={`post-${i}`} position={[x, 0, z]}>
            <mesh position={[0, (DECK + POST_H) / 2, 0]}>
              <cylinderGeometry args={[0.068, 0.068, DECK + POST_H, 8]} />
              <Steel color="#2c2c2a" />
            </mesh>
            <mesh position={[0, DECK + POST_H + 0.07, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.16, 8]} />
              {red ? (
                <meshStandardMaterial color="#6a1210" roughness={0.55} metalness={0.1} emissive="#4a0808" emissiveIntensity={0.35} />
              ) : (
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.08} />
              )}
            </mesh>
            <mesh position={[0, DECK + 0.18, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.28, 8]} />
              <meshStandardMaterial color={red ? '#7a1410' : '#121212'} roughness={0.78} metalness={0.06} />
            </mesh>
          </group>
        )
      })}

      {sides.map((s, i) =>
        ROPE_Y.map((y, r) => (
          <mesh key={`rope-${i}-${r}`} position={[s.midX, y, s.midZ]} rotation={[0, s.rotY, 0]}>
            <boxGeometry args={[0.055, 0.055, s.span]} />
            <RopeSkin />
          </mesh>
        )),
      )}

      {[0.12, 0.24, 0.34].map((y, i) => (
        <mesh key={`step-${i}`} position={[0, y, HALF + 0.58 - i * 0.22]}>
          <boxGeometry args={[1.55 - i * 0.12, 0.12, 0.32]} />
          <meshStandardMaterial color="#1c1a18" roughness={0.88} metalness={0.08} />
        </mesh>
      ))}
    </group>
  )
}
