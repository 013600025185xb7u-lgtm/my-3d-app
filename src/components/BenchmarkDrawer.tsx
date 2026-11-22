import { useState, useEffect, useRef } from 'react'
import { SimParams } from '../types'

export type BenchmarkVersionId = 'unordered' | 'ordered1' | 'ordered2' | 'ordered3'

export interface BenchmarkDataPoint {
  rate: number
  peopleCount: number
  time: number
}

export type BenchmarkResultsMap = Record<BenchmarkVersionId, BenchmarkDataPoint[]>

export interface BenchmarkVersionConfig {
  id: BenchmarkVersionId
  label: string
  shortLabel: string
  color: string
  isOrdered: boolean
  laneCount: 1 | 2 | 3
}

export const BENCHMARK_VERSIONS: BenchmarkVersionConfig[] = [
  {
    id: 'unordered',
    label: '🔴 通常避難（混雑）',
    shortLabel: '通常(混雑)',
    color: '#38bdf8',
    isOrdered: false,
    laneCount: 1
  },
  {
    id: 'ordered1',
    label: '🟢 秩序避難（1列）',
    shortLabel: '秩序 1列',
    color: '#00ff88',
    isOrdered: true,
    laneCount: 1
  },
  {
    id: 'ordered2',
    label: '🟢 秩序避難（2列）',
    shortLabel: '秩序 2列',
    color: '#a855f7',
    isOrdered: true,
    laneCount: 2
  },
  {
    id: 'ordered3',
    label: '🟢 秩序避難（3列）',
    shortLabel: '秩序 3列',
    color: '#f59e0b',
    isOrdered: true,
    laneCount: 3
  }
]

type BenchmarkDrawerProps = {
  isOpen: boolean
  onToggleOpen: () => void
  params: SimParams
  benchmarkStatus: 'idle' | 'running' | 'completed'
  benchmarkProgress: {
    current: number
    total: number
    currentLabel: string
    currentStepLabel: string
  } | null
  selectedVersions: BenchmarkVersionId[]
  onToggleVersion: (id: BenchmarkVersionId) => void
  stepSize: 1 | 5
  onChangeStepSize: (step: 1 | 5) => void
  activeGraphTab: 'random' | 'seeded'
  onChangeGraphTab: (tab: 'random' | 'seeded') => void
  randomResults: BenchmarkResultsMap
  seededResults: BenchmarkResultsMap
  seededRecordSeed: number | null
  onStartBenchmark: () => void
  onStopBenchmark: () => void
  onClearResults: () => void
}

