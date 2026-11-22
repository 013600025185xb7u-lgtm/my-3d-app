import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BuildingMap } from './components/map/BuildingMap'
import { AgentManager } from './components/agents/AgentManager'
import {
  BenchmarkDrawer,
  BenchmarkVersionId,
  BenchmarkResultsMap,
  BENCHMARK_VERSIONS
} from './components/BenchmarkDrawer'
import { SimParams } from './types'

interface LapRecord {
  count: number
  time: number
  diff: number
}

interface BenchmarkTask {
  versionId: BenchmarkVersionId
  label: string
  isOrdered: boolean
  laneCount: 1 | 2 | 3
  rate: number
  peopleCount: number
}

const createEmptyResultsMap = (): BenchmarkResultsMap => ({
  unordered: [],
  ordered1: [],
  ordered2: [],
  ordered3: []
})

// ⏱ シミュレーション速度（simSpeed）と完全同期するクロック
function SimulationClock({
  isPaused,
  isCompleted,
  simSpeed,
  simTimeRef,
  resetKey,
  onTimeUpdate
}: {
  isPaused: boolean
  isCompleted: boolean
  simSpeed: number
  simTimeRef: React.MutableRefObject<number>
  resetKey: number
  onTimeUpdate: (time: number) => void
}) {
  const lastUiSyncRef = useRef(0)

  useEffect(() => {
    lastUiSyncRef.current = 0
  }, [resetKey])

  useFrame((_, delta) => {
    if (isPaused || isCompleted) return

    if (simTimeRef.current < lastUiSyncRef.current) {
      lastUiSyncRef.current = simTimeRef.current
    }

    const dt = Math.min(delta, 0.05) * simSpeed
    simTimeRef.current += dt

    if (simTimeRef.current - lastUiSyncRef.current >= 0.05) {
      lastUiSyncRef.current = simTimeRef.current
      onTimeUpdate(simTimeRef.current)
    }
  })

  return null
}

function DroneControls({
  isPaused,
  sensitivity,
  zoomLevel,
  resetCamTrigger
}: {
  isPaused: boolean
  sensitivity: number
  zoomLevel: number
  resetCamTrigger: number
}) {
  const { camera, gl } = useThree()

  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false
  })

  const isMouseDown = useRef(false)
  const mousePos = useRef({ x: 0, y: 0 })
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useEffect(() => {
    if ('zoom' in camera) {
      ;(camera as THREE.PerspectiveCamera).zoom = zoomLevel
      camera.updateProjectionMatrix()
    }
  }, [zoomLevel, camera])

  useEffect(() => {
    if (resetCamTrigger > 0) {
      camera.position.set(0, 10, 40)
      euler.current.set(0, 0, 0, 'YXZ')
      camera.quaternion.setFromEuler(euler.current)
    }
  }, [resetCamTrigger, camera])

  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }

      switch (e.code) {
        case 'KeyW':
          keys.current.forward = true
          break
        case 'KeyS':
          keys.current.backward = true
          break
        case 'KeyA':
          keys.current.left = true
          break
        case 'KeyD':
          keys.current.right = true
          break
        case 'ArrowUp':
          keys.current.lookUp = true
          break
        case 'ArrowDown':
          keys.current.lookDown = true
          break
        case 'ArrowLeft':
          keys.current.lookLeft = true
          break
        case 'ArrowRight':
          keys.current.lookRight = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          keys.current.forward = false
          break
        case 'KeyS':
          keys.current.backward = false
          break
        case 'KeyA':
          keys.current.left = false
          break
        case 'KeyD':
          keys.current.right = false
          break
        case 'ArrowUp':
          keys.current.lookUp = false
          break
        case 'ArrowDown':
          keys.current.lookDown = false
          break
        case 'ArrowLeft':
          keys.current.lookLeft = false
          break
        case 'ArrowRight':
          keys.current.lookRight = false
          break
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = true
        mousePos.current = { x: e.clientX, y: e.clientY }
      }
    }

    const handleMouseUp = () => {
      isMouseDown.current = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return

      const movementX = e.clientX - mousePos.current.x
      const movementY = e.clientY - mousePos.current.y
      mousePos.current = { x: e.clientX, y: e.clientY }

      euler.current.y -= movementX * 0.003
      euler.current.x -= movementY * 0.003
      euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const domElement = gl.domElement
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    domElement.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      domElement.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    if (isPaused) return

    const rotSpeed = 1.8 * sensitivity * delta
    const moveSpeed = 18 * delta

    if (keys.current.lookUp) euler.current.x += rotSpeed
    if (keys.current.lookDown) euler.current.x -= rotSpeed
    if (keys.current.lookLeft) euler.current.y += rotSpeed
    if (keys.current.lookRight) euler.current.y -= rotSpeed

    euler.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.current.x))
    camera.quaternion.setFromEuler(euler.current)

    const moveVector = new THREE.Vector3()

    if (keys.current.forward) moveVector.z -= 1
    if (keys.current.backward) moveVector.z += 1
    if (keys.current.left) moveVector.x -= 1
    if (keys.current.right) moveVector.x += 1

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize()
      moveVector.applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(moveVector, moveSpeed)
    }
  })

  return null
}

