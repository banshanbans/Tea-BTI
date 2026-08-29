'use client';

// ============================================================
// 底部导航（.bottomnav）：刷茶 / 茶境 / 我的
// ============================================================
import { useAppStore } from '@/stores/app-store';
import type { Tab } from '@/lib/types';

const ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'swipe', icon: '◫', label: '刷茶' },
  { tab: 'realm', icon: '🌿', label: '茶境' },
  { tab: 'profile', icon: '☰', label: '我的' },
];

export default function BottomNav() {
  const currentTab = useAppStore((s) => s.currentTab);
  const tab = useAppStore((s) => s.tab);

  return (
    <nav className="bottomnav">
      {ITEMS.map((it) => (
        <button
          key={it.tab}
          className={`nav-item${currentTab === it.tab ? ' active' : ''}`}
          onClick={() => tab(it.tab)}
        >
          <span className="n-ico">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
