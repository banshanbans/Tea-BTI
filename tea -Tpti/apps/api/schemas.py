"""Pydantic v2 请求/响应模型。

字段对齐技术架构第 19 节 API 草案。
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Tea / 盲品卡片
# ---------------------------------------------------------------------------

class BlindCopy(BaseModel):
    headline: str
    description: str
    scene: str
    tags: list[str] = Field(default_factory=list)


class BrewingGuide(BaseModel):
    vessel: str
    temperature_range: Optional[str] = None
    steep_time: Optional[str] = None
    notes: list[str] = Field(default_factory=list)


class TeaOut(BaseModel):
    id: str
    name: str
    region: str
    tea_type: str
    emoji: Optional[str] = None
    official_aroma: list[str] = Field(default_factory=list)
    official_taste: list[str] = Field(default_factory=list)
    process: list[str] = Field(default_factory=list)
    sensory_vector: list[float] = Field(default_factory=list)
    blind_copy: BlindCopy
    brewing_guide: BrewingGuide


def tea_out_from_model(tea) -> TeaOut:
    """把 Tea ORM 模型转成 TeaOut（from_attributes 读取同名属性）。"""
    return TeaOut.model_validate(tea, from_attributes=True)


# ---------------------------------------------------------------------------
# Swipe
# ---------------------------------------------------------------------------

class SwipeIn(BaseModel):
    user_id: str
    tea_id: str
    action: Literal["like", "skip", "save"]


class TasteProfileDelta(BaseModel):
    """一次 swipe 后 9 维偏好的变化量。"""
    freshness: float = 0.0
    sweetness: float = 0.0
    body: float = 0.0
    roast: float = 0.0
    astringency: float = 0.0
    floral: float = 0.0
    fruity: float = 0.0
    clean: float = 0.0
    aftertaste: float = 0.0


class SwipeOut(BaseModel):
    taste_profile_delta: TasteProfileDelta
    next_tea: Optional[TeaOut] = None
    recommendation_ready: bool = False


# ---------------------------------------------------------------------------
# Recommendation
# ---------------------------------------------------------------------------

class RecommendationOut(BaseModel):
    user_id: str
    teas: list[TeaOut] = Field(default_factory=list)
    confidence_state: str = "forming"
    exploration_bonus: float = 0.15


# ---------------------------------------------------------------------------
# Drink Feedback
# ---------------------------------------------------------------------------

class DrinkFeedbackIn(BaseModel):
    user_id: str
    tea_id: str
    result: Literal["like", "neutral", "dislike"]
    user_words: Optional[str] = None
    normalized_tags: Optional[list[str]] = None
    infusion_number: Optional[int] = None


class DrinkFeedbackOut(BaseModel):
    id: int
    user_id: str
    tea_id: str
    result: str
    user_words: Optional[str] = None
    normalized_tags: Optional[list[str]] = None
    infusion_number: Optional[int] = None
    timestamp: str


# ---------------------------------------------------------------------------
# Taste Normalize（语义归一化）
# ---------------------------------------------------------------------------

class TasteNormalizeIn(BaseModel):
    user_id: Optional[str] = None
    tea_id: Optional[str] = None
    user_words: str
    infusion_number: Optional[int] = None


class TasteNormalizeOut(BaseModel):
    user_words: str
    normalized: list[str] = Field(default_factory=list)
    explanation: str = ""


# ---------------------------------------------------------------------------
# Brew Vision（帧分析）
# ---------------------------------------------------------------------------

class BrewFrameIn(BaseModel):
    user_id: Optional[str] = None
    tea_id: Optional[str] = None
    frame: Optional[str] = None  # 采样帧（base64 编码，demo 阶段忽略像素内容）
    frame_b64: Optional[str] = None  # 兼容旧字段名
    step_hint: Optional[str] = None  # 投茶/注水/等待/出汤/完成


class BrewFrameOut(BaseModel):
    state: Literal[
        "EMPTY", "TEA_VISIBLE", "POURING", "STEEPING", "DECANTING", "FINISHED"
    ] = "TEA_VISIBLE"
    confidence: float = 0.0
    message: str = ""
    observations: list[str] = Field(default_factory=list)
    uncertain: list[str] = Field(default_factory=list)
    suggestion: str = ""


# ---------------------------------------------------------------------------
# Tea Passport
# ---------------------------------------------------------------------------

class PassportIn(BaseModel):
    user_id: str
    tea_id: str
    first_drunk_at: Optional[str] = None
    favorite_infusion: Optional[int] = None
    user_description: Optional[str] = None
    normalized_tags: Optional[list[str]] = None
    brewed: bool = False
    tasted: bool = False
    realm_unlocked: bool = False


class PassportOut(BaseModel):
    user_id: str
    tea_id: str
    first_drunk_at: str
    favorite_infusion: Optional[int] = None
    user_description: Optional[str] = None
    normalized_tags: Optional[list[str]] = None
    brewed: bool = False
    tasted: bool = False
    realm_unlocked: bool = False
    tea: Optional[TeaOut] = None


# ---------------------------------------------------------------------------
# Tea-BTI
# ---------------------------------------------------------------------------

class TeaBtiAxes(BaseModel):
    light_full: int = 50       # Light ←→ Full
    fresh_warm: int = 50       # Fresh ←→ Warm
    sweet_punchy: int = 50     # Soft/Sweet ←→ Punchy
    clean_long: int = 50       # Clean ←→ Long


class TeaBtiOut(BaseModel):
    user_id: str
    axes: TeaBtiAxes
    archetype: str = ""
    archetype_name: str = ""
    confidence_state: str = "forming"
    confidence_label: str = ""
    explanation: str = ""
    evidence: list[dict] = Field(default_factory=list)
