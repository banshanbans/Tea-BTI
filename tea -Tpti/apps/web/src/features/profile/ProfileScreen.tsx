'use client';

// ============================================================
// Screen 13 · 我的（我的茶 头部 + Tea-BTI 卡 + 茶护照 mini 列表 + 收藏空态）
// 逐字复刻 index.html Screen 13 与 renderProfile / passportMini。
// ============================================================
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';
import type { Tea } from '@/lib/types';

/** Tea-BTI 卡（.teabti-card），点击进入 Tea-BTI 屏 */
export function TeaBtiCard() {
  const go = useAppStore((s) => s.go);

  return (
    <div className="teabti-card" onClick={() => go('teabti')}>
      <span className="t-lbl">TEA-BTI</span>
      <span className="t-state">正在形成</span>
      <div className="t-name">🌫 春雾回甘型</div>
      <div className="t-desc">
        你更容易被轻盈、清鲜的茶吸引，
        <br />
        喜欢入口柔和，但尾巴最好留久一点。
      </div>
      <span className="t-cta">查看我的 Tea-BTI ›</span>
    </div>
  );
}

/** 单条茶护照 mini 行（passportMini），点击进入茶护照 */
export function PassportMiniRow({ tea }: { tea: Tea }) {
  const passport = useAppStore((s) => s.passport);
  const go = useAppStore((s) => s.go);

  const brewed = tea.id === 'duyun';
  const tasted = passport.includes(tea.id);
  const realm = tea.id === 'duyun';

  return (
    <button className="passport-mini" onClick={() => go('passport')}>
      <div className="pm-ico">{tea.emoji}</div>
      <div>
        <div className="pm-name">{tea.name}</div>
        <div className="pm-sub">{tea.region}</div>
        <div className="pm-badges">
          {brewed && <span>已泡</span>}
          {tasted && <span>已品</span>}
          {realm && <span>已解锁茶境</span>}
        </div>
      </div>
      <span className="pm-arrow">›</span>
    </button>
  );
}

/** 收藏空态（固定展示，无交互） */
export function FavoriteEmptyState() {
  return (
    <div className="passport-mini">
      <div className="pm-ico">🤍</div>
      <div>
        <div className="pm-name">还没有收藏</div>
        <div className="pm-sub">长按卡片可以收藏</div>
      </div>
    </div>
  );
}

/** 茶护照 mini 列表：空态 vs 已收录 */
export function PassportMiniList() {
  const passport = useAppStore((s) => s.passport);
  const tab = useAppStore((s) => s.tab);

  if (passport.length === 0) {
    return (
      <button className="passport-mini" onClick={() => tab('swipe')}>
        <div className="pm-ico">🛂</div>
        <div>
          <div className="pm-name">还没有记录</div>
          <div className="pm-sub">刷到想喝的茶，喝过就会被记在这里</div>
        </div>
        <span className="pm-arrow">›</span>
      </button>
    );
  }

  return (
    <>
      {passport.map((id) => (
        <PassportMiniRow key={id} tea={TEAS[id]} />
      ))}
    </>
  );
}

export default function ProfileScreen() {
  return (
    <section className="screen screen-scroll screen-profile active">
      <div className="statusbar"></div>

      <div className="profile-head">
        <h2>我的茶</h2>
      </div>

      <TeaBtiCard />

      <div className="profile-section">
        <div className="sec-title">茶护照</div>
        <PassportMiniList />

        <div className="sec-title">收藏</div>
        <FavoriteEmptyState />
      </div>

      <div className="profile-pad"></div>
    </section>
  );
}
