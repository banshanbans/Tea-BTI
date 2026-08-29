from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class MbtiCode(StrEnum):
    INFP = "INFP"
    INFJ = "INFJ"
    ISFP = "ISFP"
    ISFJ = "ISFJ"
    ENFP = "ENFP"
    ENFJ = "ENFJ"
    ESFP = "ESFP"
    ESFJ = "ESFJ"
    INTP = "INTP"
    INTJ = "INTJ"
    ISTP = "ISTP"
    ISTJ = "ISTJ"
    ENTP = "ENTP"
    ENTJ = "ENTJ"
    ESTP = "ESTP"
    ESTJ = "ESTJ"


class AnonymousSessionResponse(ApiModel):
    user_id: str
    access_token: str
    created_at: datetime


class CapabilitiesResponse(ApiModel):
    voice: Literal["real", "mock", "unavailable"]
    taste_normalization: Literal["real", "mock"]
    missing_config: list[str] = Field(default_factory=list)


class TasteProfileResponse(ApiModel):
    vector: dict[str, float]
    sample_count: int
    confidence_state: Literal["forming", "early", "stable"]


class BootstrapResponse(ApiModel):
    user_id: str
    mbti: MbtiCode | None
    onboarding_completed: bool
    swipe_count: int
    recommendation_ready: bool
    taste_profile: TasteProfileResponse
    capabilities: CapabilitiesResponse


class SeedRequest(ApiModel):
    mbti: MbtiCode | None = None


class VisualResponse(ApiModel):
    url: str
    object_position: str
    structure_color: str
    abstract_form: str
    atmosphere_cue: str
    overlay: dict[str, float]


class DetailVisualResponse(ApiModel):
    url: str
    object_position: str
    alt: str
    rights_state: Literal["unknown", "demo_only", "owned", "licensed", "open_license"]
    rights_note: str
    credit: str
    source_url: str


class EvidenceRefResponse(ApiModel):
    id: str
    label: str
    url: str
    supports: list[str]


class SeedTeaResponse(ApiModel):
    role: Literal["mirror", "surprise", "contrast"]
    role_label: str
    explanation: str
    tea_id: str
    name: str
    region: str
    tags: list[str]
    personality_keywords: list[str]
    visual: VisualResponse


class SeedBatchResponse(ApiModel):
    mbti: MbtiCode | None
    items: list[SeedTeaResponse]


class FeedCardResponse(ApiModel):
    card_id: str
    tea_id: str
    name: str
    region: str
    tea_type: str
    personality_keywords: list[str]
    headline: str
    body: str
    tags: list[str]
    scene: str
    visual: VisualResponse


class FeedResponse(ApiModel):
    items: list[FeedCardResponse]
    next_cursor: str | None


class SwipeRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    card_id: str
    action: Literal["like", "skip", "save"]


class TeaSummaryResponse(ApiModel):
    tea_id: str
    name: str
    region: str
    tea_type: str
    professional_tags: list[str]
    personality_keywords: list[str]
    translation: str
    visual: VisualResponse


class RecommendationResponse(ApiModel):
    tea: TeaSummaryResponse
    reasons: list[str]
    rank_label: str = "当前推荐 #1"


class SwipeResponse(ApiModel):
    accepted: bool
    taste_profile: TasteProfileResponse
    reveal: TeaSummaryResponse | None = None
    recommendation: RecommendationResponse | None = None
    recommendation_ready: bool


class BrewingGuideResponse(ApiModel):
    vessel: str
    temperature_range: str
    tea_amount: str
    water_volume: str
    method: str
    steep_time: str | None = None
    notes: list[str]


class TeaJourneyResponse(ApiModel):
    tea_id: str
    brewed: bool
    tasted: bool
    realm_id: str | None = None
    realm_completed: bool
    next_step: Literal["brew", "taste", "realm", "passport"]


class TeaDetailResponse(TeaSummaryResponse):
    detail_visual: DetailVisualResponse
    representative_features: str
    aroma_and_taste: str
    official_description: str
    process: list[str]
    brewing_guide: BrewingGuideResponse
    evidence_ref_ids: list[str]
    evidence_refs: list[EvidenceRefResponse]
    realm_id: str | None = None
    journey: TeaJourneyResponse


