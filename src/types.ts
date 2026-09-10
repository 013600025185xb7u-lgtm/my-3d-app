import * as THREE from 'three';

// 1. エージェント（避難者）のデータ型
export interface AgentData {
  id: number;
  position: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  escaped: boolean;
  status: 'normal' | 'congested' | 'stuck' | 'returning'; // 青, 黄, 赤, 紫
  isRetringToClassroom: boolean; // 教室へ戻る（逆走）フラグ
}

// 2. 障害物のデータ型
export interface Obstacle {
  position: [number, number, number];
  size: [number, number, number];
}

// 3. 定数定義（非常口、教室、障害物の位置など）
export const EXIT_POS = new THREE.Vector3(0, 0, 18);
export const CLASSROOM_POS = new THREE.Vector3(-8, 0, -10);

export const OBSTACLES: Obstacle[] = [
  // メイン通路中央の大きな崩落障害物
  { position: [0, 1, 2], size: [6, 2, 3] },
  // 左右の散乱瓦礫
  { position: [-5, 0.5, -2], size: [2, 1, 2] },
  { position: [4, 0.5, 8], size: [3, 1, 2] },
];