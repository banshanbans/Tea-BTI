import { HomeExperience } from "@/components/HomeExperience";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ fromProfile?: string }> }) {
  const { fromProfile } = await searchParams;
  return <HomeExperience forceOnboarding={Boolean(fromProfile)} />;
}
