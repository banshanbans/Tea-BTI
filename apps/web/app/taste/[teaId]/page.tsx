import { AppShell } from "@/components/AppShell";
import { VoiceExperience } from "@/components/VoiceExperience";
import { parseTeaOrigin } from "@/lib/navigation";

export default async function TastePage({ params, searchParams }: { params: Promise<{ teaId: string }>; searchParams: Promise<{ origin?: string | string[] }> }) {
  const { teaId } = await params;
  const { origin } = await searchParams;
  return <AppShell active="swipe" navigation={false} header={false}><VoiceExperience teaId={teaId} mode="taste" origin={parseTeaOrigin(origin)} /></AppShell>;
}
