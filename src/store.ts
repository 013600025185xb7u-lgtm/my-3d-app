import { create } from 'zustand'

// 状態管理（Zustand）の定義
type SimState = {
  speed: number
  setSpeed: (speed: number) => void
  data: { name: string; value: number }[]
  updateData: () => void
}

export const useSimStore = create<SimState>((set) => ({
  speed: 1, // サイコロの回転スピード
  setSpeed: (speed) => set({ speed }),
  
  // グラフ用データ
  data: [
    { name: 'Sensor 1', value: 400 },
    { name: 'Sensor 2', value: 300 },
    { name: 'Sensor 3', value: 300 },
    { name: 'Sensor 4', value: 200 },
  ],
  
  // データをランダムに更新する関数（3D側から呼ばれる）
  updateData: () =>
    set((state) => ({
      data: state.data.map((item) => ({
        ...item,
        value: item.value + (Math.random() - 0.5) * state.speed * 20, // スピードに応じて変動
      })),
    })),
}))
