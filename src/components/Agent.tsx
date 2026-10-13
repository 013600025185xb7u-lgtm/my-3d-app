import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AgentData, SimParams, MAP_CONFIG } from '../types'

type Props = {
  agent: AgentData
  allAgentsRef: React.MutableRefObject<AgentData[]>
  params: SimParams
  onEscape: (id: number) => void
}

export function Agent({ agent, allAgentsRef, params, onEscape }: Props) {
  const meshRef = useRef<THREE.Group>(null!)
  const colorRef = useRef<string>('#00f3ff')

  useFrame((_, delta) => {
    if (!meshRef.current || agent.escaped) return

    const dt = Math.min(delta, 0.1) * params.simSpeed
    const pos = agent.currentPos

    const waypoints = [
      new THREE.Vector3(26, 0, 0),
      new THREE.Vector3(30, -1.75, -1.5),
      new THREE.Vector3(26, -3.5, -4.5),
      MAP_CONFIG.exitPos
    ]

    if (!agent.isReverse && Math.random() < (params.reverseRate / 10000)) {
      agent.isReverse = true
    }

    const target = agent.isReverse ? agent.originClassroom : waypoints[agent.targetIndex]

    if (!agent.isReverse && pos.distanceTo(target) < 1.2) {
      if (agent.targetIndex < waypoints.length - 1) {
        agent.targetIndex++
      } else {
        agent.escaped = true
        onEscape(agent.id)
        return
      }
    }

    const desiredDir = new THREE.Vector3().subVectors(target, pos).normalize()
    const desiredVel = desiredDir.clone().multiplyScalar(agent.baseSpeed)

    const force = new THREE.Vector3()
    let nearbyCount = 0

    const agents = allAgentsRef.current
    for (let i = 0; i < agents.length; i++) {
      const other = agents[i]
      if (other.id === agent.id || other.escaped) continue

      const dist = pos.distanceTo(other.currentPos)
      const minDist = (agent.shoulderWidth + other.shoulderWidth) / 2 + params.minPersonalDist

      if (dist < minDist * 2.5) {
        nearbyCount++
        const pushDir = new THREE.Vector3().subVectors(pos, other.currentPos).normalize()
        if (dist < minDist) {
          force.addScaledVector(pushDir, (minDist - dist) * 12.0)
        } else {
          const sideDir = new THREE.Vector3(-pushDir.z, 0, pushDir.x)
          force.addScaledVector(sideDir, 2.0)
        }
      }
    }

    let speedFactor = 1.0
    if (nearbyCount >= 5) {
      speedFactor = 0.3
      colorRef.current = '#ff2a6d'
    } else if (nearbyCount >= 2) {
      speedFactor = 0.7
      colorRef.current = '#ffb703'
    } else {
      colorRef.current = agent.isReverse ? '#7000ff' : '#00f3ff'
    }

    desiredVel.multiplyScalar(speedFactor)
    agent.velocity.lerp(desiredVel.add(force), 0.1)
    pos.addScaledVector(agent.velocity, dt)

    meshRef.current.position.copy(pos)
  })

  if (agent.escaped) return null

  return (
    <group ref={meshRef} position={agent.currentPos.toArray()}>
      <mesh position={[0, agent.height / 2, 0]}>
        <cylinderGeometry args={[agent.shoulderWidth / 2, agent.shoulderWidth / 2, agent.height, 16]} />
        <meshStandardMaterial color={colorRef.current} emissive={colorRef.current} emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