export default function App() {
  const [isPaused, setIsPaused] = useState(true)
  const [escapedCount, setEscapedCount] = useState(0)
  const [reversingCount, setReversingCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [lapTimes, setLapTimes] = useState<LapRecord[]>([])
  const [copiedLap, setCopiedLap] = useState(false)
  const [resetCamTrigger, setResetCamTrigger] = useState(0)
  const simTimeRef = useRef<number>(0)
  const resetSeqRef = useRef<number>(1)

  const [params, setParams] = useState<SimParams>({
    walkingSpeed: 1.3,
    panicRate: 5,
    speedVariance: 20,
    minPersonalDist: 0.5,
    simSpeed: 1.0,
    isOrdered: false,
    laneCount: 1,
    startLocation: 'classroom',
    reverseRate: 10,
    isSeedLocked: false,
    reverseSeed: 1,
    zoomLevel: 1.0,
    rotSensitivity: 1.0,
    corridorWidth: 2.3,
    forceBalance: 0.0,
    orderedGap: 0.8,
    cornerSpeedDiff: 0.25,
    opposingSlowdownRate: 60,
    resetKey: 1
  })

  // =========================================================
  // 📊 オプション機能：逆走耐久性・自動連続計測ステート
  // =========================================================
  const [isGraphDrawerOpen, setIsGraphDrawerOpen] = useState(false)
  const [selectedVersions, setSelectedVersions] = useState<BenchmarkVersionId[]>([
    'unordered',
    'ordered1',
    'ordered2'
  ])
  const [stepSize, setStepSize] = useState<1 | 5>(5)
  const [activeGraphTab, setActiveGraphTab] = useState<'random' | 'seeded'>('random')
  const [randomResults, setRandomResults] = useState<BenchmarkResultsMap>(createEmptyResultsMap)
  const [seededResults, setSeededResults] = useState<BenchmarkResultsMap>(createEmptyResultsMap)
  const [seededRecordSeed, setSeededRecordSeed] = useState<number | null>(null)

  const [benchmarkState, setBenchmarkState] = useState<{
    status: 'idle' | 'running' | 'completed'
    mode: 'random' | 'seeded'
    queue: BenchmarkTask[]
    currentIndex: number
  }>({
    status: 'idle',
    mode: 'random',
    queue: [],
    currentIndex: 0
  })
  const recordedStepRef = useRef<number>(-1)

  useEffect(() => {
    setActiveGraphTab(params.isSeedLocked ? 'seeded' : 'random')
  }, [params.isSeedLocked])

  const resetSimulationState = useCallback(() => {
    simTimeRef.current = 0
    setElapsedTime(0)
    setEscapedCount(0)
    setReversingCount(0)
    setLapTimes([])
    setCopiedLap(false)
    setIsPaused(true)
  }, [])

  // ラップタイム自動記録
  useEffect(() => {
    if (escapedCount === 0) return
    const currentMilestone = Math.floor(escapedCount / 10) * 10
    if (currentMilestone <= 0) return

    const exactSimTime = simTimeRef.current
    if (escapedCount >= 240) {
      setElapsedTime(exactSimTime)
    }

    setLapTimes((prev) => {
      const lastCount = prev.length > 0 ? prev[prev.length - 1].count : 0
      if (currentMilestone <= lastCount) return prev

      const next = [...prev]
      for (let m = lastCount + 10; m <= currentMilestone; m += 10) {
        const prevTime = next.length > 0 ? next[next.length - 1].time : 0
        next.push({
          count: m,
          time: exactSimTime,
          diff: Math.max(0, exactSimTime - prevTime)
        })
      }
      return next
    })
  }, [escapedCount])

  // 次のベンチマークステップへ進める共通関数
  const advanceBenchmarkStep = useCallback(
    (recordedTime: number) => {
      if (benchmarkState.status !== 'running') return
      if (recordedStepRef.current === benchmarkState.currentIndex) return

      const task = benchmarkState.queue[benchmarkState.currentIndex]
      if (!task) return

      recordedStepRef.current = benchmarkState.currentIndex

      const setter = benchmarkState.mode === 'seeded' ? setSeededResults : setRandomResults
      setter((prev) => ({
        ...prev,
        [task.versionId]: [
          ...prev[task.versionId],
          {
            rate: task.rate,
            peopleCount: task.peopleCount,
            time: recordedTime
          }
        ]
      }))

      const nextIndex = benchmarkState.currentIndex + 1
      if (nextIndex < benchmarkState.queue.length) {
        const nextTask = benchmarkState.queue[nextIndex]
        simTimeRef.current = 0
        setElapsedTime(0)
        setEscapedCount(0)
        setReversingCount(0)
        setLapTimes([])

        resetSeqRef.current += 1
        const nextKey = Date.now() + resetSeqRef.current

        setParams((prev) => ({
          ...prev,
          isOrdered: nextTask.isOrdered,
          laneCount: nextTask.laneCount,
          reverseRate: nextTask.rate,
          resetKey: nextKey
        }))

        setBenchmarkState((prev) => ({
          ...prev,
          currentIndex: nextIndex
        }))
        setIsPaused(false)
      } else {
        setIsPaused(true)
        setBenchmarkState((prev) => ({
          ...prev,
          status: 'completed'
        }))
      }
    },
    [benchmarkState]
  )

  // 🤖 100人到達時の自動ステップ進行（最低1.0s以上の正常計測のみ対象にし誤検知を完全防止）
  useEffect(() => {
    if (benchmarkState.status !== 'running') return
    if (escapedCount < 100) return
    if (simTimeRef.current < 1.0) return

    advanceBenchmarkStep(Number(simTimeRef.current.toFixed(2)))
  }, [escapedCount, benchmarkState.status, advanceBenchmarkStep])

  // 🛡️ フェイルセーフ安全弁（万が一300秒を超えても100人に達しない場合も停止せず次へ進む）
  useEffect(() => {
    if (benchmarkState.status !== 'running') return
    if (elapsedTime < 300) return

    advanceBenchmarkStep(Number(elapsedTime.toFixed(2)))
  }, [elapsedTime, benchmarkState.status, advanceBenchmarkStep])

  const handleToggleBenchmarkVersion = (id: BenchmarkVersionId) => {
    setSelectedVersions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleStartBenchmark = () => {
    if (selectedVersions.length === 0) return

    const rates: number[] = []
    for (let r = 0; r <= 30; r += stepSize) {
      rates.push(r)
    }

    const orderedSelected = BENCHMARK_VERSIONS.filter((v) => selectedVersions.includes(v.id))
    const queue: BenchmarkTask[] = []

    orderedSelected.forEach((v) => {
      rates.forEach((rate) => {
        queue.push({
          versionId: v.id,
          label: v.shortLabel,
          isOrdered: v.isOrdered,
          laneCount: v.laneCount,
          rate,
          peopleCount: Math.round((240 * rate) / 100)
        })
      })
    })

    if (queue.length === 0) return

    const mode: 'random' | 'seeded' = params.isSeedLocked ? 'seeded' : 'random'
    setActiveGraphTab(mode)

    if (mode === 'seeded') {
      setSeededResults(createEmptyResultsMap())
      setSeededRecordSeed(params.reverseSeed)
    } else {
      setRandomResults(createEmptyResultsMap())
    }

    recordedStepRef.current = -1
    const firstTask = queue[0]

    simTimeRef.current = 0
    setElapsedTime(0)
    setEscapedCount(0)
    setReversingCount(0)
    setLapTimes([])
    setCopiedLap(false)

    resetSeqRef.current += 1
    const firstKey = Date.now() + resetSeqRef.current

    setParams((prev) => ({
      ...prev,
      isOrdered: firstTask.isOrdered,
      laneCount: firstTask.laneCount,
      reverseRate: firstTask.rate,
      resetKey: firstKey
    }))

    setBenchmarkState({
      status: 'running',
      mode,
      queue,
      currentIndex: 0
    })

    setIsGraphDrawerOpen(true)
    setIsPaused(false)
  }

  const handleStopBenchmark = () => {
    setIsPaused(true)
    setBenchmarkState((prev) => ({
      ...prev,
      status: 'idle'
    }))
  }

  const handleClearBenchmarkResults = () => {
    if (activeGraphTab === 'seeded') {
      setSeededResults(createEmptyResultsMap())
      setSeededRecordSeed(null)
    } else {
      setRandomResults(createEmptyResultsMap())
    }
    setBenchmarkState((prev) => ({
      ...prev,
      status: 'idle'
    }))
  }

  const handleEscapedCountChange = useCallback((count: number) => {
    setEscapedCount(count)
  }, [])

  const handleReversingCountChange = useCallback((count: number) => {
    setReversingCount(count)
  }, [])

  const handleTimeUpdate = useCallback((time: number) => {
    setElapsedTime(time)
  }, [])

  const handleReset = () => {
    if (benchmarkState.status === 'running') {
      setBenchmarkState((prev) => ({ ...prev, status: 'idle' }))
    }
    resetSimulationState()
    resetSeqRef.current += 1
    setParams((prev) => ({ ...prev, resetKey: Date.now() + resetSeqRef.current }))
  }

  const handleChangeStartLocation = (loc: 'classroom' | 'corridor') => {
    if (benchmarkState.status === 'running') {
      setBenchmarkState((prev) => ({ ...prev, status: 'idle' }))
    }
    resetSimulationState()
    resetSeqRef.current += 1
    setParams((prev) => ({ ...prev, startLocation: loc, resetKey: Date.now() + resetSeqRef.current }))
  }

  const toggleSeedLock = () => {
    if (benchmarkState.status === 'running') {
      setBenchmarkState((prev) => ({ ...prev, status: 'idle' }))
    }
    resetSimulationState()
    resetSeqRef.current += 1
    setParams((prev) => ({
      ...prev,
      isSeedLocked: !prev.isSeedLocked,
      resetKey: Date.now() + resetSeqRef.current
    }))
  }

  const handleNextSeed = () => {
    if (benchmarkState.status === 'running') {
      setBenchmarkState((prev) => ({ ...prev, status: 'idle' }))
    }
    resetSimulationState()
    resetSeqRef.current += 1
    setParams((prev) => ({
      ...prev,
      isSeedLocked: true,
      reverseSeed: prev.reverseSeed + 1,
      resetKey: Date.now() + resetSeqRef.current
    }))
  }

  const handleCopyLaps = () => {
    if (lapTimes.length === 0) return
    const text = lapTimes
      .map((lap) => `${lap.count}人: ${lap.time.toFixed(1)}s (+${lap.diff.toFixed(1)}s)`)
      .join('\n')
    navigator.clipboard?.writeText(text)
    setCopiedLap(true)
    setTimeout(() => setCopiedLap(false), 1500)
  }

  const toggleOrderedMode = () => {
    setParams((prev) => ({ ...prev, isOrdered: !prev.isOrdered }))
  }

  const getForceLabel = (val: number) => {
    if (val === 0) return '0.0 (均等)'
    if (val > 0) return `+${val.toFixed(1)} (正常強)`
    return `${val.toFixed(1)} (逆走強)`
  }

  const speedDiff = params.cornerSpeedDiff ?? 0.25
  const corridorInnerMult = Math.max(0.35, 1.0 - speedDiff).toFixed(2)
  const corridorOuterMult = Math.min(1.85, 1.0 + speedDiff).toFixed(2)
  const landingInnerMult = Math.max(0.35, 1.0 - speedDiff * 1.25).toFixed(2)
  const landingOuterMult = Math.min(1.95, 1.0 + speedDiff * 1.25).toFixed(2)
  const isCornerDiffActive = params.isOrdered && params.laneCount > 1
  const approxReversingCount = Math.round((240 * params.reverseRate) / 100)

  const currentBenchTask =
    benchmarkState.status === 'running' ? benchmarkState.queue[benchmarkState.currentIndex] : null
  const benchmarkProgress = currentBenchTask
    ? {
        current: benchmarkState.currentIndex + 1,
        total: benchmarkState.queue.length,
        currentLabel: currentBenchTask.label,
        currentStepLabel:
          benchmarkState.mode === 'seeded'
            ? `逆走 ${currentBenchTask.peopleCount}人 (${currentBenchTask.rate}%)`
            : `逆走率 ${currentBenchTask.rate}%`
      }
    : null

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#090d16',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* UI コントロールパネル */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          minWidth: '310px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#00f3ff' }}>避難シミュレーション</h3>

        {/* 🔘 メイン操作ボタン */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: isPaused ? '#10b981' : '#f59e0b',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isPaused ? '0 0 12px rgba(16,185,129,0.4)' : 'none'
            }}
          >
            {isPaused ? '▶ 再開（スタート）' : '⏸ 一時停止'}
          </button>
          <button
            onClick={handleReset}
            style={{
              width: '80px',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#ff2a6d',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            リセット
          </button>
        </div>

        {/* ステータス（時間・避難完了・逆走者） */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>経過時間</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00f3ff' }}>
              {elapsedTime.toFixed(1)}s
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>避難完了</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00ff88' }}>
              {escapedCount} 人
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>🚨 逆走者</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff007f' }}>
              {reversingCount} 人
            </div>
          </div>
        </div>

        {/* ⏱ ラップタイム表示パネル（10人ごと） */}
        <div
          style={{
            marginBottom: '15px',
            background: 'rgba(255,255,255,0.03)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>
              ⏱ ラップタイム（10人ごと）
            </span>
            {lapTimes.length > 0 && (
              <button
                onClick={handleCopyLaps}
                style={{
                  padding: '2px 7px',
                  fontSize: '10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 243, 255, 0.3)',
                  background: copiedLap ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 243, 255, 0.1)',
                  color: copiedLap ? '#00ff88' : '#00f3ff',
                  cursor: 'pointer'
                }}
              >
                {copiedLap ? '✓ コピー済' : '📋 コピー'}
              </button>
            )}
          </div>

          {lapTimes.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '6px 0' }}>
              10人ゴールするごとに自動で記録されます
            </div>
          ) : (
            <div
              style={{
                maxHeight: '110px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                paddingRight: '2px'
              }}
            >
              {[...lapTimes].reverse().map((lap) => (
                <div
                  key={lap.count}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: lap.count === 240 ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255,255,255,0.04)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    border: lap.count === 240 ? '1px solid rgba(0, 255, 136, 0.3)' : 'none'
                  }}
                >
                  <span style={{ color: lap.count === 240 ? '#00ff88' : '#cbd5e1', fontWeight: 'bold' }}>
                    {lap.count}人 {lap.count === 240 ? '(完了)' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                      (+{lap.diff.toFixed(1)}s)
                    </span>
                    <span style={{ color: '#00f3ff', fontWeight: 'bold', minWidth: '44px', textAlign: 'right' }}>
                      {lap.time.toFixed(1)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 🟢 避難モード ＆ スタート位置 ＆ 列数切替パネル */}
        <div style={{ marginBottom: '15px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={toggleOrderedMode}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '6px',
              border: 'none',
              background: params.isOrdered ? '#10b981' : '#3b82f6',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            避難モード: {params.isOrdered ? '🟢 秩序避難' : '🔴 通常避難（混雑）'}
          </button>

          {/* スタート位置選択ボタン（教室スタート / 廊下スタンバイ） */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>開始位置（初期配置）:</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleChangeStartLocation('classroom')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: params.startLocation === 'classroom' ? '2px solid #00f3ff' : '1px solid rgba(255,255,255,0.1)',
                  background: params.startLocation === 'classroom' ? 'rgba(0, 243, 255, 0.18)' : 'rgba(255,255,255,0.05)',
                  color: params.startLocation === 'classroom' ? '#00f3ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                🚪 教室スタート
              </button>
              <button
                onClick={() => handleChangeStartLocation('corridor')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: params.startLocation === 'corridor' ? '2px solid #00f3ff' : '1px solid rgba(255,255,255,0.1)',
                  background: params.startLocation === 'corridor' ? 'rgba(0, 243, 255, 0.18)' : 'rgba(255,255,255,0.05)',
                  color: params.startLocation === 'corridor' ? '#00f3ff' : '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                🚶 廊下スタンバイ
              </button>
            </div>
          </div>

          {/* 列数選択ボタン（秩序避難時のみ活性化） */}
          <div style={{ opacity: params.isOrdered ? 1 : 0.4, pointerEvents: params.isOrdered ? 'auto' : 'none' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>整列の列数を選択:</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([1, 2, 3] as const).map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setParams((prev) => ({ ...prev, laneCount: cnt }))}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: params.laneCount === cnt ? '2px solid #00ff88' : '1px solid rgba(255,255,255,0.1)',
                    background: params.laneCount === cnt ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255,255,255,0.05)',
                    color: params.laneCount === cnt ? '#00ff88' : '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {cnt}列
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 📏 整列避難の前後距離スライダー */}
        <div style={{ marginBottom: '12px', background: 'rgba(16,185,129,0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>📏 整列避難の前後距離</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{params.orderedGap.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="2.0"
            step="0.1"
            value={params.orderedGap}
            onChange={(e) => setParams({ ...params, orderedGap: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>

        {/* 🔄 コーナー・踊り場速度差スライダー（2列・3列の秩序避難時） */}
        <div
          style={{
            marginBottom: '12px',
            background: 'rgba(16,185,129,0.08)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(16,185,129,0.2)',
            opacity: isCornerDiffActive ? 1 : 0.4,
            pointerEvents: isCornerDiffActive ? 'auto' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>🔄 コーナー・踊り場速度差</span>
            <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
              内 {corridorInnerMult}x / 外 {corridorOuterMult}x
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.5"
            step="0.01"
            value={speedDiff}
            onChange={(e) => setParams({ ...params, cornerSpeedDiff: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
            <span>{params.laneCount === 3 ? '中: 1.00x' : '0.00 (均一)'}</span>
            <span>
              踊り場(180°): 内 {landingInnerMult}x / 外 {landingOuterMult}x
            </span>
          </div>
        </div>

        {/* 💪 押し合いの力関係（正常 vs 逆走）スライダー */}
        <div style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#eab308', fontWeight: 'bold' }}>💪 押し合いの力関係</span>
            <span style={{ color: '#eab308', fontWeight: 'bold' }}>{getForceLabel(params.forceBalance)}</span>
          </div>
          <input
            type="range"
            min="-1.0"
            max="1.0"
            step="0.1"
            value={params.forceBalance}
            onChange={(e) => setParams({ ...params, forceBalance: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#eab308', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
            <span>◀ 逆走強 (-1.0)</span>
            <span>均等 (0.0)</span>
            <span>正常強 (+1.0) ▶</span>
          </div>
        </div>

        {/* 🛑 対向接触時の減速率（すれ違い抵抗）スライダー */}
        <div style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#fb7185', fontWeight: 'bold' }}>🛑 対向接触時の減速率（すれ違い抵抗）</span>
            <span style={{ color: '#fb7185', fontWeight: 'bold' }}>最大 {params.opposingSlowdownRate}% 減速</span>
          </div>
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            value={params.opposingSlowdownRate}
            onChange={(e) => setParams({ ...params, opposingSlowdownRate: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#fb7185', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
            <span>0% (減速なし・すり抜け)</span>
            <span>50% (接触で半減)</span>
            <span>95% (接触でほぼ停止)</span>
          </div>
        </div>

        {/* ⚡ シミュレーション速度スライダー（1.0x 〜 15.0x） */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>⚡ シミュレーション速度</span>
            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{params.simSpeed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="15.0"
            step="0.5"
            value={params.simSpeed}
            onChange={(e) => setParams({ ...params, simSpeed: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
          />
        </div>

        {/* 🏃 人の歩く速さスライダー */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>🏃 人の歩く速さ</span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{params.walkingSpeed.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={params.walkingSpeed}
            onChange={(e) => setParams({ ...params, walkingSpeed: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>

        {/* ↔️ 人と人の最低距離スライダー */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>↔️ 人と人の最低距離（通常避難用）</span>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{params.minPersonalDist.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.5"
            step="0.1"
            value={params.minPersonalDist}
            onChange={(e) => setParams({ ...params, minPersonalDist: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </div>

        {/* 📏 廊下幅調整スライダー */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>📏 廊下の幅</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{params.corridorWidth.toFixed(1)} m</span>
          </div>
          <input
            type="range"
            min="1.5"
            max="5.0"
            step="0.1"
            value={params.corridorWidth}
            onChange={(e) => setParams({ ...params, corridorWidth: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
          />
        </div>

        {/* 🚨 逆走発生率スライダー（廊下・階段全域 ＋ パターンBシードロック） */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#ff007f', fontWeight: 'bold' }}>🚨 逆走発生率（廊下・階段全域）</span>
            <span style={{ color: '#ff007f', fontWeight: 'bold' }}>
              {params.reverseRate}% (約{approxReversingCount}人)
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={params.reverseRate}
            onChange={(e) => setParams({ ...params, reverseRate: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#ff007f', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '2px', marginBottom: '6px' }}>
            <span>0% (なし)</span>
            <span>15% (約36人)</span>
            <span>30% (上限・約72人)</span>
          </div>

          {/* 🔒 発生場所・タイミング基準シードロック操作バー */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={toggleSeedLock}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: params.isSeedLocked ? '1px solid #ff007f' : '1px solid rgba(255,255,255,0.15)',
                background: params.isSeedLocked ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255,255,255,0.05)',
                color: params.isSeedLocked ? '#ff66b2' : '#cbd5e1',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              {params.isSeedLocked ? `🔒 パターン固定 (#${params.reverseSeed})` : '🔓 ランダム発生'}
            </button>
            <button
              onClick={handleNextSeed}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                background: 'rgba(0, 243, 255, 0.1)',
                color: '#00f3ff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              🎲 次のパターン
            </button>
          </div>
        </div>

        {/* 🔍 ズーム調整 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#00f3ff', fontWeight: 'bold' }}>🔍 画面の広さ（ズーム）</span>
            <span style={{ color: '#00f3ff', fontWeight: 'bold' }}>
              {params.zoomLevel < 1.0 ? '遠目' : params.zoomLevel > 1.0 ? '近目' : '標準'} ({params.zoomLevel.toFixed(1)}x)
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={params.zoomLevel}
            onChange={(e) => setParams({ ...params, zoomLevel: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#00f3ff', cursor: 'pointer' }}
          />
        </div>

        {/* 🎯 旋回感度調整 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#ffb703', fontWeight: 'bold' }}>🎯 矢印キー旋回感度</span>
            <span style={{ color: '#ffb703', fontWeight: 'bold' }}>{params.rotSensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={params.rotSensitivity}
            onChange={(e) => setParams({ ...params, rotSensitivity: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#ffb703', cursor: 'pointer' }}
          />
        </div>

        {/* 視点リセットボタン */}
        <button
          onClick={() => setResetCamTrigger((prev) => prev + 1)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          🎥 視点位置を初期状態に戻す
        </button>
      </div>

      {/* 📊 オプション機能：下部開閉式・自動連続計測グラフパネル（高さ40vh・左パネル非干渉） */}
      <BenchmarkDrawer
        isOpen={isGraphDrawerOpen}
        onToggleOpen={() => setIsGraphDrawerOpen((prev) => !prev)}
        params={params}
        benchmarkStatus={benchmarkState.status}
        benchmarkProgress={benchmarkProgress}
        selectedVersions={selectedVersions}
        onToggleVersion={handleToggleBenchmarkVersion}
        stepSize={stepSize}
        onChangeStepSize={setStepSize}
        activeGraphTab={activeGraphTab}
        onChangeGraphTab={setActiveGraphTab}
        randomResults={randomResults}
        seededResults={seededResults}
        seededRecordSeed={seededRecordSeed}
        onStartBenchmark={handleStartBenchmark}
        onStopBenchmark={handleStopBenchmark}
        onClearResults={handleClearBenchmarkResults}
      />

      {/* 3D キャンバス */}
      <Canvas camera={{ position: [0, 10, 40], fov: 50 }}>
        <ambientLight intensity={1.5} />
        <hemisphereLight args={['#ffffff', '#1e293b', 1.0]} />
        <directionalLight position={[20, 40, 20]} intensity={1.5} />

        <SimulationClock
          isPaused={isPaused}
          isCompleted={escapedCount >= 240}
          simSpeed={params.simSpeed}
          simTimeRef={simTimeRef}
          resetKey={params.resetKey}
          onTimeUpdate={handleTimeUpdate}
        />

        <BuildingMap params={params} />

        <AgentManager
          key={params.resetKey}
          params={params}
          isPaused={isPaused}
          simTimeRef={simTimeRef}
          onEscapedCountChange={handleEscapedCountChange}
          onReversingCountChange={handleReversingCountChange}
        />

        <DroneControls
          isPaused={false}
          sensitivity={params.rotSensitivity}
          zoomLevel={params.zoomLevel}
          resetCamTrigger={resetCamTrigger}
        />
      </Canvas>
    </div>
  )
}