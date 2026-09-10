function Steel({ color = '#1a1a1a' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.4} roughness={0.48} />
}

function Leather({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.78} metalness={0.05} />
}

const TILE = 1.02
const COLS = 6
const ROWS = 5

function Mats({ origin }: { origin: [number, number, number] }) {
  const [ox, oy, oz] = origin
  const tiles = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cream = (row + col) % 2 === 0
      tiles.push(
        <mesh
          key={`${row}-${col}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[ox + (col - (COLS - 1) / 2) * TILE, oy + 0.022, oz + (row - (ROWS - 1) / 2) * TILE]}
          receiveShadow
        >
          <planeGeometry args={[TILE - 0.03, TILE - 0.03]} />
          <meshStandardMaterial
            color={cream ? '#eadfd0' : '#c4281c'}
            roughness={0.88}
            metalness={0.02}
          />
        </mesh>,
      )
    }
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ox, oy + 0.012, oz]} receiveShadow>
        <planeGeometry args={[COLS * TILE + 0.18, ROWS * TILE + 0.18]} />
        <meshStandardMaterial color="#1a0c0c" roughness={0.92} metalness={0.04} />
      </mesh>
      {tiles}
    </group>
  )
}

function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.82, 0.82].map((x) =>
        [-0.14, 0.14].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.2, z]}>
            <boxGeometry args={[0.05, 0.4, 0.05]} />
            <Steel color="#2a2a28" />
          </mesh>
        )),
      )}
      {[-0.1, 0, 0.1].map((z) => (
        <mesh key={z} position={[0, 0.42, z]}>
          <boxGeometry args={[1.78, 0.045, 0.08]} />
          <meshStandardMaterial color="#6a4e32" roughness={0.82} metalness={0.04} />
        </mesh>
      ))}
    </group>
  )
}

function Duffel({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.15, 0.48, 4, 10]} />
        <Leather color="#141210" />
      </mesh>
      <mesh position={[0, 0.18, 0]} rotation={[0, 0, 0.08]}>
        <torusGeometry args={[0.14, 0.016, 6, 14, Math.PI]} />
        <Steel color="#2a2a2a" />
      </mesh>
    </group>
  )
}

function Glove({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation} scale={1.15}>
      <mesh position={[0, 0.05, 0.02]}>
        <boxGeometry args={[0.17, 0.09, 0.22]} />
        <Leather color="#1c1210" />
      </mesh>
      <mesh position={[0, 0.055, 0.14]}>
        <boxGeometry args={[0.16, 0.08, 0.09]} />
        <Leather color="#8a1812" />
      </mesh>
      <mesh position={[0, 0.038, -0.11]}>
        <boxGeometry args={[0.1, 0.055, 0.1]} />
        <Leather color="#121010" />
      </mesh>
    </group>
  )
}

function Shoe({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.045, 0.02]}>
        <boxGeometry args={[0.11, 0.07, 0.26]} />
        <meshStandardMaterial color="#c9c0b2" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.012, 0.01]}>
        <boxGeometry args={[0.12, 0.025, 0.28]} />
        <meshStandardMaterial color="#1a1a18" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  )
}

export function Arrival({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Mats origin={[0, 0, -0.35]} />
      <Bench position={[0.15, 0, 2.05]} />
      <group scale={0.88} position={[-0.42, 0.52, 2.02]}>
        <Duffel position={[0, 0, 0]} rotationY={0.35} />
      </group>
      <Glove position={[0.38, 0.46, 2.08]} rotation={[-0.12, 0.55, 0.18]} />
      <Glove position={[0.55, 0.46, 1.92]} rotation={[-0.08, -0.4, -0.12]} />
      <Shoe position={[-1.15, 0, 2.52]} rotationY={0.4} />
      <Shoe position={[-0.98, 0, 2.58]} rotationY={0.22} />
    </group>
  )
}
