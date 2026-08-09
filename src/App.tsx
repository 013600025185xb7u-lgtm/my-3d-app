import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useSimStore } from './store'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as THREE from 'three'

// --- 1. 3Dモデルのコンポーネント ---
function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null!)
  // Zustandから「スピード」と「データ更新関数」を取り出す
  const speed = useSimStore((state) => state.speed)
  const updateData = useSimStore((state) => state.updateData)

  // 毎フレーム（アニメーション）実行される処理
  useFrame(() => {
    meshRef.current.rotation.x += 0.01 * speed
    meshRef.current.rotation.y += 0.01 * speed
    
    // たまにグラフのデータを更新する
    if (Math.random() > 0.95) {
        updateData()
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#00ff88" wireframe={false} />
    </mesh>
  )
}

// --- 2. メイン画面のコンポーネント ---
export default function App() {
  const { speed, setSpeed, data } = useSimStore()

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* 上部ヘッダー（コントロールパネル） */}
      <div style={{ padding: '20px', borderBottom: '1px solid #333', backgroundColor: '#111' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>3D Simulation & Real-time Chart</h1>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <label>Speed (Zustand State): {speed}</label>
          <input 
            type="range" 
            min="0" max="10" 
            value={speed} 
            onChange={(e) => setSpeed(Number(e.target.value))} 
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>
      
      {/* メインエリア（左: 3D, 右: グラフ） */}
      <div style={{ display: 'flex', flex: 1, backgroundColor: '#1a1a1a' }}>
        
        {/* 左側: Three Fiber Canvas */}
        <div style={{ flex: 2, position: 'relative' }}>
          <Canvas camera={{ position: [0, 0, 5] }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <RotatingBox />
            {/* マウスでカメラを動かせる魔法のツール */}
            <OrbitControls />
          </Canvas>
          <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#888' }}>
            Mouse drag to rotate / Scroll to zoom
          </div>
        </div>

        {/* 右側: Recharts Graph */}
        <div style={{ flex: 1, padding: '20px', borderLeft: '1px solid #333', backgroundColor: '#222' }}>
          <h2 style={{ marginTop: 0 }}>Sensor Data (Recharts)</h2>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #444' }} />
                <Line type="monotone" dataKey="value" stroke="#00ff88" strokeWidth={3} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ color: '#aaa', fontSize: '14px', marginTop: '20px' }}>
            ↑ 3Dの回転スピードと連動してグラフの変動幅が変わります（Zustandで連携）。
          </p>
        </div>
        
      </div>
    </div>
  )
}
