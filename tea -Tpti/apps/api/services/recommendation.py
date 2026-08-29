"""推荐服务（对应技术架构第 8 节）。

职责：Cold Start 多样性 Feed、Taste Vector 更新、以及最终排序推荐。
全部逻辑本地可跑，不依赖任何外部模型 / 网络：

- 冷启动：多样性优先，用 pairwise 距离贪心选出感官差异最大的前若干款。
- Taste Vector 更新：按权重把 swipe / 真喝反馈叠加到 9 维偏好向量上，
  sample_count 累加，confidence_state 按 0-5 forming / 6-15 early / 16+ stable 更新。
- 最终排序：score = 0.55 * sensory_similarity + 0.30 * embedding_similarity
  + 0.15 * exploration_bonus；无 embedding 时 embedding 项退化为 sensory 相似度。

「AI 翻译」扩展点：推荐理由文案默认走本地规则 fallback，可插拔真实 LLM
（见 explain_recommendation / RECOMMEND_EXPLAIN_PROVIDER）。客观数值全部来自
种子数据的 sensory_vector / 用户累积的 Taste Vector，文案使用「看起来 / 大约」
等模糊措辞，不假装精确。

纯函数约定：除需要读库 / 写库的函数外（首参为 Session，与 tea_profile.py /
memory.py / teabti.py 约定一致），其余均为无副作用的纯函数。
本文件只提供函数，不定义 FastAPI 路由（由 Integrate 阶段接）。
"""

from __future__ import annotations

import os
from typing import Callable, Optional, Sequence

import numpy as np
from sqlalchemy.orm import Session

from models import SENSORY_DIMS, DrinkFeedback, SwipeEvent, Tea, UserTasteProfile

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 最终排序权重（技术架构 8.5）
SENSORY_WEIGHT = 0.55
EMBEDDING_WEIGHT = 0.30
EXPLORATION_WEIGHT = 0.15

# 动作权重（技术架构 8.3）：真喝反馈权重大于 swipe
# action ∈ swipe("like"/"save"/"skip") + 真喝("drink_like"/"drink_dislike")；
# neutral / drink_neutral 视为无方向信号，权重 0（不更新、不计入样本）。
ACTION_WEIGHTS: dict[str, float] = {
    "like": 1.0,
    "save": 1.5,
    "skip": -0.5,
    "drink_like": 3.0,
    "drink_dislike": -3.0,
    "neutral": 0.0,
    "drink_neutral": 0.0,
}

# 探索加成：冷启动期更高，样本越多越低（技术架构 8.5「前期提高 exploration_bonus」）
EXPLORATION_BONUS_COLD = 0.25   # 无任何信号
EXPLORATION_BONUS_EARLY = 0.15  # 0 < n <= 5
EXPLORATION_BONUS_MID = 0.08    # 5 < n <= 15
EXPLORATION_BONUS_STABLE = 0.04  # n > 15

# 推荐理由文案的 provider 开关：默认 "rules"（本地规则，离线可用）；
# 未来接入真实 LLM 时设为环境变量 RECOMMEND_EXPLAIN_PROVIDER=<provider> 即可。
EXPLAIN_PROVIDER = os.getenv("RECOMMEND_EXPLAIN_PROVIDER", "rules").strip().lower()

# 维度中文名（用于「AI 翻译」：把数值转成人话）
DIM_LABELS: dict[str, str] = {
    "freshness": "鲜爽",
    "sweetness": "甜润",
    "body": "醇厚",
    "roast": "焙火",
    "astringency": "涩感",
    "floral": "花香",
    "fruity": "果香",
    "clean": "干净",
    "aftertaste": "回甘",
}


# ---------------------------------------------------------------------------
# numpy 向量工具
# ---------------------------------------------------------------------------

