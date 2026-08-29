'use client';

// ============================================================
// Screen 15 · 茶护照（收藏册：已收录茶 + 印章 + 你说引用语）
// 逐字复刻 index.html Screen 15 与 renderPassport。
// ============================================================
import { useAppStore } from '@/stores/app-store';
import { TEAS } from '@/lib/teas';
import type { Tea, TeaId } from '@/lib/types';

/** 「你说」引用语（与 index.html renderPassport 一致） */
function quoteFor(id: TeaId): string {
  if (id === 'duyun') return '像雨后的嫩草，第二泡更甜。';
  if (id === 'zunyi') return '甜香比我想象的明显。';
  return '';
}

/** 单条护照条目（.pp-entry）：印章 + 名称 + 徽章 + 引用语 */
export function PassportEntry({ tea }: { tea: Tea }) {
  const brewed = tea.id === 'duyun';
  const tasted = true; // 进入护照即已品过
  const realm = tea.id === 'duyun';
  const quote = quoteFor(tea.id);

  return (
    <div className="pp-entry fade-in">
      <div className="pp-stamp">已收录</div>
      <div className="pp-name">{tea.name}</div>
      <div className="pp-region">{tea.region}</div>
      <div className="pp-badges">
        {brewed ? <span>已泡</span> : <span className="off">未泡</span>}
        {tasted ? <span>已品</span> : <span className="off">未品</span>}
        {realm ? <span>已解锁茶境</span> : <span className="off">未解锁</span>}
      </div>
      {quote ? (
        <div className="pp-quote">
          <div className="qlbl">你说</div>
          <div className="qtext">{quote}</div>
        </div>
      ) : null}
    </div>
  );
}

/** 护照空态 */
export function PassportEmpty() {
  return (
    <div
      style={{
        padding: '60px 30px',
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 14,
        lineHeight: 1.8,
      }}
    >
      你真正喝过的茶，
      <br />
      才算来过这里。
      <br />
      <br />
      先从刷一杯开始吧 🍃
    </div>
  );
}

export default function PassportScreen() {
  const passport = useAppStore((s) => s.passport);

  return (
    <section className="screen screen-scroll screen-passport active">
      <div className="statusbar"></div>

      <div className="pp-head">
        <div className="eyebrow">MEMORY · TEA PASSPORT</div>
        <h2>茶护照</h2>
        <div className="sub">你真正喝过的茶，才算来过这里。</div>
      </div>

      {passport.length === 0 ? (
        <PassportEmpty />
      ) : (
        passport.map((id) => <PassportEntry key={id} tea={TEAS[id]} />)
      )}

      <div className="pp-pad"></div>
    </section>
  );
}
