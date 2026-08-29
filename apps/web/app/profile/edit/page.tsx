import { AppShell } from "@/components/AppShell";
import { ProfileEditView } from "@/components/ProfileEditView";

export default function ProfileEditPage() {
  return <AppShell active="mine" navigation={false} header={false} shellClassName="profile-focus-shell"><ProfileEditView /></AppShell>;
}
