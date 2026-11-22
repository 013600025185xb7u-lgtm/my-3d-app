import React from 'react'
import { SimParams } from '../../types'

type ControlPanelProps = {
  params: SimParams
  setParams: React.Dispatch<React.SetStateAction<SimParams>>
  isPaused: boolean
  setIsPaused: (paused: boolean) => void
  escapedCount: number
  reversingCount: number
  onReset: () => void
}

export function ControlPanel({
  params,
  setParams,
  isPaused,
  setIsPaused,
  escapedCount,
  reversingCount,
  onReset
}: ControlPanelProps) {
  const p = (params || {}) as Record<string, any>
  const studentCount = p?.studentCount ?? p?.totalStudents ?? 120
  const walkingSpeed = params?.walkingSpeed ?? 1.3
  const simSpeed = params?.simSpeed ?? 1.0
  const speedDiff = params?.cornerSpeedDiff ?? 0.25

  // 廊下コーナー・踊り場(180°)それぞれの速度倍率を計算
  const corridorInnerMult = Math.max(0.35, 1.0 - speedDiff).toFixed(2)
  const corridorOuterMult = Math.min(1.85, 1.0 + speedDiff).toFixed(2)
  const landingInnerMult = Math.max(0.35, 1.0 - speedDiff * 1.25).toFixed(2)
  const landingOuterMult = Math.min(1.95, 1.0 + speedDiff * 1.25).toFixed(2)
  const isCornerDiffActive = Boolean(params?.isOrdered && (params?.laneCount ?? 1) > 1)

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      zIndex: 10,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      padding: '20px',
      borderRadius: '12px',
      color: '#fff',
      width: '280px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        ⚙️ 避難シミュレーション設定
      </h3>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          生徒数: <strong>{studentCount}人</strong>
        </label>
        <input
          type="range"
          min="30"
          max="240"
          step="15"
          value={studentCount}
          onChange={e => {
            const val = Number(e.target.value)
            setParams(prev => ({ ...prev, studentCount: val, totalStudents: val }))
          }}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          歩行速度: <strong>{walkingSpeed.toFixed(1)} m/s</strong>
        </label>
        <input
          type="range"
          min="0.8"
          max="2.0"
          step="0.1"
          value={walkingSpeed}
          onChange={e => setParams(prev => ({ ...prev, walkingSpeed: Number(e.target.value) }))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          シミュレーション速度: <strong>{simSpeed.toFixed(1)}x</strong>
        </label>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.5"
          value={simSpeed}
          onChange={e => setParams(prev => ({ ...prev, simSpeed: Number(e.target.value) }))}
          style={{ width: '100%' }}
        />
      </div>

      {/* 🔄 コーナー・踊り場速度差スライダー */}
      <div style={{
        marginBottom: '15px',
        background: '#1e293b',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
          <span>🔄 コーナー速度差</span>
          <strong style={{ color: '#10b981' }}>
            内 {corridorInnerMult}x / 外 {corridorOuterMult}x
          </strong>
        </div>
        <input
          type="range"
          min="0.0"
          max="0.5"
          step="0.01"
          value={speedDiff}
          onChange={e => setParams(prev => ({ ...prev, cornerSpeedDiff: Number(e.target.value) }))}
          style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
          <span>{isCornerDiffActive ? '2・3列適用中' : '※2・3列時に有効'}</span>
          <span>踊り場: 内 {landingInnerMult}x / 外 {landingOuterMult}x</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
        <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>避難完了</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{escapedCount} 人</div>
        </div>
        <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>逆走中</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>{reversingCount} 人</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setIsPaused(!isPaused)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: isPaused ? '#10b981' : '#f59e0b',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {isPaused ? '▶ 再生' : '⏸ 一時停止'}
        </button>
        <button
          onClick={onReset}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: '#ef4444',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔄 リセット
        </button>
      </div>
    </div>
  )
}

export default ControlPanel