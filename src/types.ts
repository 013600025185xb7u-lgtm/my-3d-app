import * as THREE from 'three'

export interface SimParams {
  walkingSpeed: number
  panicRate: number
  speedVariance: number
  minPersonalDist: number
  simSpeed: number
  isOrdered: boolean
  laneCount: 1 | 2 | 3
  startLocation: 'classroom' | 'corridor'
  reverseRate: number
  isSeedLocked: boolean
  reverseSeed: number
  zoomLevel: number
  rotSensitivity: number
  corridorWidth: number
  forceBalance: number
  orderedGap: number
  cornerSpeedDiff?: number
  opposingSlowdownRate: number // 🛑 対向接触時の減速率（0〜95%: 接触・至近距離すれ違い時の最大速度低下率）
  resetKey: number
}

export interface AgentData {
  id: number
  originClassroom: { id: number; x: number; y: number; z: number }
  seatPos: THREE.Vector3
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  targetIndex: number
  baseSpeed: number
  shoulderWidth: number
  height: number
  escaped: boolean
  isReversing: boolean
  resetKeyRef?: number
  assignedLane: number
  queueOrder: number
}

export const MAP_CONFIG = {
  classrooms: [
    { id: 0, x: -21.0, y: 0, z: 0 },
    { id: 1, x: -12.6, y: 0, z: 0 },
    { id: 2, x: -4.2, y: 0, z: 0 },
    { id: 3, x: 4.2, y: 0, z: 0 },
    { id: 4, x: 12.6, y: 0, z: 0 },
    { id: 5, x: 21.0, y: 0, z: 0 }
  ]
}