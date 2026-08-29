import { AppShell } from "@/components/AppShell";
import { TeaDetailView } from "@/components/TeaDetailView";

export default async function TeaPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  return <AppShell active="swipe"><TeaDetailView teaId={teaId} /></AppShell>;
}

