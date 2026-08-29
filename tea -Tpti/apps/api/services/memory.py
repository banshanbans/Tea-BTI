"""Memory / Tea Passport 服务（对应技术架构第 15 节）。

职责：把「喝过什么、怎么形容的、第几泡最喜欢、泡/品/解锁进度」落到库里，
供 AI 茶伴回答「你上次喝这款的时候觉得什么？」时直接查询，而不是凭记忆猜。

核心原则：
- 不依赖任何外部模型 / 网络；所有逻辑本地可跑。
- 「AI 翻译」= 规则 + 预设 fallback，并预留可插拔 provider 扩展点。
- AI 只翻译表达、不创造事实；客观信息来自种子数据。

本文件只提供纯函数，不定义 FastAPI 路由（由 Integrate 阶段接）。
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Callable, Optional

import numpy as np
from sqlalchemy.orm import Session

from models import SENSORY_DIMS, DrinkFeedback, Tea, TeaPassportEntry

# ---------------------------------------------------------------------------
# 时间戳
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """返回当前时间的 ISO 字符串（与 String 类型时间戳列一致）。"""
    return datetime.now().isoformat()


# ---------------------------------------------------------------------------
# numpy 向量工具
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    """两个向量的余弦相似度（numpy）。

    任一为空或模长为 0 时返回 0.0，不抛异常。
    """
    if a is None or b is None:
        return 0.0
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    if va.shape != vb.shape or va.size == 0:
        return 0.0
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0.0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def _as_vector(vec: list | None) -> np.ndarray:
    """把任意长度感官向量补齐/截断为固定 9 维 numpy 数组。"""
    if not vec:
        return np.zeros(len(SENSORY_DIMS), dtype=float)
    v = list(vec)
    if len(v) < len(SENSORY_DIMS):
        v += [0.0] * (len(SENSORY_DIMS) - len(v))
    return np.asarray(v[: len(SENSORY_DIMS)], dtype=float)


# normalized tag -> 命中的感官维度（用于把「茶语」映射回向量）
TAG_TO_DIMS: dict[str, list[str]] = {
    "鲜爽": ["freshness"],
    "清鲜": ["freshness", "clean"],
    "轻盈": ["clean"],
    "甜润": ["sweetness"],
    "甜香": ["sweetness", "floral"],
    "柔和": ["sweetness"],
    "醇厚": ["body", "roast"],
    "温熟": ["roast", "body"],
    "绵长": ["aftertaste", "body"],
    "回甘": ["aftertaste"],
    "花香": ["floral"],
    "果香": ["fruity"],
    "干净": ["clean"],
    "涩": ["astringency"],
    "焙火": ["roast"],
}

# 维度名 -> 固定 9 维下标
_DIM_INDEX = {name: i for i, name in enumerate(SENSORY_DIMS)}


def tags_to_sensory_vector(tags: list[str], normalize: bool = True) -> list[float]:
    """把一组归一化茶语映射成 9 维指示向量（numpy）。

    命中维度置 1（重复命中仍为 1，表示「是否出现该感受」）；
    normalize=True 时做 L2 归一化，便于与茶的感官向量做余弦比较。
    """
    vec = np.zeros(len(SENSORY_DIMS), dtype=float)
    for tag in tags or []:
        for dim in TAG_TO_DIMS.get(tag, []):
            idx = _DIM_INDEX.get(dim)
            if idx is not None:
                vec[idx] = 1.0
    if normalize and float(np.linalg.norm(vec)) > 0.0:
        vec = vec / np.linalg.norm(vec)
    return vec.tolist()


# ---------------------------------------------------------------------------
# 「AI 翻译」：口语 -> 归一化茶语（规则 + provider 扩展点）
# ---------------------------------------------------------------------------

# 规则词典：归一化 tag -> 口语关键词（与前端茶文案 / 感官词对齐）
NORMALIZE_KEYWORDS: dict[str, list[str]] = {
    "回甘": ["回甘", "回甜", "甘甜", "尾甜", "甜韵", "留甜"],
    "鲜爽": ["鲜", "鲜爽", "清鲜", "鲜甜", "爽"],
    "清鲜": ["清鲜", "清新", "鲜灵"],
    "轻盈": ["轻盈", "清淡", "不厚重", "轻薄"],
    "醇厚": ["醇厚", "厚重", "饱满", "存在感", "厚"],
    "温熟": ["温", "暖", "温熟", "温润", "熟"],
    "绵长": ["绵长", "悠长", "停得久", "尾韵长", "耐泡", "长"],
    "甜香": ["甜香", "香甜"],
    "甜润": ["甜润", "踏实", "晒过太阳"],
    "花香": ["花香", "茉莉", "兰花", "桂花", "兰香"],
    "果香": ["果香", "蜜香", "枣香", "蜜"],
    "干净": ["干净", "清泉", "无杂", "透", "清澈", "清甜"],
    "柔和": ["柔和", "柔", "顺", "不刺激"],
    "涩": ["涩", "收敛", "麻"],
    "焙火": ["焙火", "焦", "烘", "火味", "炭"],
}

# 归一化 provider 注册表（扩展点：可插入真实 LLM 实现）
_normalizer_impls: dict[str, Callable[[str, Optional[str]], list[str]]] = {}

# 环境变量开关：TASTE_NORMALIZER_PROVIDER（默认 "rules"）
NORMALIZER_PROVIDER_ENV = "TASTE_NORMALIZER_PROVIDER"


def _rules_normalize(user_words: str) -> list[str]:
    """规则版归一化：关键词匹配，按出现顺序返回命中的茶语。"""
    if not user_words:
        return []
    text = user_words.strip()
    hit_positions: list[tuple[int, str]] = []
    for tag, keywords in NORMALIZE_KEYWORDS.items():
        pos = min((text.find(kw) for kw in keywords if kw in text), default=-1)
        if pos >= 0:
            hit_positions.append((pos, tag))
    # 按用户提到这些感受的先后排序，稳定输出
    hit_positions.sort(key=lambda item: item[0])
    return [tag for _, tag in hit_positions]


def register_normalizer(provider: str, fn: Callable[[str, Optional[str]], list[str]]) -> None:
    """注册一个归一化 provider（真实 LLM 时调用）。

    实现约定：fn(user_words, model=None) -> list[str]。
    """
    _normalizer_impls[provider] = fn


def normalize_user_words(
    user_words: str,
    *,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> list[str]:
    """把用户口语翻译成归一化茶语。

    provider 默认取环境变量 TASTE_NORMALIZER_PROVIDER，再回落到 "rules"。
    demo 阶段只实现规则版；接入真实 VLM/LLM 时 register_normalizer 注册实现即可，
    未命中或实现抛异常时优雅降级为规则版。
    """
    provider = provider or os.getenv(NORMALIZER_PROVIDER_ENV, "rules")
    if provider in _normalizer_impls:
        try:
            return _normalizer_impls[provider](user_words, model)
        except Exception:
            return _rules_normalize(user_words)
    return _rules_normalize(user_words)


# ---------------------------------------------------------------------------
# Tea Passport 写 / 读
# ---------------------------------------------------------------------------

_PASSPORT_TEXT_FIELDS = ("favorite_infusion", "user_description", "normalized_tags")
_PASSPORT_FLAG_FIELDS = ("brewed", "tasted", "realm_unlocked")


def add_passport_entry(
    db: Session,
    user_id: str,
    tea_id: str,
    **kwargs,
) -> TeaPassportEntry:
    """写入 / 更新一条茶护照条目（upsert）。

    - 不存在：创建，first_drunk_at 默认当前时间（可用 kwargs["first_drunk_at"] 覆盖）。
    - 已存在：仅更新传入的字段（favorite_infusion / user_description / normalized_tags
      以及 brewed / tasted / realm_unlocked 三个布尔）。
    """
    entry = db.get(TeaPassportEntry, (user_id, tea_id))

    if entry is None:
        first_drunk_at = kwargs.get("first_drunk_at") or _now_iso()
        entry = TeaPassportEntry(
            user_id=user_id,
            tea_id=tea_id,
            first_drunk_at=first_drunk_at,
        )
        db.add(entry)
        db.flush()
    elif kwargs.get("first_drunk_at"):
        entry.first_drunk_at = kwargs["first_drunk_at"]

    for field in _PASSPORT_TEXT_FIELDS:
        if field in kwargs and kwargs[field] is not None:
            setattr(entry, field, kwargs[field])
    for flag in _PASSPORT_FLAG_FIELDS:
        if flag in kwargs:
            setattr(entry, flag, bool(kwargs[flag]))

    db.commit()
    db.refresh(entry)
    return entry


def get_passport(db: Session, user_id: str) -> list[TeaPassportEntry]:
    """返回某用户全部护照条目（按首次饮用时间倒序）。

    附带 tea 详情联查：每条 entry 上挂一个瞬态属性 entry.tea（Tea 或 None）。
    """
    entries = (
        db.query(TeaPassportEntry)
        .filter(TeaPassportEntry.user_id == user_id)
        .order_by(TeaPassportEntry.first_drunk_at.desc())
        .all()
    )
    tea_ids = {e.tea_id for e in entries}
    teas = (
        {t.id: t for t in db.query(Tea).filter(Tea.id.in_(tea_ids)).all()}
        if tea_ids
        else {}
    )
    for e in entries:
        e.tea = teas.get(e.tea_id)
    return entries


def mark_brewed(db: Session, user_id: str, tea_id: str) -> TeaPassportEntry:
    """标记「已泡过」。"""
    return add_passport_entry(db, user_id, tea_id, brewed=True)


def mark_tasted(db: Session, user_id: str, tea_id: str) -> TeaPassportEntry:
    """标记「已品过」。"""
    return add_passport_entry(db, user_id, tea_id, tasted=True)


def mark_realm_unlocked(db: Session, user_id: str, tea_id: str) -> TeaPassportEntry:
    """标记「已解锁茶境」。"""
    return add_passport_entry(db, user_id, tea_id, realm_unlocked=True)


# ---------------------------------------------------------------------------
# 真喝反馈 / 历史（供 AI 茶伴回忆）
# ---------------------------------------------------------------------------

def record_drink_feedback(
    db: Session,
    user_id: str,
    tea_id: str,
    result: str,
    user_words: Optional[str] = None,
    normalized_tags: Optional[list[str]] = None,
    infusion_number: Optional[int] = None,
) -> DrinkFeedback:
    """写一条真喝反馈并返回。

    - result ∈ {"like", "neutral", "dislike"}。
    - 若给了 user_words 但未给 normalized_tags，则用规则版归一化补齐（AI 翻译 fallback）。
    """
    if not normalized_tags and user_words:
        normalized_tags = normalize_user_words(user_words)

    feedback = DrinkFeedback(
        user_id=user_id,
        tea_id=tea_id,
        result=result,
        user_words=user_words,
        normalized_tags=normalized_tags or None,
        infusion_number=infusion_number,
        timestamp=_now_iso(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def get_history(
    db: Session,
    user_id: str,
    tea_id: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[DrinkFeedback]:
    """返回用户真喝反馈历史（按时间倒序）。

    可选按 tea_id 过滤、用 limit 截断，供 AI 茶伴回答「上次怎么形容」。
    """
    q = (
        db.query(DrinkFeedback)
        .filter(DrinkFeedback.user_id == user_id)
        .order_by(DrinkFeedback.timestamp.desc())
    )
    if tea_id:
        q = q.filter(DrinkFeedback.tea_id == tea_id)
    if limit:
        q = q.limit(limit)
    return q.all()


def get_last_feedback(
    db: Session,
    user_id: str,
    tea_id: str,
) -> DrinkFeedback | None:
    """某用户最近一次喝某款茶的反馈（None 表示还没记录）。"""
    return (
        db.query(DrinkFeedback)
        .filter(
            DrinkFeedback.user_id == user_id,
            DrinkFeedback.tea_id == tea_id,
        )
        .order_by(DrinkFeedback.timestamp.desc())
        .first()
    )


def similar_teas_by_tags(
    db: Session,
    tags: list[str],
    top_k: int = 3,
) -> list[Tea]:
    """按「茶语」回想相似的茶（numpy 余弦相似度）。

    把 tags 映射成指示向量，与每款茶的感官向量做余弦比较，返回最接近的 top_k 款。
    供 AI 茶伴表达「这杯很像你上次喜欢的那类」时使用。
    """
    query_vec = np.asarray(tags_to_sensory_vector(tags, normalize=True), dtype=float)
    teas = db.query(Tea).all()
    scored: list[tuple[float, Tea]] = []
    for tea in teas:
        sim = cosine_similarity(query_vec.tolist(), _as_vector(tea.sensory_vector).tolist())
        scored.append((sim, tea))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [tea for _, tea in scored[:top_k]]
