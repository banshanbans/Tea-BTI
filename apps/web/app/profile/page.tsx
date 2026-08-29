import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return <AppShell active="mine" header={false} shellClassName="profile-single-shell"><ProfileView /></AppShell>;
}
