import { AppShell } from "@/components/AppShell";
import { RealmExperience } from "@/components/realm/RealmExperience";

export default async function RealmExperiencePage({ params, searchParams }: {
  params: Promise<{ realmId: string }>;
  searchParams: Promise<{ replay?: string }>;
}) {
  const { realmId } = await params;
  const { replay } = await searchParams;
  return <AppShell navigation={false} header={false}><RealmExperience realmId={realmId} replay={replay === "1"} /></AppShell>;
}
