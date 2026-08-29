'use client';

// ============================================================
// Screen 1 · Launch / Entry（入口页）
// ============================================================
import { useAppStore } from '@/stores/app-store';

export default function LaunchScreen() {
  const go = useAppStore((s) => s.go);

  return (
    <section className="screen screen-launch active">
      <div className="launch-mist"></div>
      <div className="launch-inner">
        <div className="launch-logo">
          <div className="mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3c3 2.5 6 3 6 6 0 2-1 3.5-3 4.5 2 1 3 2.5 3 4.5 0 3-3 3-6 3s-6 0-6-3c0-2 1-3.5 3-4.5C7 12.5 6 11 6 9c0-3 3-3.5 6-6Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className="word">
            刷茶
            <small>SHUACHA</small>
          </div>
        </div>

        <div className="launch-hero">
          <div className="eyebrow">一个年轻人第一次进入原叶茶世界的界面</div>
          <h1>
            你不用先懂茶。
            <br />
            刷几下，<span className="em">茶先开始懂你。</span>
          </h1>
          <p className="sub">
            今天想喝什么？<b>别选，刷就行。</b>
            <br />
            不注册、不做测试，从一杯「感觉」开始。
          </p>
          <div className="launch-actions">
            <button className="btn btn-primary" onClick={() => go('swipe')}>
              开始刷茶
            </button>
          </div>
          <div className="launch-hint">
            <span className="dot"></span>不需要做测试
          </div>
        </div>
      </div>
    </section>
  );
}
