import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Sphere, Box } from '@react-three/drei'
import * as THREE from 'three'

// 避難口（ゴール）と障害物の定義
const EXIT_POS = new THREE.Vector3(0, 0.5, 12)
const CLASSROOM_POS = new THREE.Vector3(0, 0.5, -12)
const OBSTACLES = [
  { pos: new THREE.Vector3(-1.8, 0.5, 0), size: [2.5, 1.2, 2] as [number, number, number] },
  { pos: new THREE.Vector3(2.2, 0.5, 4), size: [2, 1.2, 1.5] as [number, number, number] }
]

type AgentData = {
  id: number
  isReverse: boolean
  startPos: [number, number, number]
  speed: number
  radius: number
}

// エージェント（人）コンポーネント
function Agent({
  data,
  allAgentsRef,
  onEscape
}: {
  data: AgentData
  allAgentsRef: React.MutableRefObject<Map<number, THREE.Vector3>>
  onEscape: (id: number) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [escaped, setEscaped] = useState(false)
  const targetPos = data.isReverse ? CLASSROOM_POS : EXIT_POS
  const colorRef = useRef<string>('#00f3ff')

  useFrame((_, delta) => {
    if (!meshRef.current || escaped) return

    const currentPos = meshRef.current.position
    allAgentsRef.current.set(data.id, currentPos.clone())

    const moveDir = new THREE.Vector3().subVectors(targetPos, currentPos)
    const distToTarget = moveDir.length()

    if (distToTarget < 1.0 && !data.isReverse) {
      setEscaped(true)
      allAgentsRef.current.delete(data.id)
      onEscape(data.id)
      return
    }

    moveDir.normalize()

    // 障害物回避
    OBSTACLES.forEach((obs) => {
      const distToObs = currentPos.distanceTo(obs.pos)
      if (distToObs < 2.5) {
        const avoidDir = new THREE.Vector3().subVectors(currentPos, obs.pos).normalize()
        moveDir.addScaledVector(avoidDir, 2.2)
      }
    })

    // 密度・近接計算
    let nearbyCount = 0
    allAgentsRef.current.forEach((otherPos, otherId) => {
      if (otherId === data.id) return
      const dist = currentPos.distanceTo(otherPos)

      if (dist < 3.0) {
        nearbyCount++
        if (dist < data.radius * 2 + 0.3) {
          const pushDir = new THREE.Vector3().subVectors(currentPos, otherPos).normalize()
          moveDir.addScaledVector(pushDir, 3.2)
        }
      }
    })

    let speedFactor = 1.0
    if (nearbyCount > 5) {
      speedFactor = 0.4
      colorRef.current = '#ff2a6d' // 密集（ネオンピンク）
    } else if (nearbyCount > 2) {
      speedFactor = 0.7
      colorRef.current = '#ffb703' // 混雑（アンバー）
    } else {
      colorRef.current = data.isReverse ? '#7000ff' : '#00f3ff' // 逆走者はパープル、通常はシアン
    }

    moveDir.normalize()
    currentPos.addScaledVector(moveDir, data.speed * speedFactor * delta)
  })

  if (escaped) return null

  return (
    <Sphere ref={meshRef} position={data.startPos} args={[data.radius, 32, 32]}>
      <meshStandardMaterial
        color={colorRef.current}
        emissive={colorRef.current}
        emissiveIntensity={0.6}
        roughness={0.2}
        metalness={0.8}
      />
    </Sphere>
  )
}

export default function App() {
  const [agentCount] = useState(30)
  const [escapedCount, setEscapedCount] = useState(0)
  const [time, setTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const allAgentsRef = useRef<Map<number, THREE.Vector3>>(new Map())

  const [agents] = useState<AgentData[]>(() => {
    return Array.from({ length: agentCount }, (_, i) => {
      const isReverse = i < 3
      return {
        id: i,
        isReverse,
        startPos: [
          (Math.random() - 0.5) * 6,
          0.4,
          isReverse ? 8 + Math.random() * 2 : -10 + (Math.random() - 0.5) * 4
        ],
        speed: isReverse ? 2.0 : 2.5 + Math.random() * 1.8,
        radius: 0.3 + Math.random() * 0.12
      }
    })
  })

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => setTime((t) => t + 0.1), 100)
    return () => clearInterval(timer)
  }, [isPaused])

  const handleEscape = () => {
    setEscapedCount((prev) => prev + 1)
  }

  const escapeRate = (((escapedCount) / (agentCount - 3)) * 100).toFixed(0)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#090a0f', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Helios風 ダッシュボード ヘッダー & パネル */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: 24,
        zIndex: 10,
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        
        {/* タイトルパネル */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 10px #00f3ff' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', color: '#00f3ff', textTransform: 'uppercase' }}>HELIOS SIMULATION</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#ffffff' }}>Evacuation Dynamics</h1>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>Agent-Based Emergency Crowd Analysis</p>
        </div>

        {/* メトリクス（KPI）パネル */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>ELAPSED TIME</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginTop: '4px' }}>{time.toFixed(1)}<span style={{ fontSize: '12px', color: '#64748b' }}>s</span></div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>EVACUATED</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#00f3ff', marginTop: '4px' }}>{escapedCount}<span style={{ fontSize: '12px', color: '#64748b' }}>/{agentCount - 3}</span></div>
          </div>

          <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
              <span>EVACUATION RATE</span>
              <span style={{ color: '#00f3ff', fontWeight: '600' }}>{escapeRate}%</span>
            </div>
            {/* プログレスバー */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${escapeRate}%`, height: '100%', background: 'linear-gradient(90deg, #00f3ff, #7000ff)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>

        {/* コントロール・凡例 */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 8px #00f3ff' }} /> Evacuee (Clear)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffb703' }} /> Congested Area</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff2a6d' }} /> High Density</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7000ff' }} /> Reverse Flow Agent</div>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              width: '100%',
              padding: '12px',
              background: isPaused ? 'linear-gradient(135deg, #00f3ff, #00aaee)' : 'linear-gradient(135deg, #ff2a6d, #ff0055)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              letterSpacing: '0.5px',
              boxShadow: isPaused ? '0 0 20px rgba(0,243,255,0.4)' : '0 0 20px rgba(255,42,109,0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {isPaused ? '▶ RESUME SIMULATION' : '⏸ PAUSE SIMULATION'}
          </button>
        </div>

      </div>

      {/* 3D キャンバス */}
      <Canvas camera={{ position: [0, 18, 16], fov: 45 }}>
        <color attach="background" args={['#090a0f']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} color="#ffffff" />
        <pointLight position={[0, 5, 12]} intensity={2} color="#00ff66" distance={10} />

        {/* グリッド床 */}
        <Grid
          args={[20, 30]}
          cellSize={1}
          cellThickness={1}
          cellColor="#1e293b"
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor="#00f3ff"
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid={false}
          position={[0, 0, 0]}
        />

        {/* 非常口（発光ゲート） */}
        <Box position={[0, 1, 14]} args={[4.5, 2, 0.3]}>
          <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={1.2} toneMapped={false} />
        </Box>

        {/* 障害物（崩落・ガレキ） */}
        {OBSTACLES.map((obs, idx) => (
          <Box key={idx} position={obs.pos.toArray()} args={obs.size}>
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
          </Box>
        ))}

        {/* 避難者・逆走者 */}
        {agents.map((agent) => (
          <Agent key={agent.id} data={agent} allAgentsRef={allAgentsRef} onEscape={handleEscape} />
        ))}

        <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={40} />
      </Canvas>
    </div>
  )
}