export function BenchmarkDrawer({
  isOpen,
  onToggleOpen,
  params,
  benchmarkStatus,
  benchmarkProgress,
  selectedVersions,
  onToggleVersion,
  stepSize,
  onChangeStepSize,
  activeGraphTab,
  onChangeGraphTab,
  randomResults,
  seededResults,
  seededRecordSeed,
  onStartBenchmark,
  onStopBenchmark,
  onClearResults
}: BenchmarkDrawerProps) {
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState({ width: 640, height: 180 })
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [copiedCsv, setCopiedCsv] = useState(false)

  useEffect(() => {
    if (!isOpen || !chartBoxRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 50 && height > 40) {
          setChartSize({ width, height })
        }
      }
    })
    observer.observe(chartBoxRef.current)
    return () => observer.disconnect()
  }, [isOpen])

  const currentDataMap = activeGraphTab === 'random' ? randomResults : seededResults
  const isSeededMode = activeGraphTab === 'seeded'

  // 全系列の全データポイント収集
  const allPoints: BenchmarkDataPoint[] = []
  BENCHMARK_VERSIONS.forEach((v) => {
    currentDataMap[v.id].forEach((pt) => allPoints.push(pt))
  })

  const hasAnyData = allPoints.length > 0

  // X軸・Y軸レンジ計算
  const maxXVal = isSeededMode ? 72 : 30
  const rawMaxY = allPoints.reduce((acc, p) => Math.max(acc, p.time), 0)
  const maxYVal = rawMaxY > 0 ? Math.ceil((rawMaxY * 1.12) / 5) * 5 : 60

  const padLeft = 52
  const padRight = 24
  const padTop = 16
  const padBottom = 34
  const plotW = Math.max(100, chartSize.width - padLeft - padRight)
  const plotH = Math.max(60, chartSize.height - padTop - padBottom)

  const getX = (pt: BenchmarkDataPoint) => {
    const val = isSeededMode ? pt.peopleCount : pt.rate
    return padLeft + (val / maxXVal) * plotW
  }

  const getY = (time: number) => {
    return padTop + plotH - (time / maxYVal) * plotH
  }

  // X軸目盛り
  const xTicks = isSeededMode
    ? [0, 12, 24, 36, 48, 60, 72]
    : [0, 5, 10, 15, 20, 25, 30]

  // Y軸目盛り（5分割）
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxYVal / 4) * i)

  // ホバー位置に最も近いX値（rate または peopleCount）を特定
  const uniqueXValues = Array.from(
    new Set(allPoints.map((p) => (isSeededMode ? p.peopleCount : p.rate)))
  ).sort((a, b) => a - b)

  const handleMouseMoveSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (uniqueXValues.length === 0) {
      setHoverX(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const ratio = (mouseX - padLeft) / plotW
    const targetVal = ratio * maxXVal

    let nearest = uniqueXValues[0]
    let minDiff = Math.abs(targetVal - nearest)
    for (let i = 1; i < uniqueXValues.length; i++) {
      const diff = Math.abs(targetVal - uniqueXValues[i])
      if (diff < minDiff) {
        minDiff = diff
        nearest = uniqueXValues[i]
      }
    }
    setHoverX(nearest)
  }

  const handleCopyCsv = () => {
    if (!hasAnyData) return
    const header = [
      isSeededMode ? '逆走者人数(人)' : '逆走発生率(%)',
      ...BENCHMARK_VERSIONS.map((v) => `${v.shortLabel}_100人到達(s)`)
    ].join('\t')

    const rows = uniqueXValues.map((xVal) => {
      const cols = BENCHMARK_VERSIONS.map((v) => {
        const found = currentDataMap[v.id].find((p) =>
          isSeededMode ? p.peopleCount === xVal : p.rate === xVal
        )
        return found ? found.time.toFixed(2) : ''
      })
      return [xVal, ...cols].join('\t')
    })

    navigator.clipboard?.writeText([header, ...rows].join('\n'))
    setCopiedCsv(true)
    setTimeout(() => setCopiedCsv(false), 1500)
  }

  // 折りたたみ時のコンパクトバー（画面下部・左パネルの右側に配置）
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'absolute',
          left: '385px',
          right: '20px',
          bottom: '16px',
          zIndex: 9,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 243, 255, 0.25)',
          borderRadius: '10px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#00f3ff' }}>
            📊 逆走耐久性・自動連続計測グラフ（100人到達タイム）
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: params.isSeedLocked ? 'rgba(255,0,127,0.2)' : 'rgba(56,189,248,0.2)',
              color: params.isSeedLocked ? '#ff66b2' : '#38bdf8',
              fontWeight: 'bold'
            }}
          >
            {params.isSeedLocked
              ? `🔒 シードロック中 (#${params.reverseSeed}) → 人数グラフ連動`
              : '🔓 ランダム中 → 割合(%)グラフ連動'}
          </span>
          {benchmarkStatus === 'running' && benchmarkProgress && (
            <span style={{ fontSize: '11px', color: '#00ff88', fontWeight: 'bold' }}>
              ⏳ 計測中 ({benchmarkProgress.current}/{benchmarkProgress.total}): {benchmarkProgress.currentLabel} / {benchmarkProgress.currentStepLabel}
            </span>
          )}
          {benchmarkStatus === 'completed' && (
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid #10b981',
                color: '#00ff88',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 'bold'
              }}
            >
              ✅ 計測完了
            </span>
          )}
        </div>

        <button
          onClick={onToggleOpen}
          style={{
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(0, 243, 255, 0.4)',
            background: 'rgba(0, 243, 255, 0.15)',
            color: '#00f3ff',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          ▲ グラフパネルを開く
        </button>
      </div>
    )
  }

  // 展開時：画面全体の5分の2（40vh）の高さ・左コントロールパネルと重ならない配置
  return (
    <div
      style={{
        position: 'absolute',
        left: '385px',
        right: '20px',
        bottom: '16px',
        height: '40vh',
        minHeight: '270px',
        zIndex: 9,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0, 243, 255, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)'
      }}
    >
      {/* 上段：タイトル ＆ グラフ種別タブ ＆ 計測完了バッジ ＆ 閉じるボタン */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00f3ff' }}>
            📊 逆走耐久性・自動連続計測（100人到達タイム）
          </span>

          {/* グラフ1（割合%・ランダム） / グラフ2（人数・シードロック）切替タブ */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.35)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => onChangeGraphTab('random')}
              style={{
                padding: '4px 9px',
                borderRadius: '5px',
                border: 'none',
                background: activeGraphTab === 'random' ? '#0284c7' : 'transparent',
                color: activeGraphTab === 'random' ? '#ffffff' : '#94a3b8',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              📈 グラフ1: 割合(%) [ランダム]
            </button>
            <button
              onClick={() => onChangeGraphTab('seeded')}
              style={{
                padding: '4px 9px',
                borderRadius: '5px',
                border: 'none',
                background: activeGraphTab === 'seeded' ? '#db2777' : 'transparent',
                color: activeGraphTab === 'seeded' ? '#ffffff' : '#94a3b8',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              📈 グラフ2: 人数(人) [シードロック{seededRecordSeed ? ` #${seededRecordSeed}` : ''}]
            </button>
          </div>

          {/* ステータス表示（計測中プログレス / 計測完了バッジ） */}
          {benchmarkStatus === 'running' && benchmarkProgress && (
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                color: '#fbbf24',
                padding: '3px 9px',
                borderRadius: '6px',
                fontWeight: 'bold'
              }}
            >
              ⏳ 自動計測中 ({benchmarkProgress.current}/{benchmarkProgress.total}): {benchmarkProgress.currentLabel}（{benchmarkProgress.currentStepLabel}）
            </span>
          )}

          {benchmarkStatus === 'completed' && (
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid #10b981',
                color: '#00ff88',
                padding: '3px 10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(16,185,129,0.3)'
              }}
            >
              ✅ 計測完了
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {hasAnyData && (
            <button
              onClick={handleCopyCsv}
              style={{
                padding: '4px 9px',
                borderRadius: '5px',
                border: '1px solid rgba(0, 243, 255, 0.35)',
                background: copiedCsv ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 243, 255, 0.12)',
                color: copiedCsv ? '#00ff88' : '#00f3ff',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {copiedCsv ? '✓ コピー済' : '📋 表データコピー'}
            </button>
          )}
          <button
            onClick={onToggleOpen}
            style={{
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ▼ 閉じる
          </button>
        </div>
      </div>

      {/* 中段：比較バージョン複数選択 ＆ 刻み幅（1% / 5%） ＆ ワンクリック連続計測開始 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: 'rgba(255,255,255,0.04)',
          padding: '6px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          flexWrap: 'wrap'
        }}
      >
        {/* 比較対象バージョン複数選択 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>比較対象:</span>
          {BENCHMARK_VERSIONS.map((v) => {
            const checked = selectedVersions.includes(v.id)
            return (
              <button
                key={v.id}
                disabled={benchmarkStatus === 'running'}
                onClick={() => onToggleVersion(v.id)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: checked ? `1.5px solid ${v.color}` : '1px solid rgba(255,255,255,0.15)',
                  background: checked ? `${v.color}22` : 'rgba(255,255,255,0.03)',
                  color: checked ? '#ffffff' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: benchmarkStatus === 'running' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: checked ? v.color : '#475569',
                    display: 'inline-block'
                  }}
                />
                {v.shortLabel}
              </button>
            )
          })}
        </div>

        {/* 変化刻み選択（1%ずつ / 5%ずつ） ＆ 実行ボタン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>変化刻み:</span>
            {([5, 1] as const).map((step) => (
              <button
                key={step}
                disabled={benchmarkStatus === 'running'}
                onClick={() => onChangeStepSize(step)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: stepSize === step ? '1px solid #00f3ff' : '1px solid rgba(255,255,255,0.15)',
                  background: stepSize === step ? 'rgba(0, 243, 255, 0.18)' : 'rgba(255,255,255,0.04)',
                  color: stepSize === step ? '#00f3ff' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: benchmarkStatus === 'running' ? 'not-allowed' : 'pointer'
                }}
              >
                {step}%ずつ
              </button>
            ))}
          </div>

          {benchmarkStatus === 'running' ? (
            <button
              onClick={onStopBenchmark}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#ff2a6d',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ⏹ 計測中断
            </button>
          ) : (
            <button
              disabled={selectedVersions.length === 0}
              onClick={onStartBenchmark}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                background: selectedVersions.length === 0 ? '#334155' : '#10b981',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: selectedVersions.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: selectedVersions.length > 0 ? '0 0 10px rgba(16,185,129,0.35)' : 'none'
              }}
            >
              ▶ ワンクリック連続計測 ({params.isSeedLocked ? `シード#${params.reverseSeed}` : 'ランダム'})
            </button>
          )}

          {hasAnyData && benchmarkStatus !== 'running' && (
            <button
              onClick={onClearResults}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* 下段：折れ線グラフエリア */}
      <div
        ref={chartBoxRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          background: 'rgba(9, 13, 22, 0.65)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <svg
          width={chartSize.width}
          height={chartSize.height}
          onMouseMove={handleMouseMoveSvg}
          onMouseLeave={() => setHoverX(null)}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          {/* Y軸グリッド線 ＆ ラベル */}
          {yTicks.map((val, idx) => {
            const y = getY(val)
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray={idx === 0 ? undefined : '3,3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                >
                  {val.toFixed(0)}s
                </text>
              </g>
            )
          })}

          {/* X軸グリッド線 ＆ ラベル */}
          {xTicks.map((val, idx) => {
            const x = padLeft + (val / maxXVal) * plotW
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotH}
                  stroke="rgba(255,255,255,0.06)"
                />
                <text
                  x={x}
                  y={padTop + plotH + 15}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                >
                  {isSeededMode ? `${val}人` : `${val}%`}
                </text>
              </g>
            )
          })}

          {/* 軸タイトル */}
          <text
            x={14}
            y={padTop + plotH / 2}
            textAnchor="middle"
            fill="#cbd5e1"
            fontSize="10"
            fontWeight="bold"
            transform={`rotate(-90, 14, ${padTop + plotH / 2})`}
          >
            100人到達時間 (秒)
          </text>
          <text
            x={padLeft + plotW / 2}
            y={chartSize.height - 4}
            textAnchor="middle"
            fill="#cbd5e1"
            fontSize="10"
            fontWeight="bold"
          >
            {isSeededMode
              ? `逆走者の人数（人） [シードロック基準]`
              : `逆走者の割合（%） [ランダム発生基準]`}
          </text>

          {/* ホバー垂直ガイドライン */}
          {hoverX !== null && (
            <line
              x1={padLeft + (hoverX / maxXVal) * plotW}
              y1={padTop}
              x2={padLeft + (hoverX / maxXVal) * plotW}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

          {/* 各バージョンの折れ線 ＆ データ点 */}
          {BENCHMARK_VERSIONS.map((v) => {
            const pts = currentDataMap[v.id]
            if (pts.length === 0) return null

            const polyPoints = pts.map((p) => `${getX(p)},${getY(p.time)}`).join(' ')

            return (
              <g key={v.id}>
                <polyline
                  fill="none"
                  stroke={v.color}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyPoints}
                />
                {pts.map((p, idx) => {
                  const cx = getX(p)
                  const cy = getY(p.time)
                  const isHovered =
                    hoverX !== null && (isSeededMode ? p.peopleCount === hoverX : p.rate === hoverX)
                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5.5 : 3.5}
                      fill={v.color}
                      stroke="#090d16"
                      strokeWidth="1.5"
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* データ未計測時の案内メッセージ */}
        {!hasAnyData && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#64748b',
              fontSize: '12px',
              textAlign: 'center',
              padding: '0 20px'
            }}
          >
            比較対象を選んで「▶ ワンクリック連続計測」を押すと、ここに折れ線グラフが自動描画されます
          </div>
        )}

        {/* 右上凡例 */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            display: 'flex',
            gap: '10px',
            background: 'rgba(15, 23, 42, 0.82)',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.08)',
            pointerEvents: 'none'
          }}
        >
          {BENCHMARK_VERSIONS.filter((v) => currentDataMap[v.id].length > 0).map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
              <span
                style={{
                  width: '10px',
                  height: '3px',
                  background: v.color,
                  display: 'inline-block',
                  borderRadius: '2px'
                }}
              />
              <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{v.shortLabel}</span>
            </div>
          ))}
        </div>

        {/* ホバーツールチップ */}
        {hoverX !== null && hasAnyData && (
          <div
            style={{
              position: 'absolute',
              top: 34,
              right: 12,
              background: 'rgba(15, 23, 42, 0.94)',
              border: '1px solid rgba(0, 243, 255, 0.35)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              pointerEvents: 'none',
              minWidth: '140px'
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#00f3ff', marginBottom: '4px' }}>
              {isSeededMode
                ? `逆走者: ${hoverX}人 (${Math.round((hoverX / 240) * 100)}%)`
                : `逆走率: ${hoverX}% (約${Math.round((240 * hoverX) / 100)}人)`}
            </div>
            {BENCHMARK_VERSIONS.map((v) => {
              const found = currentDataMap[v.id].find((p) =>
                isSeededMode ? p.peopleCount === hoverX : p.rate === hoverX
              )
              if (!found) return null
              return (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    color: v.color,
                    fontWeight: 'bold'
                  }}
                >
                  <span>{v.shortLabel}:</span>
                  <span>{found.time.toFixed(1)}s</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}