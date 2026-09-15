import React from 'react'
import { SimParams } from '../types'

type Props = {
  params: SimParams
  setParams: React.Dispatch<React.SetStateAction<SimParams>>
  time: number
  escapedCount: number
  totalCount: number
  isPaused: boolean
  onTogglePause: () => void
  onReset: () => void
}

export function ControlPanel({
  params,
  setParams,
  time,
  escapedCount,
  totalCount,
  isPaused,
  onTogglePause,
  onReset
}: Props) {
  const handleChange = (key: keyof SimParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, zIndex: 10, width: '340px',
      maxHeight: '92vh', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px', padding: '16px', color: '#fff', fontSize: '12px'
    }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', color: '#00f3ff' }}>HELIOS ABM CONTROLLER</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
          <div>経過時間</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{time.toFixed(1)}s</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
          <div>避難完了</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00ff66' }}>{escapedCount} / {totalCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label>人数 (1クラス40人×6=240人標準): {params.agentCount}人
          <input type="range" min="40" max="400" step="20" value={params.agentCount} onChange={(e) => handleChange('agentCount', Number(e.target.value))} />
        </label>

        <label>平均身長: {params.avgHeight} m
          <input type="range" min="1.4" max="1.9" step="0.05" value={params.avgHeight} onChange={(e) => handleChange('avgHeight', Number(e.target.value))} />
        </label>

        <label>平均肩幅: {params.avgShoulderWidth} m
          <input type="range" min="0.3" max="0.6" step="0.02" value={params.avgShoulderWidth} onChange={(e) => handleChange('avgShoulderWidth', Number(e.target.value))} />
        </label>

        <label>歩行速度: {params.avgSpeed} m/s
          <input type="range" min="0.5" max="2.5" step="0.1" value={params.avgSpeed} onChange={(e) => handleChange('avgSpeed', Number(e.target.value))} />
        </label>

        <label>速度の個人差ランダム性: {params.speedRandomness} %
          <input type="range" min="0" max="50" step="5" value={params.speedRandomness} onChange={(e) => handleChange('speedRandomness', Number(e.target.value))} />
        </label>

        <label>最低対人距離: {params.minPersonalDist} m
          <input type="range" min="0.2" max="1.2" step="0.1" value={params.minPersonalDist} onChange={(e) => handleChange('minPersonalDist', Number(e.target.value))} />
        </label>

        <label>無秩序・パニック逆走率: {params.reverseRate} %
          <input type="range" min="0" max="20" step="1" value={params.reverseRate} onChange={(e) => handleChange('reverseRate', Number(e.target.value))} />
        </label>

        <label>再生スピード: {params.simSpeed}x
          <input type="range" min="0.2" max="3.0" step="0.2" value={params.simSpeed} onChange={(e) => handleChange('simSpeed', Number(e.target.value))} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={onTogglePause} style={{ flex: 1, padding: '10px', background: '#00f3ff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          {isPaused ? '再開' : '一時停止'}
        </button>
        <button onClick={onReset} style={{ flex: 1, padding: '10px', background: '#ff2a6d', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          リセット
        </button>
      </div>
    </div>
  )
}
