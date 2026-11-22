import { useState, useEffect, useRef, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Agent } from './Agent'
import { AgentData, SimParams, MAP_CONFIG } from '../../types'

type AgentManagerProps = {
  params: SimParams
  isPaused: boolean
  simTimeRef: React.MutableRefObject<number>
  onEscapedCountChange: (count: number) => void
  onReversingCountChange: (count: number) => void
}

interface ReverseEvent {
  id: number
  triggerTime: number
  zone: 'corridor' | 'stair1' | 'landing' | 'stair2'
  targetX: number
  targetZ: number
  triggered: boolean
}

// シード値から常に同じ乱数列を生成する決定論的PRNG (Mulberry32)
function createSeededRandom(seed: number): () => number {
  let a = (seed >>> 0) || 1
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// パターンB：発生場所と発生タイミングをシードから生成
function generateReverseEvents(
  seed: number,
  corridorWidth: number,
  startLocation: 'classroom' | 'corridor',
  maxEvents: number = 72
): ReverseEvent[] {
  const rng = createSeededRandom(seed * 9973 + 131)
  const accessX = 26.5
  const accessX_left = accessX - 1.15
  const stairWidth = 1.75
  const stairZ_near = corridorWidth / 2 + stairWidth / 2
  const stairZ_far = corridorWidth / 2 + stairWidth + stairWidth / 2
  const halfZ = Math.max(0.25, corridorWidth / 2 - 0.3)

  const timeOffset = startLocation === 'classroom' ? 2.5 : 0.0
  const events: ReverseEvent[] = []

  for (let i = 0; i < maxEvents; i++) {
    const zoneRoll = rng()
    const timeRoll = rng()
    const posRoll1 = rng()
    const posRoll2 = rng()

    let zone: 'corridor' | 'stair1' | 'landing' | 'stair2'
    let triggerTime = 0
    let targetX = 0
    let targetZ = 0

    if (zoneRoll < 0.65) {
      zone = 'corridor'
      triggerTime = timeOffset + 1.8 + timeRoll * 30.0
      targetX = -22.0 + posRoll1 * 47.5
      targetZ = (posRoll2 * 2 - 1) * halfZ
    } else if (zoneRoll < 0.80) {
      zone = 'stair1'
      triggerTime = timeOffset + 5.5 + timeRoll * 28.0
      targetX = accessX_left - 0.6 - posRoll1 * 3.6
      targetZ = stairZ_far
    } else if (zoneRoll < 0.90) {
      zone = 'landing'
      triggerTime = timeOffset + 8.5 + timeRoll * 28.0
      targetX = accessX - 5.8
      targetZ = stairZ_near + 0.3 + posRoll1 * Math.max(0.2, stairZ_far - stairZ_near - 0.6)
    } else {
      zone = 'stair2'
      triggerTime = timeOffset + 11.5 + timeRoll * 28.0
      targetX = accessX - 4.2 + posRoll1 * 3.4
      targetZ = stairZ_near
    }

    events.push({
      id: i,
      triggerTime,
      zone,
      targetX,
      targetZ,
      triggered: false
    })
  }

  return events
}

function getNearestClassroom(x: number) {
  let nearest = MAP_CONFIG.classrooms[0]
  let minDist = Math.abs(x - nearest.x)
  for (let i = 1; i < MAP_CONFIG.classrooms.length; i++) {
    const d = Math.abs(x - MAP_CONFIG.classrooms[i].x)
    if (d < minDist) {
      minDist = d
      nearest = MAP_CONFIG.classrooms[i]
    }
  }
  return nearest
}

function createInitialAgents(params: SimParams, effectiveSeed: number): AgentData[] {
  const agents: AgentData[] = []
  let globalId = 0

  const totalAgents = 240
  const roomDepth = 7.0
  const roomZOffset = -(params.corridorWidth / 2 + roomDepth / 2)
  const layoutRng = createSeededRandom(effectiveSeed * 3571 + 29)

  if (params.startLocation === 'corridor') {
    if (params.isOrdered) {
      const lanes = params.laneCount
      const gap = params.orderedGap ?? 0.8
      const startX = 23.5

      for (let i = 0; i < totalAgents; i++) {
        const id = globalId++
        const laneIndex = i % lanes
        const rowIndex = Math.floor(i / lanes)

        let laneZ = 0
        if (lanes === 1) {
          laneZ = 0
        } else if (lanes === 2) {
          laneZ = laneIndex === 0 ? 0.45 : -0.45
        } else if (lanes === 3) {
          laneZ = (1 - laneIndex) * 0.55
        }

        const posX = startX - rowIndex * gap
        const posZ = laneZ

        const initialPos = new THREE.Vector3(posX, 0, posZ)
        const originCls = getNearestClassroom(posX)

        agents.push({
          id,
          originClassroom: { ...originCls },
          seatPos: initialPos.clone(),
          currentPos: initialPos.clone(),
          velocity: new THREE.Vector3(0, 0, 0),
          targetIndex: 3,
          baseSpeed: 1.3,
          shoulderWidth: 0.5,
          height: 1.7,
          escaped: false,
          isReversing: false,
          assignedLane: laneIndex,
          queueOrder: i
        })
      }
    } else {
      const minX = -26.8
      const maxX = 24.8
      const halfZ = Math.max(0.25, params.corridorWidth / 2 - 0.3)
      const placedPositions: THREE.Vector3[] = []

      for (let i = 0; i < totalAgents; i++) {
        const id = globalId++
        let chosenPos = new THREE.Vector3(0, 0, 0)

        for (let attempt = 0; attempt < 35; attempt++) {
          const rx = minX + layoutRng() * (maxX - minX)
          const rz = (layoutRng() * 2 - 1) * halfZ
          const cand = new THREE.Vector3(rx, 0, rz)

          let tooClose = false
          for (let j = 0; j < placedPositions.length; j++) {
            if (cand.distanceToSquared(placedPositions[j]) < 0.46 * 0.46) {
              tooClose = true
              break
            }
          }

          chosenPos = cand
          if (!tooClose) break
        }

        placedPositions.push(chosenPos)
        const originCls = getNearestClassroom(chosenPos.x)

        agents.push({
          id,
          originClassroom: { ...originCls },
          seatPos: chosenPos.clone(),
          currentPos: chosenPos.clone(),
          velocity: new THREE.Vector3(0, 0, 0),
          targetIndex: 3,
          baseSpeed: 1.3,
          shoulderWidth: 0.5,
          height: 1.7,
          escaped: false,
          isReversing: false,
          assignedLane: 0,
          queueOrder: i
        })
      }
    }
  } else {
    const lanes = params.isOrdered ? params.laneCount : 1

    MAP_CONFIG.classrooms.forEach((cls) => {
      const classroomAgents: { id: number; seatPos: THREE.Vector3; distToDoor: number }[] = []
      const doorZ = roomZOffset + roomDepth / 2
      const doorPos = new THREE.Vector3(cls.x + 2.5, 0, doorZ)

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 5; col++) {
          const id = globalId++
          const seatX = cls.x - 2.8 + col * 1.2
          const seatZ = roomZOffset - 2.5 + row * 0.7
          const seatPos = new THREE.Vector3(seatX, 0, seatZ)
          const distToDoor = seatPos.distanceTo(doorPos)
          classroomAgents.push({ id, seatPos, distToDoor })
        }
      }

      classroomAgents.sort((a, b) => a.distToDoor - b.distToDoor)

      classroomAgents.forEach((item, qIdx) => {
        const assignedLane = params.isOrdered ? (qIdx % lanes) : 0

        agents.push({
          id: item.id,
          originClassroom: { ...cls },
          seatPos: item.seatPos.clone(),
          currentPos: item.seatPos.clone(),
          velocity: new THREE.Vector3(0, 0, 0),
          targetIndex: 0,
          baseSpeed: 1.3,
          shoulderWidth: 0.5,
          height: 1.7,
          escaped: false,
          isReversing: false,
          assignedLane,
          queueOrder: qIdx
        })
      })
    })
  }

  return agents
}