class DrinkFeedbackRequest(ApiModel):
    tea_id: str
    result: Literal["like", "neutral", "dislike"]
    user_words: str | None = Field(default=None, max_length=500)
    infusion_number: int | None = Field(default=None, ge=1, le=20)


class PassportUpdate(ApiModel):
    saved: bool | None = None
    brewed: bool | None = None
    tasted: bool | None = None
    favorite_infusion: int | None = Field(default=None, ge=1, le=20)
    user_description: str | None = Field(default=None, max_length=500)
    normalized_tags: list[str] | None = None


class RealmAssetResponse(ApiModel):
    asset_id: str
    role: str
    url: str
    source_kind: Literal["ai_generated", "open_access_figure", "self_shot", "licensed_photo"]
    authenticity_state: Literal["synthetic_demo", "documentary", "reference"]
    rights_state: Literal["owned", "licensed", "open_license", "demo_only", "unknown"]
    rights_note: str
    credit: str | None = None
    evidence_ref_ids: list[str] = Field(default_factory=list)


class RealmSpecimenResponse(ApiModel):
    specimen_id: str
    realm_id: str
    name: str
    description: str
    asset: RealmAssetResponse
    collected_at: datetime


class PassportEntryResponse(ApiModel):
    tea: TeaSummaryResponse
    saved: bool
    brewed: bool
    tasted: bool
    realm_unlocked: bool
    favorite_infusion: int | None
    user_description: str | None
    normalized_tags: list[str]
    first_drunk_at: datetime | None
    realm_completed_at: datetime | None = None
    specimens: list[RealmSpecimenResponse] = Field(default_factory=list)
    updated_at: datetime


class PassportResponse(ApiModel):
    items: list[PassportEntryResponse]


class RealmSceneResponse(ApiModel):
    id: str
    eyebrow: str
    title: str
    instruction: str
    completion_copy: str
    interaction: str
    asset_ids: list[str]


class RealmEvidenceResponse(ApiModel):
    id: str
    label: str
    url: str
    status: Literal["verified", "debt"]
    supports: list[str]


class RealmDefinitionResponse(ApiModel):
    realm_id: str
    tea_id: str
    title: str
    subtitle: str
    region_id: str
    region_label: str
    scene_order: list[str]
    scenes: list[RealmSceneResponse]
    assets: list[RealmAssetResponse]
    specimen: dict[str, str]
    evidence_refs: list[RealmEvidenceResponse]


class RealmProgressResponse(ApiModel):
    realm_id: str
    tea_id: str
    status: Literal["available", "in_progress", "completed"]
    current_scene: str
    completed_scenes: list[str]
    interaction_mode: Literal["orientation", "pointer", "reducedMotion"] | None = None
    total_elapsed_ms: int
    replay_count: int
    started_at: datetime | None = None
    updated_at: datetime | None = None
    completed_at: datetime | None = None
    used_taste_words: bool = False


class RealmPersonalizationResponse(ApiModel):
    source: Literal["taste", "default"]
    intro_copy: str
    user_words: str | None = None
    normalized_tags: list[str] = Field(default_factory=list)


class RealmSummaryResponse(ApiModel):
    realm_id: str
    tea_id: str
    title: str
    subtitle: str
    region_id: str
    region_label: str
    progress: RealmProgressResponse
    specimen: RealmSpecimenResponse | None = None
    hero_asset: RealmAssetResponse


class RealmListResponse(ApiModel):
    items: list[RealmSummaryResponse]
    lit_region_ids: list[str]


class RealmDetailResponse(ApiModel):
    definition: RealmDefinitionResponse
    progress: RealmProgressResponse
    personalization: RealmPersonalizationResponse


class RealmStartRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    interaction_mode: Literal["orientation", "pointer", "reducedMotion"]
    fallback_reason: Literal["permission_denied", "unsupported", "desktop", "reduced_motion", "sensor_error"] | None = None
    replay: bool = False


