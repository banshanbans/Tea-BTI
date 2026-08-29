import { AppShell } from "@/components/AppShell";
import { TeaBtiDetailView } from "@/components/TeaBtiDetailView";

export default function TeaBtiDetailPage() {
  return <AppShell active="mine" header={false} shellClassName="profile-focus-shell"><TeaBtiDetailView /></AppShell>;
}
