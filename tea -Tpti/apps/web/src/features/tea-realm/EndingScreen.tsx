'use client';

// ============================================================
// Screen 12 · Realm Ending
// 像素叶落下 → 这就是你刚刚喝的那杯茶。 → 收进茶护照
// ============================================================
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';

export default function EndingScreen() {
  const addPassport = useAppStore((s) => s.addPassport);
  const go = useAppStore((s) => s.go);

  return (
    <section className="screen screen-ending active" data-screen="ending">
      <div>
        <span className="ending-leaf">🍃</span>
        <motion.div
          className="ending-txt"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div>这就是你刚刚喝的那杯茶。</div>
          <h2>都匀毛尖</h2>
          <div className="name">贵州 · 黔南</div>
        </motion.div>
        <motion.div
          className="ending-actions"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <button className="btn btn-primary" onClick={addPassport}>
            收进茶护照
          </button>
          <button className="btn btn-ghost" onClick={() => go('swipe')}>
            继续刷茶
          </button>
        </motion.div>
      </div>
    </section>
  );
}
