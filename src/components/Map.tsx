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

      {/* 片面6クラスの教室（2階廊下に接する） */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[-25 + i * 10, 0, -4.5]}>
          <mesh receiveShadow>
            <boxGeometry args={[8, 0.1, 5]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* 教室の出入り口壁表示 */}
          <Box position={[0, 1, 2.5]} args={[8, 2, 0.1]}>
            <meshStandardMaterial color="#334155" transparent opacity={0.5} />
          </Box>
        </group>
      ))}

      {/* 180度折り返し階段（2階 -> 1階） */}
      {/* 踊り場までの下り */}
      <mesh position={[32, -1.75, -1.5]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[6, 0.1, 2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* 180度折り返して1階へ */}
      <mesh position={[32, -2.5, -4.5]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[6, 0.1, 2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* 1階 Floor & 昇降口 */}
      <mesh position={[30, -3.55, 0]} receiveShadow>
        <boxGeometry args={[12, 0.1, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* 昇降口ゲート（5人分並べる幅：約3m） */}
      <Box position={[30, -2.5, 5]} args={[3.0, 2, 0.2]}>
        <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={1.5} toneMapped={false} />
      </Box>

      <Grid position={[0, 0.01, 0]} args={[70, 20]} sectionColor="#00f3ff" cellColor="#1e293b" />
    </group>
  )
}