def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """用 numpy 计算两个向量的余弦相似度。

    任一向量为零向量或维度不一致时返回 0.0，不抛异常。
    """
    a_np = np.asarray(a, dtype=float)
    b_np = np.asarray(b, dtype=float)
    if a_np.shape != b_np.shape or a_np.size == 0:
        return 0.0
    denom = float(np.linalg.norm(a_np) * np.linalg.norm(b_np))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a_np, b_np) / denom)


def _as_sensory_vector(vec: Sequence[float] | None) -> np.ndarray:
    """把任意长度感官向量补齐 / 截断为固定 9 维 numpy 数组。"""
    if not vec:
        return np.zeros(len(SENSORY_DIMS), dtype=float)
    v = list(vec)
    if len(v) < len(SENSORY_DIMS):
        v += [0.0] * (len(SENSORY_DIMS) - len(v))
    return np.asarray(v[: len(SENSORY_DIMS)], dtype=float)


def _euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """两个感官向量的欧氏距离（衡量「差异大」）。"""
    return float(np.linalg.norm(a - b))


def _embedding_vector(embedding: Sequence[float]) -> np.ndarray | None:
    """把 embedding 转成 1-D numpy 数组；非法（空 / 非一维）返回 None。"""
    arr = np.asarray(embedding, dtype=float)
    if arr.ndim != 1 or arr.size == 0:
        return None
    return arr


# ---------------------------------------------------------------------------
# 稳定度 / 探索加成
# ---------------------------------------------------------------------------

def confidence_state(sample_count: int) -> str:
    """由信号数量返回稳定度代码。

    0-5  -> forming（正在形成）
    6-15 -> early（初见）
    16+  -> stable（逐渐稳定）
    """
    if sample_count <= 5:
        return "forming"
    if sample_count <= 15:
        return "early"
    return "stable"


def exploration_bonus(sample_count: int) -> float:
    """返回探索加成值（0 ~ 1 区间，用于最终排序的 exploration 项）。

    冷启动期（0 样本）最高 0.25，样本越多越低，让推荐逐渐从「探索」转向「匹配」。
    """
    if sample_count <= 0:
        return EXPLORATION_BONUS_COLD
    if sample_count <= 5:
        return EXPLORATION_BONUS_EARLY
    if sample_count <= 15:
        return EXPLORATION_BONUS_MID
    return EXPLORATION_BONUS_STABLE


# ---------------------------------------------------------------------------
# Taste Profile 读写
# ---------------------------------------------------------------------------

def get_taste_profile(db: Session, user_id: str) -> dict:
    """返回某用户的 9 维 Taste Vector 及统计信息（不落库）。

    不存在时返回零向量 + forming + sample_count=0（冷启动）。

    返回结构：
    {
      "user_id": str,
      "vector": [9 维浮点],
      "freshness"/"sweetness"/.../ "aftertaste": 各维度浮点（与 vector 对齐）,
      "sample_count": int,
      "confidence_state": "forming" | "early" | "stable",
    }
    """
    profile = db.get(UserTasteProfile, user_id)
    if profile is None:
        return {
            "user_id": user_id,
            **{dim: 0.0 for dim in SENSORY_DIMS},
            "vector": [0.0] * len(SENSORY_DIMS),
            "sample_count": 0,
            "confidence_state": "forming",
        }
    vector = profile.as_vector()
    state = profile.confidence_state or confidence_state(profile.sample_count)
    return {
        "user_id": user_id,
        **{dim: float(vector[i]) for i, dim in enumerate(SENSORY_DIMS)},
        "vector": vector,
        "sample_count": profile.sample_count or 0,
        "confidence_state": state,
    }


