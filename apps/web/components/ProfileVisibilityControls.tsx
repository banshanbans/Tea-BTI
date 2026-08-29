import type { ProfileBlockId, TeaProfile } from "@/lib/api";
import { PROFILE_BLOCK_LABELS, PROFILE_BLOCK_ORDER } from "@/lib/profile";

type Completeness = Partial<Record<ProfileBlockId, boolean>>;

export function ProfileVisibilityControls({
  profile,
  blockIds,
  onChange,
  completeness,
}: {
  profile: TeaProfile;
  blockIds: ProfileBlockId[];
  onChange: (blockId: ProfileBlockId, enabled: boolean) => void;
  completeness?: Completeness;
}) {
  const serverCompleteness = Object.fromEntries(profile.blocks.map((block) => [block.blockId, block.isComplete])) as Completeness;

  return (
    <div className="profile-visibility-options" aria-label="分享范围">
      {PROFILE_BLOCK_ORDER.map((blockId) => {
        const identity = blockId === "IDENTITY";
        const complete = identity || (completeness?.[blockId] ?? serverCompleteness[blockId] ?? false);
        const checked = identity || blockIds.includes(blockId);
        return (
          <label className={`profile-visibility-option ${!complete ? "unavailable" : ""}`} key={blockId}>
            <input
              type="checkbox"
              checked={checked}
              disabled={identity || !complete}
              onChange={(event) => onChange(blockId, event.target.checked)}
            />
            <span>
              <strong>{PROFILE_BLOCK_LABELS[blockId]}</strong>
              <small>{identity ? "分享时始终包含" : complete ? (checked ? "这次会公开" : "这次不公开") : "有内容后可以公开"}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}
