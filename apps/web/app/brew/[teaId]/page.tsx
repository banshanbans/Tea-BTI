import { AppShell } from "@/components/AppShell";
import { VoiceExperience } from "@/components/VoiceExperience";

export default async function BrewPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  return <AppShell active="swipe" navigation={false} header={false}><VoiceExperience teaId={teaId} mode="brew" /></AppShell>;
}
