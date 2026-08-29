import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_COPY_FILES = [
  "components/HomeExperience.tsx",
  "components/TeaDetailView.tsx",
  "components/VoiceExperience.tsx",
  "components/PassportView.tsx",
  "components/ProfileView.tsx",
  "components/PublicProfileView.tsx",
  "components/realm/RealmHome.tsx",
  "components/realm/RealmExperience.tsx",
];

const STALE_PUBLIC_PHRASES = [
  "Cold Start",
  "Blind Swipe",
  "Recommendation ·",
  "Guided Journey",
  "Brewing Guide",
  "Real Taste",
  "My Tea Profile",
  "Unlisted Share",
  "Share Preview",
  "Tea-BTI 不是测出来的，是喝出来的",
  "MBTI 只负责破冰",
  "真正留下来",
];

describe("public Chinese copy policy", () => {
  it("keeps retired explanatory and decorative phrases out of the H5", () => {
    const contents = PUBLIC_COPY_FILES.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    for (const phrase of STALE_PUBLIC_PHRASES) expect(contents).not.toContain(phrase);
  });
});