function ReverseEventScheduler({
  allAgentsRef,
  eventsRef,
  params,
  isPaused,
  simTimeRef,
  onReverseTrigger
}: {
  allAgentsRef: React.MutableRefObject<AgentData[]>
  eventsRef: React.MutableRefObject<ReverseEvent[]>
  params: SimParams
  isPaused: boolean
  simTimeRef: React.MutableRefObject<number>
  onReverseTrigger: () => void
}) {
  useFrame(() => {
    if (isPaused) return

    const currentTime = simTimeRef.current
    const targetCount = Math.round((240 * params.reverseRate) / 100)
    if (targetCount <= 0) return

    const events = eventsRef.current
    const activeLimit = Math.min(targetCount, events.length)
    const agents = allAgentsRef.current
    let triggeredAny = false

    for (let eIdx = 0; eIdx < activeLimit; eIdx++) {
      const ev = events[eIdx]
      if (ev.triggered || currentTime < ev.triggerTime) continue

      const candidates: AgentData[] = []
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]
        if (!a.escaped && !a.isReversing && a.targetIndex >= 3 && a.targetIndex <= 9) {
          candidates.push(a)
        }
      }

      if (candidates.length === 0) continue

      const zoneMatched = candidates.filter((a) => {
        if (ev.zone === 'corridor') return a.targetIndex === 3 || a.targetIndex === 4
        if (ev.zone === 'stair1') return a.targetIndex === 5 || a.targetIndex === 6
        if (ev.zone === 'landing') return a.targetIndex === 7 || a.targetIndex === 8
        return a.targetIndex === 9
      })

      const pool = zoneMatched.length > 0 ? zoneMatched : candidates

      let bestAgent = pool[0]
      let bestDistSq = Infinity

      for (let i = 0; i < pool.length; i++) {
        const a = pool[i]
        const dx = a.currentPos.x - ev.targetX
        const dz = a.currentPos.z - ev.targetZ
        const dSq = dx * dx + dz * dz
        if (dSq < bestDistSq) {
          bestDistSq = dSq
          bestAgent = a
        }
      }

      if (bestAgent) {
        bestAgent.isReversing = true
        ev.triggered = true
        triggeredAny = true
      }
    }

    if (triggeredAny) {
      onReverseTrigger()
    }
  })

  return null
}

