import { useState, useEffect, type CSSProperties } from 'react';

interface Position {
  x: number;
  y: number;
}

export const Agent = () => {
  // キャラクターの位置 (ピクセル単位)
  const [position, setPosition] = useState<Position>({ x: 100, y: 100 });

  // 移動速度 (1回のキー入力で動くピクセル数)
  const STEP = 20;

  // フィールドのサイズ定義
  const FIELD_WIDTH = 400;
  const FIELD_HEIGHT = 400;
  const AGENT_SIZE = 40;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 矢印キーが押された時の画面スクロールを防ぐ
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      setPosition((prev) => {
        let { x, y } = prev;

        switch (e.key) {
          case 'ArrowUp':
            y = Math.max(0, y - STEP);
            break;
          case 'ArrowDown':
            y = Math.min(FIELD_HEIGHT - AGENT_SIZE, y + STEP);
            break;
          case 'ArrowLeft':
            x = Math.max(0, x - STEP);
            break;
          case 'ArrowRight':
            x = Math.min(FIELD_WIDTH - AGENT_SIZE, x + STEP);
            break;
          default:
            return prev;
        }

        return { x, y };
      });
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#fff', marginBottom: '10px' }}>Agent Controller</h2>
      <p style={{ color: '#ccc', marginBottom: '20px' }}>
        キーボードの <strong>矢印キー（↑ ↓ ← →）</strong> で移動します
      </p>

      {/* フィールド */}
      <div style={{ ...fieldStyle, width: FIELD_WIDTH, height: FIELD_HEIGHT }}>
        {/* キャラクター */}
        <div
          style={{
            ...agentStyle,
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: AGENT_SIZE,
            height: AGENT_SIZE,
          }}
        >
          🚶
        </div>
      </div>

      <div style={{ marginTop: '15px', color: '#aaa', fontSize: '14px' }}>
        現在位置: X: {position.x}px, Y: {position.y}px
      </div>
    </div>
  );
};

// スタイル定義
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: '#1a1a1a',
  fontFamily: 'sans-serif',
};

const fieldStyle: CSSProperties = {
  position: 'relative',
  backgroundColor: '#2a2a2a',
  border: '2px solid #444',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
};

const agentStyle: CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28px',
  transition: 'left 0.1s ease-out, top 0.1s ease-out',
  userSelect: 'none',
};

// default export も用意（どちらのインポート方法でも動くように設定）
export default Agent;