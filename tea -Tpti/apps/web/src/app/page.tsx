'use client';

// ============================================================
// 主页面：根据 currentScreen 渲染对应 screen。
// 11 个 screen 的默认导出组件全部串起来；RevealSheet / TasteSummary
// 由 SwipeScreen 内部自渲染，Companion Drawer 由 FloatingCompanion 自渲染。
// 桌面三栏由 layout.tsx 的 .stage 实现，本页只渲染中栏 App 内容。
// ============================================================
import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import LaunchScreen from '@/components/LaunchScreen';
import BottomNav from '@/components/BottomNav';
import FloatingCompanion from '@/components/FloatingCompanion';
import SwipeScreen from '@/features/swipe/SwipeScreen';
import DetailScreen from '@/features/tea-detail/DetailScreen';
import BrewScreen from '@/features/brew/BrewScreen';
import TasteScreen from '@/features/taste/TasteScreen';
import RealmScreen from '@/features/tea-realm/RealmScreen';
import ChapterScreen from '@/features/tea-realm/ChapterScreen';
import EndingScreen from '@/features/tea-realm/EndingScreen';
import ProfileScreen from '@/features/profile/ProfileScreen';
import TeaBtiScreen from '@/features/teabti/TeaBtiScreen';
import PassportScreen from '@/features/passport/PassportScreen';

export default function Home() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const hydrateFromBackend = useAppStore((s) => s.hydrateFromBackend);

  // 挂载时检测后端并拉取 Tea-BTI / 护照（离线自动降级 mock）
  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend]);

  // 沉浸页（入口 / 泡茶 / 品茶）隐藏底部导航与浮动茶伴
  const immersive =
    currentScreen === 'launch' || currentScreen === 'brew' || currentScreen === 'taste';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'launch':
        return <LaunchScreen />;
      case 'swipe':
        return <SwipeScreen />;
      case 'detail':
        return <DetailScreen />;
      case 'brew':
        return <BrewScreen />;
      case 'taste':
        return <TasteScreen />;
      case 'realm':
        return <RealmScreen />;
      case 'chapter':
        return <ChapterScreen />;
      case 'ending':
        return <EndingScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'teabti':
        return <TeaBtiScreen />;
      case 'passport':
        return <PassportScreen />;
      default:
        return null;
    }
  };

  return (
    <>
      {renderScreen()}
      {!immersive && <BottomNav />}
      {!immersive && <FloatingCompanion />}
    </>
  );
}
