import { MAP_CONFIG, SimParams } from '../../types'

export function BuildingMap({ params }: { params: SimParams }) {
  const corridorLength = 60.0
  const cWidth = params.corridorWidth
  const doorWidth = 0.9
  const doorHeight = 2.0
  const roomDepth = 7.0
  const roomWidth = 8.0

  const roomZOffset = -(cWidth / 2 + roomDepth / 2)

  // 接続廊下寸法 (幅2.3m / X = 26.5m 中心)
  const accessWidth = 2.3
  const accessX = 26.5
  const accessX_left = accessX - accessWidth / 2  // 25.35m
  const accessX_right = accessX + accessWidth / 2 // 27.65m

  // 階段室寸法
  const stairWidth = 1.75
  const stairZ_near = cWidth / 2 + stairWidth / 2              // 手前側 (階段2)
  const stairZ_center = cWidth / 2 + stairWidth                // 中央仕切り壁
  const stairZ_far = cWidth / 2 + stairWidth + stairWidth / 2 // 奥側 (階段1)
  const stairZ_end = cWidth / 2 + stairWidth * 2              // 階段室北端

  return (
    <group name="building-map">
      {/* ---------------------------------------------------------
          床構造 (2階 ＆ 1階 メイン廊下)
      --------------------------------------------------------- */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[corridorLength, 0.1, cWidth]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, -3.55, 0]}>
        <boxGeometry args={[corridorLength, 0.1, cWidth]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* ---------------------------------------------------------
          🧱 メイン廊下の教室反対側（西側）外壁 【半透明アクリル壁】
      --------------------------------------------------------- */}
      <mesh position={[(-30 + accessX_left) / 2, 1.5, cWidth / 2]}>
        <boxGeometry args={[accessX_left - (-30), 3.0, 0.08]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} />
      </mesh>
      <mesh position={[(accessX_right + 30) / 2, 1.5, cWidth / 2]}>
        <boxGeometry args={[30 - accessX_right, 3.0, 0.08]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} />
      </mesh>

      {/* ---------------------------------------------------------
          🚶 接続廊下の床 (2階 ＆ 1階)
      --------------------------------------------------------- */}
      <mesh position={[accessX, -0.05, (cWidth / 2 + stairZ_end) / 2]}>
        <boxGeometry args={[accessWidth, 0.1, stairZ_end - cWidth / 2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[accessX, -3.55, (cWidth / 2 + stairZ_end) / 2]}>
        <boxGeometry args={[accessWidth, 0.1, stairZ_end - cWidth / 2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* ---------------------------------------------------------
          🧱 接続廊下の囲い壁
      --------------------------------------------------------- */}
      <mesh position={[accessX_right, 1.5, (cWidth / 2 + stairZ_end) / 2]}>
        <boxGeometry args={[0.08, 3.0, stairZ_end - cWidth / 2]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} />
      </mesh>
      <mesh position={[accessX_left, 1.5, (cWidth / 2 + stairZ_center) / 2]}>
        <boxGeometry args={[0.08, 3.0, stairZ_center - cWidth / 2]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} />
      </mesh>
      <mesh position={[accessX - 2.475, 1.5, stairZ_end]}>
        <boxGeometry args={[9.0, 3.0, 0.08]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.25} />
      </mesh>

      {/* 教室 ＆ 壁 ＆ 黒板 ＆ 机椅子 */}
      {MAP_CONFIG.classrooms.map((cls) => (
        <group key={cls.id} position={[cls.x, 0, roomZOffset]}>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[roomWidth, 0.1, roomDepth]} />
            <meshStandardMaterial color="#334155" />
          </mesh>

          {/* 教室外壁 (奥・左・右) */}
          <mesh position={[0, 1.5, -roomDepth / 2]}>
            <boxGeometry args={[roomWidth, 3.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>
          <mesh position={[-roomWidth / 2, 1.5, 0]}>
            <boxGeometry args={[0.1, 3.0, roomDepth]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>
          <mesh position={[roomWidth / 2, 1.5, 0]}>
            <boxGeometry args={[0.1, 3.0, roomDepth]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>

          {/* 🧱 教室正面（廊下側）壁：ドアの周りの隙間を完璧に埋める4分割壁 */}
          {/* 左端壁 (X: -4.0 〜 -2.95) */}
          <mesh position={[-3.475, 1.5, roomDepth / 2]}>
            <boxGeometry args={[1.05, 3.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.4} />
          </mesh>
          {/* 中央壁 (X: -2.05 〜 +2.05) */}
          <mesh position={[0, 1.5, roomDepth / 2]}>
            <boxGeometry args={[4.1, 3.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.4} />
          </mesh>
          {/* 右端壁 (X: +2.95 〜 +4.0) */}
          <mesh position={[3.475, 1.5, roomDepth / 2]}>
            <boxGeometry args={[1.05, 3.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.4} />
          </mesh>
          {/* ドア上部の欄間壁 */}
          <mesh position={[-2.5, 2.5, roomDepth / 2]}>
            <boxGeometry args={[doorWidth, 1.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.4} />
          </mesh>
          <mesh position={[2.5, 2.5, roomDepth / 2]}>
            <boxGeometry args={[doorWidth, 1.0, 0.1]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.4} />
          </mesh>

          {/* ドア 2箇所 */}
          <mesh position={[-2.5, doorHeight / 2, roomDepth / 2]}>
            <boxGeometry args={[doorWidth, doorHeight, 0.15]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[2.5, doorHeight / 2, roomDepth / 2]}>
            <boxGeometry args={[doorWidth, doorHeight, 0.15]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} />
          </mesh>

          {/* 🟢 黒板 */}
          <group position={[roomWidth / 2 - 0.12, 1.5, 0]}>
            <mesh>
              <boxGeometry args={[0.05, 1.3, 4.6]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            <mesh position={[-0.01, 0, 0]}>
              <boxGeometry args={[0.04, 1.2, 4.4]} />
              <meshStandardMaterial color="#064e3b" />
            </mesh>
          </group>

          {/* 🪑 机椅子 */}
          {Array.from({ length: 40 }).map((_, idx) => {
            const col = Math.floor(idx / 8)
            const row = idx % 8
            const seatX = -2.8 + col * 1.2
            const seatZ = -2.5 + row * 0.7

            return (
              <group key={idx} position={[seatX, 0, seatZ]}>
                <mesh position={[0.2, 0.35, 0]}>
                  <boxGeometry args={[0.4, 0.04, 0.6]} />
                  <meshStandardMaterial color="#b45309" />
                </mesh>
                <mesh position={[0.2, 0.175, 0]}>
                  <boxGeometry args={[0.35, 0.35, 0.55]} />
                  <meshStandardMaterial color="#475569" wireframe />
                </mesh>
                <mesh position={[-0.15, 0.2, 0]}>
                  <boxGeometry args={[0.35, 0.03, 0.35]} />
                  <meshStandardMaterial color="#78350f" />
                </mesh>
                <mesh position={[-0.3, 0.35, 0]}>
                  <boxGeometry args={[0.03, 0.3, 0.35]} />
                  <meshStandardMaterial color="#78350f" />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}

      {/* ---------------------------------------------------------
          🏢 階段室構造
      --------------------------------------------------------- */}
      <group position={[accessX, 0, 0]}>
        {/* 1. 奥側 1個目の下り階段 */}
        {Array.from({ length: 11 }).map((_, i) => (
          <mesh key={`step1-${i}`} position={[-1.15 - i * 0.45, -i * 0.159, stairZ_far]}>
            <boxGeometry args={[0.45, 0.159, stairWidth]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}

        {/* 🧱 中央仕切り壁 */}
        <mesh position={[-3.15, -1.75, stairZ_center]}>
          <boxGeometry args={[3.85, 4.0, 0.16]} />
          <meshStandardMaterial color="#334155" transparent opacity={0.8} />
        </mesh>

        {/* 2. 中間踊り場 */}
        <mesh position={[-5.975, -1.75, stairZ_center]}>
          <boxGeometry args={[2.0, 0.1, stairWidth * 2 + 0.16]} />
          <meshStandardMaterial color="#475569" />
        </mesh>

        {/* 踊り場突き当て壁 */}
        <mesh position={[-6.975, -1.75, stairZ_center]}>
          <boxGeometry args={[0.08, 4.0, stairWidth * 2 + 0.16]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} />
        </mesh>

        {/* 3. 手前側 2個目の下り階段 */}
        {Array.from({ length: 11 }).map((_, i) => (
          <mesh key={`step2-${i}`} position={[-4.95 + i * 0.45, -1.75 - i * 0.159, stairZ_near]}>
            <boxGeometry args={[0.45, 0.159, stairWidth]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}

        {/* 4. 1階 昇降口通路 ＆ 🟩 避難完了ゲート */}
        <mesh position={[1.5, -3.55, stairZ_near]}>
          <boxGeometry args={[3.0, 0.1, stairWidth]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[2.8, -2.5, stairZ_near]}>
          <boxGeometry args={[0.1, 2.0, stairWidth]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>

        {/* 階段室 手前側アクリル外壁 */}
        <mesh position={[-2.475, -1.75, stairZ_near - stairWidth / 2]}>
          <boxGeometry args={[9.0, 4.0, 0.08]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} />
        </mesh>
      </group>
    </group>
  )
}