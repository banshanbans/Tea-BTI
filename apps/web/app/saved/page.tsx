import { AppShell } from "@/components/AppShell";
import { SavedTeaView } from "@/components/SavedTeaView";

export default function SavedPage() {
  return <AppShell active="mine"><SavedTeaView /></AppShell>;
}
