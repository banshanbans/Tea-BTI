import { AppShell } from "@/components/AppShell";
import { RealmExperience } from "@/components/realm/RealmExperience";
import { parseRealmEntry, parseTeaOrigin } from "@/lib/navigation";

export default async function RealmExperiencePage({ params, searchParams }: {
  params: Promise<{ realmId: string }>;
  searchParams: Promise<{ entry?: string | string[]; origin?: string | string[]; replay?: string | string[]; teaId?: string | string[] }>;
}) {
  const { realmId } = await params;
  const { entry, origin, replay, teaId } = await searchParams;
  const replayValue = Array.isArray(replay) ? replay[0] : replay;
  const sourceTeaId = Array.isArray(teaId) ? teaId[0] : teaId;
  return <AppShell navigation={false} header={false}><RealmExperience
    realmId={realmId}
    replay={replayValue === "1"}
    entry={parseRealmEntry(entry)}
    origin={parseTeaOrigin(origin)}
    sourceTeaId={sourceTeaId}
  /></AppShell>;
}
