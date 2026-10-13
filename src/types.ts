import * as THREE from 'three'

// シミュレーション全体の設定パラメータ
export type SimParams = {
  agentCount: number        // 人数 (1クラス40人×6=240人標準)
  avgHeight: number         // 平均身長 (m)
  avgShoulderWidth: number  // 平均肩幅 (m)
  avgSpeed: number          // 平均歩行速度 (m/s)
  speedRandomness: number   // 速度の個人差 (%)
  minPersonalDist: number   // 最低対人距離 (m)
  simSpeed: number          // 再生速度 (倍率)
  reverseRate: number       // 無秩序・パニック逆走発生率 (%)
}

// 初期デフォルト値（建築・人間工学の一般的な数値）
export const DEFAULT_PARAMS: SimParams = {
  agentCount: 240,
  avgHeight: 1.65,
  avgShoulderWidth: 0.45,
  avgSpeed: 1.3,
  speedRandomness: 20,
  minPersonalDist: 0.5,
  simSpeed: 1.0,
  reverseRate: 5,
}

// エージェント（避難者）個別データ
export type AgentData = {
  id: number
  height: number
  shoulderWidth: number
  baseSpeed: number
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  targetIndex: number
  isReverse: boolean
  originClassroom: THREE.Vector3
  escaped: boolean
  densityState: 'clear' | 'moderate' | 'dense'
}

// マップ位置情報 (2階廊下・階段・昇降口)
export const MAP_CONFIG = {
  exitPos: new THREE.Vector3(28, -3.5, 5), // 昇降口（5人分幅ゲート）
}
