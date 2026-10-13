import React from 'react'
import { Grid, Box } from '@react-three/drei'

export function Map() {
  return (
    <group>
      {/* 2階 Corridor Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[60, 0.1, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* 片面6クラスの教室 */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[-25 + i * 10, 0, -4.5]}>
          <mesh receiveShadow>
            <boxGeometry args={[8, 0.1, 5]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <Box position={[0, 1, 2.5]} args={[8, 2, 0.1]}>
            <meshStandardMaterial color="#334155" transparent opacity={0.5} />
          </Box>
        </group>
      ))}

      {/* 折り返し階段 */}
      <mesh position={[30, -1.75, -1.5]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[6, 0.1, 2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[30, -2.5, -4.5]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[6, 0.1, 2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* 1階 Floor & 昇降口 */}
      <mesh position={[28, -3.55, 0]} receiveShadow>
        <boxGeometry args={[12, 0.1, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* 昇降口（5人幅ゲート） */}
      <Box position={[28, -2.5, 5]} args={[3.0, 2, 0.2]}>
        <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={1.5} toneMapped={false} />
      </Box>

      <Grid position={[0, 0.01, 0]} args={[70, 20]} sectionColor="#00f3ff" cellColor="#1e293b" />
    </group>
  )
}
