import React, { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SimParams, DEFAULT_PARAMS, AgentData } from './types'
import { Map } from './components/Map'
import { Agent } from './components/Agent'
import { ControlPanel } from './components/ControlPanel'

export default function App() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS)
  const [time, setTime] = useState(0)
  const [escapedCount, setEscapedCount] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [agents, setAgents] = useState<AgentData[]>([])
  
  const allAgentsRef = useRef<AgentData[]>([])

  const initAgents = () => {
    const newAgents: AgentData[] = []
    const perClass = Math.floor(params.agentCount / 6)

    for (let c = 0; c < 6; c++) {
      const classroomPos = new THREE.Vector3(-25 + c * 10, 0, -4.5)
      for (let i = 0; i < perClass; i++) {
        const randSpeedFactor = 1 + (Math.random() - 0.5) * (params.speedRandomness / 100) * 2
        newAgents.push({
          id: c * perClass + i,
          height: params.avgHeight + (Math.random() - 0.5) * 0.1,
          shoulderWidth: params.avgShoulderWidth + (Math.random() - 0.5) * 0.05,
          baseSpeed: Math.max(0.2, params.avgSpeed * randSpeedFactor),
          currentPos: new THREE.Vector3(
            classroomPos.x + (Math.random() - 0.5) * 6,
            0,
            classroomPos.z + (Math.random() - 0.5) * 3
          ),
          velocity: new THREE.Vector3(),
          targetIndex: 0,
          isReverse: false,
          originClassroom: classroomPos.clone(),
          escaped: false,
          densityState: 'clear'
        })
      }
    }
    allAgentsRef.current = newAgents
    setAgents(newAgents)
    setEscapedCount(0)
    setTime(0)
  }

  useEffect(() => {
    initAgents()
  }, [params.agentCount])

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      setTime((t) => t + 0.1 * params.simSpeed)
    }, 100)
    return () => clearInterval(interval)
  }, [isPaused, params.simSpeed])

  const handleEscape = () => {
    setEscapedCount((prev) => prev + 1)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#090a0f', position: 'relative' }}>
      <ControlPanel
        params={params}
        setParams={setParams}
        time={time}
        escapedCount={escapedCount}
        totalCount={agents.length}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        onReset={initAgents}
      />

      <Canvas camera={{ position: [0, 30, 40], fov: 45 }}>
        <color attach="background" args={['#090a0f']} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 40, 20]} intensity={1.5} />

        <Map />

        {agents.map((agent) => (
          <Agent
            key={agent.id}
            agent={agent}
            allAgentsRef={allAgentsRef}
            params={params}
            onEscape={handleEscape}
          />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
