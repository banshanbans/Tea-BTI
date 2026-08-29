import { AppShell } from "@/components/AppShell";
import { TeaDetailView } from "@/components/TeaDetailView";
import { parseTeaOrigin } from "@/lib/navigation";

export default async function TeaPage({ params, searchParams }: { params: Promise<{ teaId: string }>; searchParams: Promise<{ origin?: string | string[] }> }) {
  const { teaId } = await params;
  const { origin } = await searchParams;
  return <AppShell active="swipe" header={false}><TeaDetailView teaId={teaId} origin={parseTeaOrigin(origin)} /></AppShell>;
}
