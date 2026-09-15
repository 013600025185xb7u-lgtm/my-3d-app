import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AgentData, SimParams, MAP_CONFIG } from '../types'

type Props = {
  agent: AgentData
  allAgents: AgentData[]
  params: SimParams
  onEscape: (id: number) => void
}

export function Agent({ agent, allAgents, params, onEscape }: Props) {
  const meshRef = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (!meshRef.current || agent.escaped) return

    const dt = delta * params.simSpeed
    const pos = agent.currentPos

    // 1. ウェイポイント（経路通過点）の設定
    const waypoints = [
      new THREE.Vector3(28, 0, 0),                       // 廊下端
      new THREE.Vector3(34, -1.75, -1.5),                 // 階段踊り場
      new THREE.Vector3(28, -3.5, -4.5),                  // 階段降りきり
      MAP_CONFIG.exitPos                                  // 昇降口ゴール
    ]

    // ランダム逆走判定（途中でパニックになり教室へ逆走）
    if (!agent.isReverse && Math.random() < (params.reverseRate / 10000)) {
      agent.isReverse = true
    }

    let target = agent.isReverse ? agent.originClassroom : waypoints[agent.targetIndex]

    // ゴール到達判定
    if (!agent.isReverse && pos.distanceTo(target) < 1.2) {
      if (agent.targetIndex < waypoints.length - 1) {
        agent.targetIndex++
      } else {
        agent.escaped = true
        onEscape(agent.id)
        return
      }
    }

    // 2. 移動ベクトルの基本計算 (歩行速度 + 個人差)
    const desiredDir = new THREE.Vector3().subVectors(target, pos).normalize()
    const desiredVel = desiredDir.multiplyScalar(agent.baseSpeed)

    // 3. 社会的力モデル（Social Force Model: 反発・回避・立ち止まり・追い越し）
    const force = new THREE.Vector3()
    let nearbyCount = 0

    allAgents.forEach((other) => {
      if (other.id === agent.id || other.escaped) return
      const dist = pos.distanceTo(other.currentPos)

      // 物理的パーソナルスペース・肩幅干渉の判定
      const minDist = (agent.shoulderWidth + other.shoulderWidth) / 2 + params.minPersonalDist

      if (dist < minDist * 2.5) {
        nearbyCount++
        const pushDir = new THREE.Vector3().subVectors(pos, other.currentPos).normalize()
        
        // 衝突反発力
        if (dist < minDist) {
          force.addScaledVector(pushDir, (minDist - dist) * 15.0)
        } else {
          // 回避 & 立ち止まり & 横への避けて追い越し
          const sideDir = new THREE.Vector3(-pushDir.z, 0, pushDir.x)
          force.addScaledVector(sideDir, 2.5)
        }
      }
    })

    // 4. 密度判定とリアルタイムカラー表示（青: 快適 -> 黄: 混雑 -> 赤: 高密度/スタック）
    if (nearbyCount >= 5) {
      agent.densityState = 'dense'
      desiredVel.multiplyScalar(0.3) // 混雑立ち止まり・減速
    } else if (nearbyCount >= 2) {
      agent.densityState = 'moderate'
      desiredVel.multiplyScalar(0.7)
    } else {
      agent.densityState = 'clear'
    }

    // 物理力合算
    agent.velocity.lerp(desiredVel.add(force), 0.1)
    pos.addScaledVector(agent.velocity, dt)
    meshRef.current.position.copy(pos)
  })

  if (agent.escaped) return null

  // 密度リアルタイムカラー
  const getColor = () => {
    if (agent.isReverse) return '#7000ff' // 逆走者：紫
    if (agent.densityState === 'dense') return '#ff2a6d' // 高密度：赤
    if (agent.densityState === 'moderate') return '#ffb703' // 中密度：黄
    return '#00f3ff' // 快適：青
  }

  return (
    <group ref={meshRef} position={agent.currentPos.toArray()}>
      {/* 調整された肩幅・身長に基づくカプセル表現 */}
      <mesh position={[0, agent.height / 2, 0]}>
        <cylinderGeometry args={[agent.shoulderWidth / 2, agent.shoulderWidth / 2, agent.height, 16]} />
        <meshStandardMaterial color={getColor()} emissive={getColor()} emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
