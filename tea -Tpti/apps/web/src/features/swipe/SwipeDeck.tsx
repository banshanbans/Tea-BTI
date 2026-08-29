'use client';

// ============================================================
// SwipeDeck —— 三张叠卡（top / behind / behind2）+ 顶部卡拖拽手势
// 手势用 framer-motion（跟随 / 旋转 / 回弹 / 飞出），叠卡层级用 CSS class。
// ============================================================
import { useRef } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { FEED_ORDER, TEAS } from '@/lib/teas';
import type { SwipeAction, Tea } from '@/lib/types';
import BlindCard from './BlindCard';

/** 从 feedIdx 出发的循环茶序 */
function feedOrder(feedIdx: number): Tea[] {
  const n = FEED_ORDER.length;
  const out: Tea[] = [];
  for (let k = 0; k < n; k++) {
    out.push(TEAS[FEED_ORDER[(feedIdx + k) % n]]);
  }
  return out;
}

/** 顶部可拖拽卡片（飞出后回调 onSwipe 推进 store） */
function DraggableCard({ tea, onSwipe }: { tea: Tea; onSwipe: (a: SwipeAction) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);

  function fly(action: SwipeAction, w: number) {
    const dir = action === 'like' ? 1 : -1;
    animate(x, dir * w * 1.3, { duration: 0.22, ease: 'easeIn' }).then(() => onSwipe(action));
  }

  return (
    <motion.div
      ref={ref}
      className="card"
      style={{ x, rotate, zIndex: 3 }}
      drag="x"
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        const w = ref.current?.offsetWidth ?? 430;
        const threshold = w * 0.28;
        if (info.offset.x > threshold) fly('like', w);
        else if (info.offset.x < -threshold) fly('skip', w);
        else animate(x, 0, { type: 'spring', stiffness: 400, damping: 28 });
      }}
    >
      <BlindCard tea={tea} />
    </motion.div>
  );
}

export default function SwipeDeck() {
  const feedIdx = useAppStore((s) => s.feedIdx);
  const swipe = useAppStore((s) => s.swipe);
  const slice = feedOrder(feedIdx).slice(0, 3);

  return (
    <div className="swipe-stage">
      {slice.map((tea, i) => {
        if (i === 0) {
          return <DraggableCard key={tea.id} tea={tea} onSwipe={swipe} />;
        }
        return (
          <div
            key={tea.id}
            className={`card${i === 1 ? ' behind' : ' behind2'}`}
            style={{ zIndex: 3 - i }}
          >
            <BlindCard tea={tea} />
          </div>
        );
      })}
    </div>
  );
}