export function AgentManager({
  params,
  isPaused,
  simTimeRef,
  onEscapedCountChange,
  onReversingCountChange
}: AgentManagerProps) {
  const initialSeedRef = useRef<number>(
    params.isSeedLocked ? params.reverseSeed : Math.floor(Math.random() * 100000) + 1
  )

  const [agents, setAgents] = useState<AgentData[]>(() =>
    createInitialAgents(params, initialSeedRef.current)
  )
  const allAgentsRef = useRef<AgentData[]>(agents)
  allAgentsRef.current = agents

  const eventsRef = useRef<ReverseEvent[]>(
    generateReverseEvents(initialSeedRef.current, params.corridorWidth, params.startLocation)
  )

  // 重複排除済みの避難完了IDセット（同期カウントで漏れ・重複を完全防止）
  const escapedIdsRef = useRef<Set<number>>(new Set())
  const isFirstMountRef = useRef<boolean>(true)

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      return
    }

    const seedToUse = params.isSeedLocked
      ? params.reverseSeed
      : Math.floor(Math.random() * 100000) + 1

    escapedIdsRef.current.clear()
    const newAgents = createInitialAgents(params, seedToUse)
    setAgents(newAgents)
    allAgentsRef.current = newAgents
    eventsRef.current = generateReverseEvents(seedToUse, params.corridorWidth, params.startLocation)
    onEscapedCountChange(0)
    onReversingCountChange(0)
  }, [
    params.resetKey,
    params.isOrdered,
    params.laneCount,
    params.startLocation,
    params.corridorWidth,
    params.isSeedLocked,
    params.reverseSeed,
    onEscapedCountChange,
    onReversingCountChange
  ])

  const handleEscape = useCallback(
    (id: number) => {
      if (escapedIdsRef.current.has(id)) return
      escapedIdsRef.current.add(id)

      const target = allAgentsRef.current.find((a) => a.id === id)
      if (target) {
        target.escaped = true
      }

      const exactCount = escapedIdsRef.current.size
      onEscapedCountChange(exactCount)

      const activeReversing = allAgentsRef.current.filter((a) => a.isReversing && !a.escaped).length
      onReversingCountChange(activeReversing)
    },
    [onEscapedCountChange, onReversingCountChange]
  )

  const handleReverseTrigger = useCallback(() => {
    const reversingCount = allAgentsRef.current.filter((a) => a.isReversing && !a.escaped).length
    onReversingCountChange(reversingCount)
  }, [onReversingCountChange])

  return (
    <group>
      <ReverseEventScheduler
        allAgentsRef={allAgentsRef}
        eventsRef={eventsRef}
        params={params}
        isPaused={isPaused}
        simTimeRef={simTimeRef}
        onReverseTrigger={handleReverseTrigger}
      />
      {agents.map((agent) => (
        <Agent
          key={`${params.resetKey}-${agent.id}`}
          agent={agent}
          allAgentsRef={allAgentsRef}
          params={params}
          isPaused={isPaused}
          onEscape={handleEscape}
          onReverseTrigger={handleReverseTrigger}
        />
      ))}
    </group>
  )
}