def update_taste_profile(
    db: Session,
    user_id: str,
    action: str,
    tea_id: str,
) -> dict:
    """按权重把一次信号叠加到 UserTasteProfile，返回变化量与更新后的统计。

    公式（技术架构 8.3）：
        User Vector += tea.sensory_vector × action_weight
    其中 weight：skip -0.5 / like +1 / save +1.5 / drink_like +3 / drink_dislike -3。

    - 不存在的用户自动创建 profile。
    - 未知 tea_id 或未知 action（权重 0）不产生信号，返回零变化、不增样本。
    - sample_count 累加 1；confidence_state 按 0-5 / 6-15 / 16+ 更新。

    返回结构（9 维 delta 键与 schemas.TasteProfileDelta 对齐，另附统计）：
    {
      "freshness"/.../ "aftertaste": 本次各维度变化量（float）,
      "vector": 更新后的 9 维向量,
      "sample_count": int,
      "confidence_state": str,
    }
    """
    weight = ACTION_WEIGHTS.get(action, 0.0)
    tea = db.get(Tea, tea_id)

    if tea is None or weight == 0.0:
        # 无效信号：不更新、不增样本
        existing = db.get(UserTasteProfile, user_id)
        sample = (existing.sample_count or 0) if existing else 0
        state = (
            (existing.confidence_state or confidence_state(sample))
            if existing
            else "forming"
        )
        return {
            **{dim: 0.0 for dim in SENSORY_DIMS},
            "vector": existing.as_vector() if existing else [0.0] * len(SENSORY_DIMS),
            "sample_count": sample,
            "confidence_state": state,
        }

    profile = db.get(UserTasteProfile, user_id)
    if profile is None:
        # 显式初始化 9 维为 0（列 default 只在 INSERT 时生效，实例化时仍为 None）
        profile = UserTasteProfile(
            user_id=user_id,
            sample_count=0,
            confidence_state="forming",
            **{dim: 0.0 for dim in SENSORY_DIMS},
        )
        db.add(profile)

    tea_vector = _as_sensory_vector(tea.sensory_vector)
    delta = tea_vector * weight
    new_vector = np.asarray(profile.as_vector(), dtype=float) + delta

    # 写回 9 维 + 统计（不 mutate，整体覆盖属性值）
    for i, dim in enumerate(SENSORY_DIMS):
        setattr(profile, dim, float(new_vector[i]))
    profile.sample_count = (profile.sample_count or 0) + 1
    profile.confidence_state = confidence_state(profile.sample_count)

    db.commit()
    db.refresh(profile)

    return {
        **{dim: float(delta[i]) for i, dim in enumerate(SENSORY_DIMS)},
        "vector": profile.as_vector(),
        "sample_count": profile.sample_count,
        "confidence_state": profile.confidence_state,
    }


# ---------------------------------------------------------------------------
# 冷启动 Feed（多样性优先）
# ---------------------------------------------------------------------------

def cold_start_feed(
    db: Session,
    seen_tea_ids: Optional[Sequence[str]] = None,
    count: int = 5,
) -> list[str]:
    """冷启动 Feed：多样性优先，返回感官差异大的 tea_id 列表。

    算法（farthest-point sampling 贪心）：
    1. 候选 = 所有未在 seen_tea_ids 中的茶。
    2. 种子 = 距候选质心最远的那款（先端出「最不中庸」的一杯）。
    3. 反复选择「到已选集合最小距离最大」的茶，直到凑满 count 或候选耗尽。
    距离用 9 维 sensory_vector 的欧氏距离，让前若干张覆盖不同 taste region。

    返回：tea_id 列表（数量 ≤ count，候选不足时返回全部候选）。
    """
    seen = set(seen_tea_ids or [])
    teas = [t for t in db.query(Tea).all() if t.id not in seen]
    if not teas or count <= 0:
        return []

    vectors: dict[str, np.ndarray] = {t.id: _as_sensory_vector(t.sensory_vector) for t in teas}
    ids = [t.id for t in teas]

    # 种子：距质心最远
    all_vecs = np.asarray([vectors[i] for i in ids], dtype=float)
    centroid = all_vecs.mean(axis=0)
    dist_to_centroid = [float(np.linalg.norm(vectors[i] - centroid)) for i in ids]
    seed = ids[int(np.argmax(dist_to_centroid))]

    selected: list[str] = [seed]
    remaining: list[str] = [i for i in ids if i != seed]

    while len(selected) < count and remaining:
        # max-min 多样性别贪心：选「到已选集合的最小距离」最大的那款
        best_id = remaining[0]
        best_dist = -1.0
        for cand in remaining:
            min_d = min(_euclidean_distance(vectors[cand], vectors[s]) for s in selected)
            if min_d > best_dist:
                best_dist = min_d
                best_id = cand
        selected.append(best_id)
        remaining.remove(best_id)

    return selected


