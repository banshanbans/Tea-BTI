import type { ProfileBlockId, TeaProfile } from "@/lib/api";

export const PROFILE_BLOCK_ORDER: ProfileBlockId[] = ["IDENTITY", "MY_TEA", "MY_WORDS", "TEA_PASSPORT"];

export const PROFILE_BLOCK_LABELS: Record<ProfileBlockId, string> = {
  IDENTITY: "Tea-BTI 身份",
  MY_TEA: "本命茶",
  MY_WORDS: "我说过",
  TEA_PASSPORT: "茶护照",
};

export type ProfileFormState = {
  displayName: string;
  bio: string;
  selectedTeaId: string;
  sourceFeedbackId: string;
  publicQuote: string;
  publicBlockIds: ProfileBlockId[];
};

export function profileToForm(profile: TeaProfile): ProfileFormState {
  return {
    displayName: profile.settings.displayName,
    bio: profile.settings.bio,
    selectedTeaId: profile.settings.selectedTeaId || "",
    sourceFeedbackId: profile.settings.sourceFeedbackId || "",
    publicQuote: profile.settings.publicQuote || "",
    publicBlockIds: profile.settings.publicBlockIds,
  };
}

export function normalizePublicBlocks(blockIds: ProfileBlockId[]): ProfileBlockId[] {
  const requested = new Set(blockIds);
  requested.add("IDENTITY");
  return PROFILE_BLOCK_ORDER.filter((blockId) => requested.has(blockId));
}

export function togglePublicBlock(
  blockIds: ProfileBlockId[],
  blockId: ProfileBlockId,
  enabled: boolean,
): ProfileBlockId[] {
  if (blockId === "IDENTITY") return normalizePublicBlocks(blockIds);
  const requested = new Set(blockIds);
  if (enabled) requested.add(blockId);
  else requested.delete(blockId);
  return normalizePublicBlocks([...requested]);
}

export function eventId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function profileUpdateBody(form: ProfileFormState, clientEventId: string) {
  return {
    clientEventId,
    displayName: form.displayName,
    bio: form.bio,
    selectedTeaId: form.selectedTeaId || null,
    sourceFeedbackId: form.sourceFeedbackId || null,
    publicQuote: form.sourceFeedbackId ? form.publicQuote : null,
    publicBlockIds: normalizePublicBlocks(form.publicBlockIds),
  };
}
