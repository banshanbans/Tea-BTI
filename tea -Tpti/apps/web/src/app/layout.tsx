import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "刷茶 · 你不用先懂茶",
  description: "一个年轻人第一次进入原叶茶世界的发现界面",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* .stage：移动端全屏；桌面端(≥600px) 居中手机 + 氛围背景 */}
        <div className="stage">
          <div id="app">{children}</div>
        </div>
      </body>
    </html>
  );
}
