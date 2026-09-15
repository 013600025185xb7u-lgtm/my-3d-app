import * as THREE from 'three'

// シミュレーション全体の設定パラメータ型
export type SimParams = {
  agentCount: number        // 総人数（初期値: 40人×6クラス = 240人）
  avgHeight: number         // 平均身長 (m)
  avgShoulderWidth: number  // 平均肩幅 (m)
  avgSpeed: number          // 平均歩行速度 (m/s)
  speedRandomness: number   // 速度の個人差・ランダム性 (%)
  minPersonalDist: number   // 人同士の最低快適距離 (m)
  simSpeed: number          // シミュレーション再生スピード倍率
  reverseRate: number       // 途中逆走発生率 (%)
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

// エージェントの個別データ構造
export type AgentData = {
  id: number
  height: number
  shoulderWidth: number
  baseSpeed: number
  currentPos: THREE.Vector3
  velocity: THREE.Vector3
  targetIndex: number       // ウェイポイント参照用
  isReverse: boolean       // 逆走フラグ
  originClassroom: THREE.Vector3 // 戻るべき所属教室
  escaped: boolean
  densityState: 'clear' | 'moderate' | 'dense' // 密度カラー用
}

// マップ構造定義（2階廊下・6教室・折り返し階段・昇降口）
export const MAP_CONFIG = {
  corridorLength: 60,
  corridorWidth: 3.0,
  classroomCount: 6,
  stairLanding: new THREE.Vector3(30, 0, 0),
  stairBottom: new THREE.Vector3(30, -3.5, -6),
  exitPos: new THREE.Vector3(30, -3.5, 5), // 昇降口（人5人分 = 約2.5〜3m幅）
}
