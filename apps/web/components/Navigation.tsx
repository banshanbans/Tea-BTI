import Link from "next/link";
import { CardsThree, Mountains, UserCircle } from "@phosphor-icons/react/dist/ssr";

export function Navigation({ active }: { active: "swipe" | "realm" | "mine" }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <Link className={`nav-item ${active === "swipe" ? "active" : ""}`} href="/"><CardsThree size={21} weight={active === "swipe" ? "fill" : "regular"} /><span>刷茶</span></Link>
      <Link className={`nav-item ${active === "realm" ? "active" : ""}`} href="/realm"><Mountains size={21} weight={active === "realm" ? "fill" : "regular"} /><span>茶境</span></Link>
      <Link className={`nav-item ${active === "mine" ? "active" : ""}`} href="/profile"><UserCircle size={21} weight={active === "mine" ? "fill" : "regular"} /><span>我的</span></Link>
    </nav>
  );
}