class RealmProgressUpdate(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    completed_scene: str
    elapsed_ms: int = Field(default=0, ge=0, le=600000)


class RealmEventRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    event_type: Literal["realm_preview_opened", "realm_interaction_fallback_used", "realm_real_asset_revealed"]
    scene_id: str | None = None
    elapsed_ms: int | None = Field(default=None, ge=0, le=600000)
    interaction_mode: Literal["orientation", "pointer", "reducedMotion"] | None = None
    fallback_reason: Literal["permission_denied", "unsupported", "desktop", "reduced_motion", "sensor_error"] | None = None


class RealmMutationResponse(ApiModel):
    accepted: bool
    progress: RealmProgressResponse


class RealmCompleteRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    total_elapsed_ms: int = Field(default=0, ge=0, le=3600000)
    interaction_mode: Literal["orientation", "pointer", "reducedMotion"]


class RealmCompleteResponse(ApiModel):
    accepted: bool
    progress: RealmProgressResponse
    specimen: RealmSpecimenResponse
    passport_entry: PassportEntryResponse


class DrinkFeedbackResponse(ApiModel):
    taste_profile: TasteProfileResponse
    passport_entry: PassportEntryResponse


class TasteNormalizeRequest(ApiModel):
    tea_id: str
    text: str = Field(min_length=1, max_length=500)
    infusion_number: int | None = Field(default=None, ge=1, le=20)


class TasteNormalizeResponse(ApiModel):
    user_words: str
    normalized_tags: list[str]
    explanation: str
    provider_mode: Literal["ark_text", "server_mock"]
    taste_profile: TasteProfileResponse
    passport_entry: PassportEntryResponse


class TeaBtiFormationProgress(ApiModel):
    swipes_completed: int
    swipes_required: Literal[5]
    swipes_remaining: int
    positive_signal_completed: bool


class TeaBtiDialogueLine(ApiModel):
    speaker: str
    text: str


class TeaBtiContrast(ApiModel):
    claim: str
    reality: str


class TeaBtiScene(ApiModel):
    title: str
    lines: list[TeaBtiDialogueLine]


class TeaBtiEnemy(ApiModel):
    trigger: str
    reaction: str


class TeaBtiChemistry(ApiModel):
    partner_code: str
    partner_name: str
    lines: list[TeaBtiDialogueLine]
    summary: str


class TeaBtiPersonaDetail(ApiModel):
    punchline: str
    symptoms: list[str]
    contrasts: list[TeaBtiContrast]
    scenes: list[TeaBtiScene]
    enemies: list[TeaBtiEnemy]
    signature_moment: list[TeaBtiDialogueLine]
    never_say: str
    chemistry: TeaBtiChemistry


class TeaBtiBehaviorEvidence(ApiModel):
    kind: Literal["drink", "like", "save", "skip"]
    tea: TeaSummaryResponse
    user_words: str | None
    infusion_number: int | None


class TeaBtiResponse(ApiModel):
    state: Literal["forming", "early", "stable"]
    code: str | None
    persona_name: str | None
    persona_summary: str | None
    formation_progress: TeaBtiFormationProgress | None
    persona_detail: TeaBtiPersonaDetail | None
    behavior_evidence: list[TeaBtiBehaviorEvidence]
    axes: dict[str, float]
    evidence: list[str]


class ProfileBlockId(StrEnum):
    IDENTITY = "IDENTITY"
    MY_TEA = "MY_TEA"
    MY_WORDS = "MY_WORDS"
    TEA_PASSPORT = "TEA_PASSPORT"


class TeaProfileSettingsResponse(ApiModel):
    display_name: str
    bio: str
    selected_tea_id: str | None = None
    source_feedback_id: str | None = None
    public_quote: str | None = None
    public_block_ids: list[ProfileBlockId]
    updated_at: datetime


class ProfileBlockResponse(ApiModel):
    block_id: ProfileBlockId
    title: str
    is_public: bool
    is_complete: bool


class ProfileTeaCandidateResponse(ApiModel):
    tea: TeaSummaryResponse
    evidence_reasons: list[str]
    evidence_score: float


class ProfileQuoteCandidateResponse(ApiModel):
    feedback_id: str
    tea: TeaSummaryResponse
    text: str
    normalized_tags: list[str]
    infusion_number: int | None = None


class ProfileShareStateResponse(ApiModel):
    active: bool
    public_id: str | None = None
    public_path: str | None = None
    created_at: datetime | None = None
    revoked_at: datetime | None = None


class TeaProfileResponse(ApiModel):
    settings: TeaProfileSettingsResponse
    blocks: list[ProfileBlockResponse]
    tea_bti: TeaBtiResponse
    selected_tea: TeaSummaryResponse | None = None
    tea_candidates: list[ProfileTeaCandidateResponse]
    quote_candidates: list[ProfileQuoteCandidateResponse]
    passport: PassportResponse
    share: ProfileShareStateResponse


class TeaProfileUpdate(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=2, max_length=24)
    bio: str = Field(default="", max_length=80)
    selected_tea_id: str | None = None
    source_feedback_id: str | None = None
    public_quote: str | None = Field(default=None, max_length=120)
    public_block_ids: list[ProfileBlockId] = Field(default_factory=lambda: [ProfileBlockId.IDENTITY])


class TeaProfileMutationResponse(ApiModel):
    accepted: bool
    profile: TeaProfileResponse


class ProfileShareRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)


class PrivateProfileEventRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    event_type: Literal["tea_profile_viewed"]


class PublicProfileEventRequest(ApiModel):
    client_event_id: str = Field(min_length=1, max_length=80)
    event_type: Literal["public_profile_opened", "profile_cta_started"]


class ProfileEventResponse(ApiModel):
    accepted: bool


class PublicTeaBtiResponse(ApiModel):
    state: Literal["forming", "early", "stable"]
    code: str | None
    persona_name: str | None
    persona_summary: str | None
    formation_progress: TeaBtiFormationProgress | None
    axes: dict[str, float]
    evidence: list[str]


class PublicProfileIdentityResponse(ApiModel):
    display_name: str
    bio: str
    tea_bti: PublicTeaBtiResponse


class PublicProfileWordsResponse(ApiModel):
    text: str
    tea: TeaSummaryResponse
    normalized_tags: list[str]


class PublicProfileSpecimenResponse(ApiModel):
    specimen_id: str
    realm_id: str
    name: str
    description: str
    asset: RealmAssetResponse


class PublicProfilePassportItemResponse(ApiModel):
    tea: TeaSummaryResponse
    saved: bool
    brewed: bool
    tasted: bool
    realm_unlocked: bool
    specimens: list[PublicProfileSpecimenResponse]


class PublicProfilePassportResponse(ApiModel):
    items: list[PublicProfilePassportItemResponse]


class PublicTeaProfileResponse(ApiModel):
    public_id: str
    public_block_ids: list[ProfileBlockId]
    identity: PublicProfileIdentityResponse
    my_tea: TeaSummaryResponse | None = None
    my_words: PublicProfileWordsResponse | None = None
    tea_passport: PublicProfilePassportResponse | None = None
    updated_at: datetime


class ProfileShareMutationResponse(ApiModel):
    accepted: bool
    share: ProfileShareStateResponse
    public_profile: PublicTeaProfileResponse | None = None


class VoiceSessionCreate(ApiModel):
    mode: Literal["brew", "taste"]
    tea_id: str


class RtcJoinConfig(ApiModel):
    app_id: str
    room_id: str
    user_id: str
    token: str
    agent_user_id: str


class VoiceSessionResponse(ApiModel):
    voice_session_id: str
    provider_mode: Literal["volcengine_rtc", "browser_mock"]
    status: Literal["prepared", "starting", "active", "stopping", "completed", "failed", "expired", "cancelled"]
    expires_at: datetime
    welcome_message: str
    rtc: RtcJoinConfig | None = None


class VoiceContextUpdate(ApiModel):
    brew_stage: Literal["prepare", "warm_vessel", "add_leaves", "pour", "steep", "decant", "taste", "complete"] | None = None
    infusion_number: int | None = Field(default=None, ge=1, le=20)
    user_text: str | None = Field(default=None, min_length=1, max_length=500)


class VoiceTurnInput(ApiModel):
    client_turn_id: str = Field(min_length=1, max_length=80)
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=2000)
    started_at: datetime | None = None
    ended_at: datetime | None = None


class VoiceTurnsRequest(ApiModel):
    turns: list[VoiceTurnInput] = Field(max_length=50)


class VoiceTurnsResponse(ApiModel):
    accepted_count: int


class VoiceStopRequest(ApiModel):
    save_user_text: str | None = Field(default=None, max_length=500)
    infusion_number: int | None = Field(default=None, ge=1, le=20)


class VoiceStopResponse(ApiModel):
    status: Literal["completed"]
    experience_completed: bool
    journey: TeaJourneyResponse
    taste_result: TasteNormalizeResponse | None = None


class VoiceAbortResponse(ApiModel):
    status: Literal["cancelled"]


class ErrorBody(ApiModel):
    code: str
    message: str
    request_id: str
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(ApiModel):
    error: ErrorBody
