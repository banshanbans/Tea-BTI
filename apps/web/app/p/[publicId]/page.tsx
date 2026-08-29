import type { Metadata } from "next";

import { PublicProfileView } from "@/components/PublicProfileView";

export const metadata: Metadata = {
  title: "茶主页 · Tea-BTI",
  description: "一张由真实喝茶行为形成、可随时撤销的公开茶主页。",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicProfilePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <PublicProfileView publicId={publicId} />;
}