# ---------------------------------------------------------------------------
# 最终排序推荐
# ---------------------------------------------------------------------------

def _seen_tea_ids(db: Session, user_id: str) -> set[str]:
    """该用户已交互过（swipe 或真喝反馈）的 tea_id 集合。"""
    seen: set[str] = set()
    for ev in db.query(SwipeEvent).filter(SwipeEvent.user_id == user_id).all():
        seen.add(ev.tea_id)
    for fb in db.query(DrinkFeedback).filter(DrinkFeedback.user_id == user_id).all():
        seen.add(fb.tea_id)
    return seen


def _user_embedding(db: Session, user_id: str) -> np.ndarray | None:
    """按技术架构 8.4 计算用户 embedding = mean(liked embeddings) - mean(disliked embeddings)。

    正面：swipe like/save + 真喝 like；负面：swipe skip + 真喝 dislike。
    忽略没有 embedding 的茶；若没有任何有效 embedding 返回 None（demo 全部如此，
    此时 embedding 项退化为 sensory 相似度）。
    """
    liked: list[np.ndarray] = []
    disliked: list[np.ndarray] = []

    def _collect(tea_id: str, positive: bool) -> None:
        tea = db.get(Tea, tea_id)
        if tea is None or not tea.embedding:
            return
        emb = _embedding_vector(tea.embedding)
        if emb is None:
            return
        (liked if positive else disliked).append(emb)

    for ev in db.query(SwipeEvent).filter(SwipeEvent.user_id == user_id).all():
        if ev.action in ("like", "save"):
            _collect(ev.tea_id, True)
        elif ev.action == "skip":
            _collect(ev.tea_id, False)

    for fb in db.query(DrinkFeedback).filter(DrinkFeedback.user_id == user_id).all():
        if fb.result == "like":
            _collect(fb.tea_id, True)
        elif fb.result == "dislike":
            _collect(fb.tea_id, False)

    all_embs = liked + disliked
    if not all_embs:
        return None

    # 防御：统一到第一条 embedding 的维度，剔除不一致的（真实 provider 下维度应一致）
    dim = int(all_embs[0].size)
    liked = [e for e in liked if e.size == dim]
    disliked = [e for e in disliked if e.size == dim]
    if not liked and not disliked:
        return None

    pos = np.mean(liked, axis=0) if liked else np.zeros(dim, dtype=float)
    neg = np.mean(disliked, axis=0) if disliked else np.zeros(dim, dtype=float)
    return pos - neg


def _embedding_similarity(
    tea_embedding: Sequence[float] | None,
    user_embedding: np.ndarray | None,
    sensory_similarity: float,
) -> float:
    """embedding 相似度；无 embedding 时退化为 sensory_similarity（技术架构 8.4/8.5）。"""
    if tea_embedding is None or user_embedding is None:
        return sensory_similarity
    tea_emb = _embedding_vector(tea_embedding)
    if tea_emb is None:
        return sensory_similarity
    return cosine_similarity(user_embedding, tea_emb)


