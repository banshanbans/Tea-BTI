import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

type BackControlProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
};

export function BackControl({ ariaLabel, className = "", disabled = false, href, onClick }: BackControlProps) {
  const classes = `back-control ${className}`.trim();
  if (href) return <Link className={classes} href={href} aria-label={ariaLabel}><ArrowLeft size={21} /></Link>;
  return <button type="button" className={classes} disabled={disabled} aria-label={ariaLabel} onClick={onClick}><ArrowLeft size={21} /></button>;
}
