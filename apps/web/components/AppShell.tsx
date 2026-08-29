import { Navigation } from "./Navigation";
import { Leaf } from "@phosphor-icons/react/dist/ssr";

export function AppShell({ children, active = "swipe", navigation = true, header = true, shellClassName = "" }: { children: React.ReactNode; active?: "swipe" | "realm" | "mine"; navigation?: boolean; header?: boolean; shellClassName?: string }) {
  return (
    <main className={`mobile-shell ${shellClassName}`.trim()}>
      {header ? <header className="topbar">
        <span className="brand-lockup"><span className="brand-mark"><Leaf size={18} weight="fill" /></span><span className="brand">Tea-BTI</span></span>
        <span className="brand-caption">Guizhou Tea Identity</span>
      </header> : null}
      {children}
      {navigation ? <Navigation active={active} /> : null}
    </main>
  );
}