def recommend(
    db: Session,
    user_id: str,
    exclude_ids: Optional[Sequence[str]] = None,
    top_k: int = 1,
    model: Optional[str] = None,
) -> list[str]:
    """最终排序推荐，返回得分最高的 top_k 个 tea_id。

    score = 0.55 * sensory_similarity + 0.30 * embedding_similarity
            + 0.15 * exploration_bonus

    - sensory_similarity：用户 Taste Vector 与茶 sensory_vector 的余弦相似度。
    - embedding_similarity：用户 embedding 与茶 embedding 的余弦相似度；
      无 embedding（demo）时退化为 sensory_similarity。
    - exploration_bonus：仅对用户未见过的茶加一个固定小值（冷启动期更高），
      见过 / 排除的茶该项为 0，促使冷启动阶段多探索。

    ``model`` 为预留的 embedding model 参数（provider 扩展点）；demo 阶段忽略。
    """
    profile = get_taste_profile(db, user_id)
    user_vector = np.asarray(profile["vector"], dtype=float)
    sample_count = profile["sample_count"]

    exclude = set(exclude_ids or [])
    seen = _seen_tea_ids(db, user_id)
    bonus = exploration_bonus(sample_count)
    user_emb = _user_embedding(db, user_id)

    teas = [t for t in db.query(Tea).all() if t.id not in exclude]

    scored: list[tuple[float, str]] = []
    for tea in teas:
        tea_vector = _as_sensory_vector(tea.sensory_vector)
        sensory_sim = cosine_similarity(user_vector, tea_vector)
        embed_sim = _embedding_similarity(tea.embedding, user_emb, sensory_sim)
        expl = bonus if tea.id not in seen else 0.0
        score = (
            SENSORY_WEIGHT * sensory_sim
            + EMBEDDING_WEIGHT * embed_sim
            + EXPLORATION_WEIGHT * expl
        )
        scored.append((score, tea.id))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [tea_id for _, tea_id in scored[:top_k]]


# ---------------------------------------------------------------------------
# 推荐理由文案（「AI 翻译」扩展点）
# ---------------------------------------------------------------------------

# 归一化 provider 注册表（扩展点：可插入真实 LLM 实现）
_explain_impls: dict[str, Callable[[Session, str, str, Optional[str]], str]] = {}


def register_explain_provider(
    provider: str,
    fn: Callable[[Session, str, str, Optional[str]], str],
) -> None:
    """注册一个推荐理由 provider（接入真实 LLM 时调用）。

    实现约定：fn(db, user_id, tea_id, model=None) -> str。
    """
    _explain_impls[provider] = fn


def _rule_reason(db: Session, user_id: str, tea_id: str) -> str:
    """规则版推荐理由：找用户偏好高且茶也高的维度，转成模糊中文。"""
    profile = get_taste_profile(db, user_id)
    if profile["sample_count"] <= 0:
        return "我还不了解你的口味，先按差异大一点的顺序给你，多刷几杯就能慢慢懂你。"

    tea = db.get(Tea, tea_id)
    if tea is None:
        return "这杯可以先试试看。"

    user_vec = np.asarray(profile["vector"], dtype=float)
    tea_vec = _as_sensory_vector(tea.sensory_vector)

    # 用户偏好高 × 茶也高 的维度最「对味」
    contribution = user_vec * tea_vec
    order = np.argsort(-contribution)
    top_dims = [SENSORY_DIMS[i] for i in order[:3] if contribution[i] > 0]

    if not top_dims:
        return "这杯和你之前喝过的都不太一样，可以当一次新体验。"

    labels = "、".join(DIM_LABELS[d] for d in top_dims)
    return f"这一杯看起来在「{labels}」上和你的偏好比较接近。"


def explain_recommendation(
    db: Session,
    user_id: str,
    tea_id: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """生成一条推荐理由文案（唯一「AI 翻译」扩展点）。

    默认走本地规则 fallback（离线可用）；接入真实 LLM 时 register_explain_provider
    注册实现即可，未命中或实现抛异常时优雅降级为规则版。客观数值仍来自 Taste Vector
    与茶 sensory_vector，模型只负责「表达」，不创造事实。
    """
    provider = (provider or EXPLAIN_PROVIDER).strip().lower()
    if provider in _explain_impls:
        try:
            return _explain_impls[provider](db, user_id, tea_id, model)
        except Exception:
            return _rule_reason(db, user_id, tea_id)
    return _rule_reason(db, user_id, tea_id)
