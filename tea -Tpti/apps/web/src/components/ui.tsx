// ============================================================
// 通用 UI 组件（复用 globals.css 的 class，不重复造样式）
// ============================================================
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 合并 className */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

interface PillProps {
  children: ReactNode;
  className?: string;
}

/** 胶囊标签（.pill） */
export function Pill({ children, className }: PillProps) {
  return <span className={cx('pill', className)}>{children}</span>;
}

interface TagProps {
  children: ReactNode;
  className?: string;
  /** 启用琥珀色变体（.tag-amber） */
  amber?: boolean;
}

/** 标签（.tag），可切换 .tag-amber */
export function Tag({ children, className, amber }: TagProps) {
  return <span className={cx('tag', amber && 'tag-amber', className)}>{children}</span>;
}

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

/** 小标题眉注（.eyebrow） */
export function Eyebrow({ children, className }: EyebrowProps) {
  return <div className={cx('eyebrow', className)}>{children}</div>;
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { className?: string };

/** 方形图标按钮（.iconbtn） */
export function IconButton({ className, ...rest }: IconButtonProps) {
  return <button className={cx('iconbtn', className)} {...rest} />;
}

type BackButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { className?: string };

/**
 * 返回按钮（.back，样式由所在容器 .pagehead / .brew-head / .taste-head 提供）
 * 默认箭头「←」
 */
export function BackButton({ className, children, ...rest }: BackButtonProps) {
  return (
    <button className={cx('back', className)} {...rest}>
      {children ?? '←'}
    </button>
  );
}
