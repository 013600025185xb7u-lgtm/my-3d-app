import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AgentData, SimParams } from '../../types'

export type AgentProps = {
  agent: AgentData
  allAgentsRef: React.MutableRefObject<AgentData[]>
  params: SimParams
  isPaused: boolean
  onEscape: (id: number) => void
  onReverseTrigger: () => void
}

const VEC_TARGET = new THREE.Vector3()
const VEC_RAW_DIR = new THREE.Vector3()
const VEC_OTHER = new THREE.Vector3()
const VEC_AVOID = new THREE.Vector3()
const VEC_SIDE = new THREE.Vector3()
const VEC_TRACK_RESTORE = new THREE.Vector3()

const MAX_SUB_STEP_DT = 0.025

export function Agent({
  agent,
  allAgentsRef,
  params,
  isPaused,
  onEscape
}: AgentProps) {
  const meshRef = useRef<THREE.Group>(null!)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!)
  const wasReversingRef = useRef<boolean>(false)
  const isInitializedRef = useRef<boolean>(false)
  const hasEscapedLocalRef = useRef<boolean>(false)
  const reverseStageRef = useRef<number>(0)
  const currentDirRef = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0))
  const currentSpeedMultRef = useRef<number>(1.0)
  const laneChangeCooldownRef = useRef<number>(0)

  useFrame((_, delta) => {
    if (!meshRef.current || agent.escaped || hasEscapedLocalRef.current) {
      if (meshRef.current && (agent.escaped || hasEscapedLocalRef.current)) {
        meshRef.current.visible = false
      }
      return
    }

    const cWidth = params.corridorWidth
    const roomDepth = 7.0
    const roomWidth = 8.0
    const roomZOffset = -(cWidth / 2 + roomDepth / 2)
    const doorZ = roomZOffset + roomDepth / 2

    const accessX = 26.5
    const accessX_left = accessX - 1.15
    const accessX_right = accessX + 1.15

    const stairWidth = 1.75
    const stairZ_near = cWidth / 2 + stairWidth / 2
    const stairZ_center = cWidth / 2 + stairWidth
    const stairZ_far = cWidth / 2 + stairWidth + stairWidth / 2
    const stairZ_end = cWidth / 2 + stairWidth * 2
    const wallHalf = 0.08
    const radius = agent.shoulderWidth / 2

    if (!isInitializedRef.current || params.resetKey !== agent.resetKeyRef) {
      agent.currentPos.copy(agent.seatPos)
      agent.targetIndex = params.startLocation === 'corridor' ? 3 : 0
      agent.isReversing = false
      agent.escaped = false
      wasReversingRef.current = false
      hasEscapedLocalRef.current = false
      reverseStageRef.current = 0
      currentSpeedMultRef.current = 1.0
      laneChangeCooldownRef.current = 0
      agent.resetKeyRef = params.resetKey
      isInitializedRef.current = true
      meshRef.current.visible = true
      meshRef.current.position.copy(agent.seatPos)
    }

    // 一時停止中は現在位置のまま静止（初期位置へワープさせない）
    if (isPaused) {
      meshRef.current.position.copy(agent.currentPos)
      return
    }

    const totalDt = Math.min(delta, 0.05) * params.simSpeed
    const subSteps = Math.max(1, Math.ceil(totalDt / MAX_SUB_STEP_DT))
    const dt = totalDt / subSteps

    const pos = agent.currentPos
    const agents = allAgentsRef.current
    const door1 = VEC_TARGET.set(agent.originClassroom.x - 2.5, 0, doorZ).clone()
    const door2 = VEC_TARGET.set(agent.originClassroom.x + 2.5, 0, doorZ).clone()
    const chosenDoorPos = agent.seatPos.distanceTo(door1) < agent.seatPos.distanceTo(door2) ? door1 : door2

    for (let step = 0; step < subSteps; step++) {
      if (agent.escaped || hasEscapedLocalRef.current) break

      if (laneChangeCooldownRef.current > 0) {
        laneChangeCooldownRef.current -= dt
      }

      if (agent.isReversing && !wasReversingRef.current) {
        wasReversingRef.current = true
        if (agent.targetIndex === 9) {
          reverseStageRef.current = 10
        } else if (agent.targetIndex === 7 || agent.targetIndex === 8) {
          reverseStageRef.current = 11
        } else if (agent.targetIndex === 6) {
          reverseStageRef.current = 12
        } else if (agent.targetIndex === 4 || agent.targetIndex === 5) {
          reverseStageRef.current = 13
        } else {
          reverseStageRef.current = 0
        }
      }

      const isStairZone = agent.isReversing
        ? (reverseStageRef.current >= 10 && reverseStageRef.current <= 12)
        : (agent.targetIndex >= 5 && agent.targetIndex <= 9)
      const yTolerance = isStairZone ? 2.2 : 0.6

      // 動的レーンバランシング
      const canEvaluateLaneChange =
        params.isOrdered &&
        params.laneCount > 1 &&
        !agent.isReversing &&
        laneChangeCooldownRef.current <= 0 &&
        (
          (agent.targetIndex === 3 && pos.x < accessX - 1.5) ||
          (agent.targetIndex === 6 && pos.x < accessX_left - 0.4 && pos.x > accessX_left - 4.0) ||
          (agent.targetIndex === 9 && pos.x > accessX - 4.4 && pos.x < accessX - 0.4)
        )

      if (canEvaluateLaneChange) {
        const lanes = params.laneCount
        const currentLane = agent.assignedLane
        const gapTarget = params.orderedGap ?? 0.8
        const forwardSignX = agent.targetIndex === 6 ? -1 : 1

        let curAheadDist = Infinity
        let hasCurrentLaneCompanion = false

        for (let i = 0; i < agents.length; i++) {
          const other = agents[i]
          if (other.id === agent.id || other.escaped || other.isReversing) continue
          if (other.assignedLane !== currentLane) continue
          if (Math.abs(other.currentPos.y - pos.y) >= yTolerance) continue

          const dx = (other.currentPos.x - pos.x) * forwardSignX
          if (dx > 0.05 && dx < curAheadDist) {
            curAheadDist = dx
          }
          if (Math.abs(dx) < 3.0) {
            hasCurrentLaneCompanion = true
          }
        }

        const candidateLanes: number[] = []
        if (currentLane > 0) candidateLanes.push(currentLane - 1)
        if (currentLane < lanes - 1) candidateLanes.push(currentLane + 1)

        let bestLane = -1
        let bestScore = 0
        const mergeSlotMargin = Math.max(0.65, gapTarget * 0.82)

        for (let c = 0; c < candidateLanes.length; c++) {
          const candLane = candidateLanes[c]
          let isSlotOpenAndSafe = true
          let candAheadDist = Infinity

          for (let i = 0; i < agents.length; i++) {
            const other = agents[i]
            if (other.id === agent.id || other.escaped) continue
            if (Math.abs(other.currentPos.y - pos.y) >= yTolerance) continue

            if (other.isReversing && pos.distanceTo(other.currentPos) < 2.2) {
              isSlotOpenAndSafe = false
              break
            }

            if (other.assignedLane === candLane) {
              const dx = (other.currentPos.x - pos.x) * forwardSignX
              const dist = pos.distanceTo(other.currentPos)

              if (Math.abs(dx) < mergeSlotMargin || dist < 0.78) {
                isSlotOpenAndSafe = false
                break
              }

              if (dx > 0 && dx < candAheadDist) {
                candAheadDist = dx
              }
            }
          }

          if (!isSlotOpenAndSafe) continue

          const isNeighborOpenForBalancing = candAheadDist > 2.2 && hasCurrentLaneCompanion
          const isCurrentBlockedAndNeighborWider =
            curAheadDist < gapTarget * 1.6 && candAheadDist > curAheadDist + 1.5

          if (isNeighborOpenForBalancing || isCurrentBlockedAndNeighborWider) {
            const score = Math.min(candAheadDist, 10.0)
            if (score > bestScore) {
              bestScore = score
              bestLane = candLane
            }
          }
        }

        if (bestLane !== -1) {
          agent.assignedLane = bestLane
          laneChangeCooldownRef.current = 2.2
        }
      }

      // コース線路定義
      let laneZ = 0
      let laneXOffset = 0
      let stair1ZOffset = 0
      let landingXOffset = 0
      let stair2ZOffset = 0

      const speedDiff = params.cornerSpeedDiff ?? 0.25
      let cornerSpeedTarget = 1.0
      let landingSpeedTarget = 1.0

      const lIndex = agent.assignedLane

      if (params.isOrdered) {
        if (params.laneCount === 1) {
          laneZ = 0
          laneXOffset = 0
          stair1ZOffset = 0
          landingXOffset = 0
          stair2ZOffset = 0
          cornerSpeedTarget = 1.0
          landingSpeedTarget = 1.0
        } else if (params.laneCount === 2) {
          const isInner = lIndex === 0
          laneZ = isInner ? 0.45 : -0.45
          laneXOffset = isInner ? -0.45 : 0.45
          stair1ZOffset = isInner ? -0.38 : 0.38
          landingXOffset = isInner ? 0.38 : -0.38
          stair2ZOffset = isInner ? 0.38 : -0.38

          cornerSpeedTarget = isInner ? (1.0 - speedDiff) : (1.0 + speedDiff)
          landingSpeedTarget = isInner
            ? (1.0 - speedDiff * 1.15)
            : (1.0 + speedDiff * 1.15)
        } else if (params.laneCount === 3) {
          const factor = 1 - lIndex
          laneZ = factor * 0.55
          laneXOffset = -factor * 0.50
          stair1ZOffset = -factor * 0.45
          landingXOffset = factor * 0.45
          stair2ZOffset = factor * 0.45

          cornerSpeedTarget = 1.0 - factor * speedDiff
          landingSpeedTarget = 1.0 - factor * (speedDiff * 1.15)
        }
      } else {
        const laneSeed = (agent.id % 100) / 100 - 0.5
        laneZ = laneSeed * (cWidth * 0.6)
        laneXOffset = laneSeed * 0.5
        stair1ZOffset = laneSeed * 0.5
        landingXOffset = laneSeed * 0.5
        stair2ZOffset = laneSeed * 0.5
      }

      cornerSpeedTarget = THREE.MathUtils.clamp(cornerSpeedTarget, 0.35, 1.85)
      landingSpeedTarget = THREE.MathUtils.clamp(landingSpeedTarget, 0.35, 1.95)

      const safeStair1Z = params.isOrdered
        ? stairZ_far + stair1ZOffset
        : Math.max(stairZ_center + wallHalf + radius + 0.2, stairZ_far + stair1ZOffset)

      const safeStair2Z = params.isOrdered
        ? stairZ_near + stair2ZOffset
        : stairZ_near + stair2ZOffset

      const safeLandingX = params.isOrdered
        ? accessX - 5.8 + landingXOffset
        : Math.min(accessX - 5.5, accessX - 5.8 + landingXOffset)

      const cornerApproachZ = safeStair1Z - 0.55
      const turnX = accessX + laneXOffset
      let target: THREE.Vector3

      if (agent.isReversing) {
        if (reverseStageRef.current === 10) {
          target = new THREE.Vector3(accessX - 5.8, -1.75, safeStair2Z)
          if (pos.x <= accessX - 5.2) {
            reverseStageRef.current = 11
          }
        } else if (reverseStageRef.current === 11) {
          target = new THREE.Vector3(accessX - 5.8, -1.75, safeStair1Z)
          if (pos.z >= safeStair1Z - 0.35) {
            reverseStageRef.current = 12
          }
        } else if (reverseStageRef.current === 12) {
          target = new THREE.Vector3(accessX_left + 0.3, 0, safeStair1Z)
          if (pos.x >= accessX_left - 0.1) {
            reverseStageRef.current = 13
          }
        } else if (reverseStageRef.current === 13) {
          target = new THREE.Vector3(accessX, 0, 0)
          if (pos.z <= cWidth / 2 - 0.3) {
            reverseStageRef.current = 0
          }
        } else if (reverseStageRef.current === 0) {
          target = new THREE.Vector3(chosenDoorPos.x, 0, 0)
          if (Math.abs(pos.x - chosenDoorPos.x) < 0.8 && Math.abs(pos.z) < 1.2) {
            reverseStageRef.current = 1
          }
        } else if (reverseStageRef.current === 1) {
          target = new THREE.Vector3(chosenDoorPos.x, 0, doorZ - 0.6)
          if (pos.z <= doorZ - 0.35) {
            reverseStageRef.current = 2
          }
        } else {
          target = agent.seatPos
        }
      } else {
        const doorOutside = chosenDoorPos.clone()
        doorOutside.z = laneZ

        const doorInside = chosenDoorPos.clone()
        doorInside.z = doorZ - 0.5

        const routeWaypoints = [
          doorInside,
          chosenDoorPos,
          doorOutside,
          new THREE.Vector3(turnX, 0, laneZ),
          new THREE.Vector3(turnX, 0, cornerApproachZ),
          new THREE.Vector3(accessX_left, 0, safeStair1Z),
          new THREE.Vector3(accessX_left - 4.95, -1.75, safeStair1Z),
          new THREE.Vector3(safeLandingX, -1.75, safeStair1Z),
          new THREE.Vector3(safeLandingX, -1.75, safeStair2Z),
          new THREE.Vector3(accessX, -3.55, safeStair2Z),
          new THREE.Vector3(accessX + 3.0, -3.55, safeStair2Z)
        ]

        if (pos.y <= -3.0 && pos.x >= accessX + 1.8) {
          hasEscapedLocalRef.current = true
          meshRef.current.visible = false
          onEscape(agent.id)
          return
        }

        if (agent.targetIndex === 0) {
          if (pos.z >= doorZ - 0.6 || pos.distanceTo(doorInside) < 0.7) agent.targetIndex = 1
        } else if (agent.targetIndex === 1) {
          if (pos.z >= doorZ - 0.1 || pos.distanceTo(chosenDoorPos) < 0.5) agent.targetIndex = 2
        } else if (agent.targetIndex === 2) {
          if (pos.z >= -0.3 || pos.distanceTo(doorOutside) < 0.6) agent.targetIndex = 3
        } else if (agent.targetIndex === 3) {
          if (pos.x >= turnX - 0.65) agent.targetIndex = 4
        } else if (agent.targetIndex === 4) {
          if (pos.z >= cornerApproachZ - 0.35) agent.targetIndex = 5
        } else if (agent.targetIndex === 5) {
          if (pos.x <= accessX_left + 0.2 || pos.z >= safeStair1Z - 0.25) agent.targetIndex = 6
        } else if (agent.targetIndex === 6) {
          if (pos.x <= accessX_left - 3.9) agent.targetIndex = 7
        } else if (agent.targetIndex === 7) {
          if (pos.x <= safeLandingX + 0.35) agent.targetIndex = 8
        } else if (agent.targetIndex === 8) {
          if (pos.z <= safeStair2Z + 0.45) agent.targetIndex = 9
        } else if (agent.targetIndex === 9) {
          if (pos.x >= accessX - 0.3) agent.targetIndex = 10
        }

        target = routeWaypoints[agent.targetIndex]
      }

      const targetXZ = VEC_TARGET.set(target.x, pos.y, target.z)
      VEC_RAW_DIR.subVectors(targetXZ, pos).normalize()

      VEC_TRACK_RESTORE.set(0, 0, 0)
      if (params.isOrdered && !agent.isReversing) {
        const restoreStrength = 3.2

        if (agent.targetIndex === 3) {
          const errZ = laneZ - pos.z
          VEC_TRACK_RESTORE.z = THREE.MathUtils.clamp(errZ * restoreStrength, -1.2, 1.2)
        } else if (agent.targetIndex === 4) {
          const errX = turnX - pos.x
          VEC_TRACK_RESTORE.x = THREE.MathUtils.clamp(errX * restoreStrength, -1.2, 1.2)
        } else if (agent.targetIndex === 6) {
          const errZ = safeStair1Z - pos.z
          VEC_TRACK_RESTORE.z = THREE.MathUtils.clamp(errZ * restoreStrength, -1.2, 1.2)
        } else if (agent.targetIndex === 8) {
          const errX = safeLandingX - pos.x
          VEC_TRACK_RESTORE.x = THREE.MathUtils.clamp(errX * restoreStrength, -1.2, 1.2)
        } else if (agent.targetIndex === 9 || agent.targetIndex === 10) {
          const errZ = safeStair2Z - pos.z
          VEC_TRACK_RESTORE.z = THREE.MathUtils.clamp(errZ * restoreStrength, -1.2, 1.2)
        }

        if (VEC_TRACK_RESTORE.lengthSq() > 0.0001) {
          VEC_RAW_DIR.addScaledVector(VEC_TRACK_RESTORE, 0.55).normalize()
        }
      }

      let currentSpeed = agent.baseSpeed * (params.walkingSpeed / 1.3)

      if (params.isOrdered && !agent.isReversing) {
        const isInCorridorCorner =
          (agent.targetIndex === 3 && pos.x >= accessX - 2.2) ||
          agent.targetIndex === 4 ||
          (agent.targetIndex === 5 && pos.x >= accessX_left - 0.2)

        const isInLandingCorner =
          (agent.targetIndex === 7 && pos.x <= accessX - 4.7) ||
          agent.targetIndex === 8 ||
          (agent.targetIndex === 9 && pos.x <= accessX - 4.75)

        let desiredMult = 1.0
        if (isInCorridorCorner) {
          desiredMult = cornerSpeedTarget
        } else if (isInLandingCorner) {
          desiredMult = landingSpeedTarget
        } else if (laneChangeCooldownRef.current > 1.6) {
          desiredMult = 1.06
        }

        currentSpeedMultRef.current = THREE.MathUtils.lerp(
          currentSpeedMultRef.current,
          desiredMult,
          Math.min(1.0, dt * 7.5)
        )
        currentSpeed *= currentSpeedMultRef.current

        const gapTarget = params.orderedGap ?? 0.8
        const isStair = agent.targetIndex >= 5 && agent.targetIndex <= 9

        if (agent.targetIndex < 2) {
          for (let i = 0; i < agents.length; i++) {
            const other = agents[i]
            if (other.id !== agent.id && !other.escaped && !other.isReversing) {
              if (other.originClassroom.id === agent.originClassroom.id && other.queueOrder === agent.queueOrder - 1) {
                const d = pos.distanceTo(other.currentPos)
                if (d < gapTarget) {
                  currentSpeed *= Math.max(0, (d - 0.4) / (gapTarget - 0.4))
                }
              }
            }
          }
        }

        let minAheadDist = Infinity
        for (let i = 0; i < agents.length; i++) {
          const other = agents[i]
          if (other.id !== agent.id && !other.escaped && !other.isReversing) {
            const sameLane = other.assignedLane === agent.assignedLane
            const yDiff = Math.abs(other.currentPos.y - pos.y)

            if (sameLane && yDiff < (isStair ? 2.2 : 0.6)) {
              VEC_OTHER.subVectors(other.currentPos, pos)
              const dist = VEC_OTHER.length()
              const dot = VEC_RAW_DIR.dot(VEC_OTHER.normalize())

              if (dot > 0.25 && dist < minAheadDist) {
                minAheadDist = dist
              }
            }
          }
        }

        if (minAheadDist < gapTarget) {
          currentSpeed *= Math.max(0.0, (minAheadDist - 0.45) / (gapTarget - 0.45))
        }
      } else if (!params.isOrdered) {
        currentSpeed *= 1.15
      }

      const turnLerpSpeed = params.isOrdered ? 7.5 : 8.0
      currentDirRef.current.lerp(VEC_RAW_DIR, Math.min(1.0, dt * turnLerpSpeed)).normalize()
      const desiredDir = currentDirRef.current.clone()

      if (!agent.isReversing) {
        if (agent.targetIndex === 6 && pos.x < accessX_left) {
          currentSpeed *= 0.8
        } else if (agent.targetIndex === 9) {
          currentSpeed *= 0.8
        }
      } else {
        if (reverseStageRef.current === 10 || reverseStageRef.current === 12) {
          currentSpeed *= 0.75
        }
      }

      // 物理衝突・回避制御 ＆ 対向接触・すれ違い減速ペナルティ
      VEC_AVOID.set(0, 0, 0)
      const forceBalance = params.forceBalance ?? 0
      const slowdownRatio = THREE.MathUtils.clamp((params.opposingSlowdownRate ?? 60) / 100, 0, 0.95)

      const interactionRadius = 1.05
      const contactDist = (agent.shoulderWidth + 0.5) / 2

      let maxOpposingProximity = 0
      let closeOpposingCount = 0

      for (let i = 0; i < agents.length; i++) {
        const other = agents[i]
        if (other.id === agent.id || other.escaped) continue

        if (Math.abs(other.currentPos.y - pos.y) < yTolerance) {
          const dx = other.currentPos.x - pos.x
          const dz = other.currentPos.z - pos.z
          const distSq = dx * dx + dz * dz

          if (distSq < 4.0 && distSq > 0.000001) {
            const dist = Math.sqrt(distSq)
            const isOpposing = agent.isReversing !== other.isReversing

            if (isOpposing) {
              const minDist = (agent.shoulderWidth + other.shoulderWidth) / 2 + 0.22
              if (dist < minDist) {
                VEC_OTHER.set(dx, 0, dz)
                VEC_SIDE.set(-desiredDir.z, 0, desiredDir.x)
                if (VEC_SIDE.dot(VEC_OTHER) > 0) VEC_SIDE.negate()
                const avoidMultiplier = agent.isReversing ? (1.0 + forceBalance) : (1.0 - forceBalance)
                VEC_AVOID.addScaledVector(VEC_SIDE, (minDist - dist) * 3.0 * Math.max(0.1, avoidMultiplier))
              }

              const forwardDot = (dx * desiredDir.x + dz * desiredDir.z) / dist
              if (dist < interactionRadius && forwardDot > -0.25) {
                const rawProx = THREE.MathUtils.clamp(
                  (interactionRadius - dist) / (interactionRadius - contactDist),
                  0,
                  1
                )
                const angleWeight = 0.65 + 0.35 * THREE.MathUtils.clamp(forwardDot, 0, 1)
                const prox = rawProx * angleWeight

                if (prox > maxOpposingProximity) {
                  maxOpposingProximity = prox
                }
                if (dist < 0.85) {
                  closeOpposingCount++
                }
              }
            } else if (!params.isOrdered && agent.targetIndex >= 2) {
              // 教室ドア出口での詰まりを防ぐため、廊下へ出た後（targetIndex >= 2）にパーソナルスペース回避を適用
              const personalMin = Math.max(0.55, params.minPersonalDist)
              if (dist < personalMin) {
                VEC_OTHER.set(dx, 0, dz)
                VEC_SIDE.set(-desiredDir.z, 0, desiredDir.x)
                if (VEC_SIDE.dot(VEC_OTHER) > 0) VEC_SIDE.negate()
                VEC_AVOID.addScaledVector(VEC_SIDE, (personalMin - dist) * 1.4)
              }
            }
          }
        }
      }

      if (slowdownRatio > 0 && maxOpposingProximity > 0) {
        const crowdBoost = 1.0 + Math.min(0.35, Math.max(0, closeOpposingCount - 1) * 0.12)
        const effectiveProximity = THREE.MathUtils.clamp(maxOpposingProximity * crowdBoost, 0, 1)

        const balanceFactor = agent.isReversing
          ? THREE.MathUtils.clamp(1.0 - forceBalance * 0.45, 0.35, 1.5)
          : THREE.MathUtils.clamp(1.0 + forceBalance * 0.45, 0.35, 1.5)

        const penalty = THREE.MathUtils.clamp(slowdownRatio * effectiveProximity * balanceFactor, 0, 0.96)
        currentSpeed *= (1.0 - penalty)
      }

      const desiredVel = desiredDir.multiplyScalar(currentSpeed).add(VEC_AVOID)
      agent.velocity.lerp(desiredVel, params.isOrdered ? 0.35 : 0.3)

      // 高度 Y座標制御
      let targetY = 0
      if (!agent.isReversing) {
        if (agent.targetIndex >= 10) {
          targetY = -3.55
        } else if (agent.targetIndex === 9) {
          const stair2Start = accessX - 4.95
          if (pos.x <= stair2Start) {
            targetY = -1.75
          } else if (pos.x <= accessX) {
            const alpha = (pos.x - stair2Start) / 4.95
            const smoothAlpha = alpha * alpha * (3 - 2 * alpha)
            targetY = -1.75 - 1.8 * THREE.MathUtils.clamp(smoothAlpha, 0, 1)
          } else {
            targetY = -3.55
          }
        } else if (agent.targetIndex === 7 || agent.targetIndex === 8) {
          targetY = -1.75
        } else if (agent.targetIndex === 6 || (agent.targetIndex === 5 && pos.x < accessX_left)) {
          const stair1Start = accessX_left
          if (pos.x >= stair1Start) {
            targetY = 0
          } else if (pos.x >= stair1Start - 4.95) {
            const alpha = (stair1Start - pos.x) / 4.95
            const smoothAlpha = alpha * alpha * (3 - 2 * alpha)
            targetY = -1.75 * THREE.MathUtils.clamp(smoothAlpha, 0, 1)
          } else {
            targetY = -1.75
          }
        } else {
          targetY = 0
        }
      } else {
        if (reverseStageRef.current === 10) {
          const stair2Start = accessX - 4.95
          if (pos.x <= stair2Start) {
            targetY = -1.75
          } else if (pos.x <= accessX) {
            const alpha = (pos.x - stair2Start) / 4.95
            const smoothAlpha = alpha * alpha * (3 - 2 * alpha)
            targetY = -1.75 - 1.8 * THREE.MathUtils.clamp(smoothAlpha, 0, 1)
          } else {
            targetY = -3.55
          }
        } else if (reverseStageRef.current === 11) {
          targetY = -1.75
        } else if (reverseStageRef.current === 12) {
          const stair1Start = accessX_left
          if (pos.x >= stair1Start) {
            targetY = 0
          } else if (pos.x >= stair1Start - 4.95) {
            const alpha = (stair1Start - pos.x) / 4.95
            const smoothAlpha = alpha * alpha * (3 - 2 * alpha)
            targetY = -1.75 * THREE.MathUtils.clamp(smoothAlpha, 0, 1)
          } else {
            targetY = -1.75
          }
        } else {
          targetY = 0
        }
      }

      pos.y = THREE.MathUtils.lerp(pos.y, targetY, Math.min(1.0, dt * 8))
      pos.addScaledVector(agent.velocity, dt)

      // アンチ・ウォブル（横揺れ防止）ハード物理
      for (let iter = 0; iter < 2; iter++) {
        for (let i = 0; i < agents.length; i++) {
          const other = agents[i]
          if (other.id === agent.id || other.escaped) continue

          if (Math.abs(other.currentPos.y - pos.y) < yTolerance) {
            const deltaX = pos.x - other.currentPos.x
            const deltaZ = pos.z - other.currentPos.z
            const distSq = deltaX * deltaX + deltaZ * deltaZ
            const minAllowed = radius + other.shoulderWidth / 2

            if (distSq < minAllowed * minAllowed && distSq > 0.00001) {
              const dist = Math.sqrt(distSq)
              const overlap = minAllowed - dist
              const isOpposing = agent.isReversing !== other.isReversing

              let pushFactor = isStairZone ? 0.2 : 0.3
              let forceMultiplier = 1.0

              if (isOpposing) {
                forceMultiplier = agent.isReversing ? (1.0 + forceBalance) : (1.0 - forceBalance)
                forceMultiplier = THREE.MathUtils.clamp(forceMultiplier, 0.05, 2.0)
              } else if (params.isOrdered) {
                pushFactor = 0.08
              }

              pos.x += (deltaX / dist) * overlap * pushFactor * forceMultiplier
              pos.z += (deltaZ / dist) * overlap * pushFactor * forceMultiplier
            }
          }
        }
      }

      // 壁貫通防止物理ガード
      const clsX = agent.originClassroom.x
      const roomLeft = clsX - roomWidth / 2 + radius
      const roomRight = clsX + roomWidth / 2 - radius

      const door1X = clsX - 2.5
      const door2X = clsX + 2.5
      const doorHalf = 0.45

      const isNearDoor1 = Math.abs(pos.x - door1X) < doorHalf - radius * 0.15
      const isNearDoor2 = Math.abs(pos.x - door2X) < doorHalf - radius * 0.15
      const inDoorPassage = isNearDoor1 || isNearDoor2

      if (!agent.isReversing) {
        if (agent.targetIndex >= 7 && agent.targetIndex <= 9) {
          const wallSouth = stairZ_near - stairWidth / 2 + radius
          const wallNorth = stairZ_end - radius
          pos.z = THREE.MathUtils.clamp(pos.z, wallSouth, wallNorth)
          pos.x = THREE.MathUtils.clamp(pos.x, accessX - 6.8 + radius, accessX + 3.5 - radius)

          if (pos.x >= accessX - 4.95 - radius && pos.x <= accessX_left + radius) {
            if (pos.z > stairZ_center) {
              pos.z = Math.max(stairZ_center + wallHalf + radius + 0.02, pos.z)
            } else {
              pos.z = Math.min(stairZ_center - wallHalf - radius - 0.02, pos.z)
            }
          }
        } else if (agent.targetIndex >= 10) {
          const wallSouth = stairZ_near - stairWidth / 2 + radius
          const wallNorth = stairZ_center - wallHalf - radius
          pos.z = THREE.MathUtils.clamp(pos.z, wallSouth, wallNorth)
          pos.x = THREE.MathUtils.clamp(pos.x, accessX - 1.0, accessX + 3.5)
        } else if (agent.targetIndex === 6) {
          const minZ = stairZ_center + wallHalf + radius + 0.02
          pos.z = THREE.MathUtils.clamp(pos.z, minZ, stairZ_end - radius)
          pos.x = THREE.MathUtils.clamp(pos.x, accessX - 5.2, accessX_right - radius)
        } else if (agent.targetIndex === 4 || agent.targetIndex === 5) {
          pos.x = THREE.MathUtils.clamp(pos.x, accessX_left - 0.5 + radius, accessX_right + 1.0 - radius)
          pos.z = THREE.MathUtils.clamp(pos.z, -cWidth / 2 + radius, stairZ_end - radius)
        } else {
          if (pos.z < doorZ - 0.1) {
            pos.z = Math.max(roomZOffset - roomDepth / 2 + radius, pos.z)
            pos.x = THREE.MathUtils.clamp(pos.x, roomLeft, roomRight)
            if (!inDoorPassage) {
              pos.z = Math.min(doorZ - radius, pos.z)
            }
          } else if (pos.z > doorZ + 0.1) {
            const minCorridorLeft = Math.min(-28.0 + radius, agent.seatPos.x - 0.5)
            pos.x = THREE.MathUtils.clamp(pos.x, minCorridorLeft, accessX_right + 1.0 - radius)
            if (pos.x < accessX_left - radius) {
              pos.z = Math.min(cWidth / 2 - radius, pos.z)
            } else {
              pos.z = Math.min(stairZ_end - radius, pos.z)
            }
            if (!inDoorPassage) {
              pos.z = Math.max(doorZ + radius, pos.z)
            }
          } else {
            if (!inDoorPassage) {
              pos.z = Math.max(doorZ + radius, pos.z)
            } else {
              const activeDoorX = isNearDoor1 ? door1X : door2X
              pos.x = THREE.MathUtils.clamp(pos.x, activeDoorX - doorHalf + radius, activeDoorX + doorHalf - radius)
            }
          }
        }
      } else {
        if (reverseStageRef.current === 10 || reverseStageRef.current === 11) {
          const wallSouth = stairZ_near - stairWidth / 2 + radius
          const wallNorth = stairZ_end - radius
          pos.z = THREE.MathUtils.clamp(pos.z, wallSouth, wallNorth)
          pos.x = THREE.MathUtils.clamp(pos.x, accessX - 6.8 + radius, accessX + 3.5 - radius)

          if (pos.x >= accessX - 4.95 - radius && pos.x <= accessX_left + radius) {
            if (pos.z > stairZ_center) {
              pos.z = Math.max(stairZ_center + wallHalf + radius + 0.02, pos.z)
            } else {
              pos.z = Math.min(stairZ_center - wallHalf - radius - 0.02, pos.z)
            }
          }
        } else if (reverseStageRef.current === 12) {
          const minZ = stairZ_center + wallHalf + radius + 0.02
          pos.z = THREE.MathUtils.clamp(pos.z, minZ, stairZ_end - radius)
          pos.x = THREE.MathUtils.clamp(pos.x, accessX - 5.2, accessX_right - radius)
        } else if (reverseStageRef.current === 13) {
          pos.x = THREE.MathUtils.clamp(pos.x, accessX_left - 0.5 + radius, accessX_right + 1.0 - radius)
          pos.z = THREE.MathUtils.clamp(pos.z, -cWidth / 2 + radius, stairZ_end - radius)
        } else {
          pos.x = THREE.MathUtils.clamp(pos.x, -28.0 + radius, accessX_right - radius)
          if (reverseStageRef.current === 2) {
            pos.z = Math.max(roomZOffset - roomDepth / 2 + radius, pos.z)
            pos.x = THREE.MathUtils.clamp(pos.x, roomLeft, roomRight)
            if (!inDoorPassage) {
              pos.z = Math.min(doorZ - radius, pos.z)
            }
          } else if (reverseStageRef.current === 1) {
            if (pos.z < doorZ - 0.1) {
              pos.z = Math.max(roomZOffset - roomDepth / 2 + radius, pos.z)
              pos.x = THREE.MathUtils.clamp(pos.x, roomLeft, roomRight)
            } else if (pos.z > doorZ + 0.1) {
              pos.z = Math.min(cWidth / 2 - radius, pos.z)
              if (!inDoorPassage) {
                pos.z = Math.max(doorZ + radius, pos.z)
              }
            } else if (inDoorPassage) {
              const activeDoorX = isNearDoor1 ? door1X : door2X
              pos.x = THREE.MathUtils.clamp(pos.x, activeDoorX - doorHalf + radius, activeDoorX + doorHalf - radius)
            }
          } else {
            pos.z = THREE.MathUtils.clamp(pos.z, -cWidth / 2 + radius, cWidth / 2 - radius)
          }
        }
      }
    }

    if (materialRef.current) {
      const targetColor = agent.isReversing
        ? '#ff007f'
        : params.isOrdered
        ? '#00ff88'
        : '#00f3ff'

      materialRef.current.color.set(targetColor)
      materialRef.current.emissive.set(targetColor)
      materialRef.current.emissiveIntensity = agent.isReversing ? 1.5 : 0.5
    }

    meshRef.current.position.copy(pos)
  })

  if (agent.escaped) return null

  return (
    <group ref={meshRef} position={agent.currentPos.toArray()}>
      <mesh position={[0, agent.height / 2, 0]}>
        <cylinderGeometry args={[agent.shoulderWidth / 2, agent.shoulderWidth / 2, agent.height, 16]} />
        <meshStandardMaterial ref={materialRef} />
      </mesh>

      {agent.isReversing && (
        <group position={[0, agent.height + 0.6, 0]}>
          <Text fontSize={0.7} color="#ff007f" anchorX="center" anchorY="middle">
            ⚠️ 逆走
          </Text>
        </group>
      )}
    </group>
  )
}