"""Tea-BTI 服务：把用户的 Taste Vector 投影成「味觉人格」表达层。

对应技术架构第 14 节 / PRD 第 14 节。

设计原则
--------
- 底层不是 LLM 人格测试：不联网、不调模型，纯本地规则 + numpy 向量运算。
- 四轴（0-100）从 9 维感官向量投影而来，左侧标签在低端、右侧标签在高端：
    light_full  轻盈 ←→ 饱满
    fresh_warm  清鲜 ←→ 温熟
    sweet_punchy 甜润 ←→ 劲爽
    clean_long  干净 ←→ 绵长
- 「AI 翻译」只负责把数值转成人话，不创造事实；数值全部来自种子数据的
  sensory_vector / 用户累积的 Taste Vector，文案使用「看起来 / 大约 / 似乎」等
  模糊表述，不假装精确。
- provider 扩展点：解释文案默认走本地规则 fallback，可插拔真实 LLM（见
  explain_teabti / TEABTI_PROVIDER）。

纯函数约定：除 build_teabti 需要读数据库外，其余函数均为无副作用的纯函数。
"""

from __future__ import annotations

import os
from typing import Sequence

import numpy as np
from sqlalchemy.orm import Session

from models import SENSORY_DIMS, SwipeEvent, Tea, UserTasteProfile

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 四轴顺序（固定，与 schemas.TeaBtiAxes 一致）
AXIS_ORDER = ["light_full", "fresh_warm", "sweet_punchy", "clean_long"]

# 解释文案的 provider 开关：默认 rule（本地规则，离线可用）；
# 未来接入真实 LLM 时设为环境变量 TEABTI_PROVIDER=<provider> 即可。
TEABTI_PROVIDER = os.getenv("TEABTI_PROVIDER", "rule").strip().lower()

# 预设 Archetype（6-8 个），code -> {name, description}
ARCHETYPE_DEFINITIONS: dict[str, dict[str, str]] = {
    "SPRING_MIST": {
        "name": "春雾回甘型",
        "description": "轻盈、清鲜，入口柔和，回甘悠长",
    },
    "SWEET_WARM": {
        "name": "甜润暖熟型",
        "description": "甜润、温熟，喝起来踏实",
    },
    "FULL_LONG": {
        "name": "醇厚绵长型",
        "description": "饱满、醇厚，尾韵绵长",
    },
    "CLEAR_BRIGHT": {
        "name": "清鲜爽朗型",
        "description": "清鲜、干净，清清爽爽",
    },
    "PUNCHY": {
        "name": "劲爽明快型",
        "description": "劲爽、明快，有存在感",
    },
    "MILD_CLEAN": {
        "name": "温润干净型",
        "description": "温润又干净，柔和不拖沓",
    },
    "BALANCED": {
        "name": "均衡通融型",
        "description": "各轴均衡，接受度高",
    },
}

# 各 Archetype 的规则解释文案（预设 fallback，措辞带模糊感）
RULE_EXPLANATIONS: dict[str, str] = {
    "SPRING_MIST": "你更容易被轻盈、清鲜的茶吸引，喜欢入口柔和，但尾巴最好留久一点。",
    "SWEET_WARM": "你似乎更喜欢甜润、温熟的口感，喝下去是踏实的暖。",
    "FULL_LONG": "你大约偏爱饱满、醇厚的茶，尾韵会停得久一点。",
    "CLEAR_BRIGHT": "你看重干净、清鲜，一杯下去清清爽爽。",
    "PUNCHY": "你好像更爱劲爽、明快的一口，有存在感。",
    "MILD_CLEAN": "你似乎喜欢温润又干净的口感，柔和不拖沓。",
    "BALANCED": "你对各种口感都接受得不错，暂时还没有特别明显的偏向。",
}

# 稳定度：0-5 forming / 6-15 early / 16+ stable
CONFIDENCE_LABELS: dict[str, str] = {
    "forming": "正在形成",
    "early": "初见",
    "stable": "逐渐稳定",
}

# 冷启动（无任何信号）时的提示文案
COLD_START_EXPLANATION = "先刷几杯、喝几杯，你的 Tea-BTI 会慢慢成型。"


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """把数值夹到 [lo, hi] 区间。"""
    return float(np.clip(value, lo, hi))


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """用 numpy 计算两个向量的余弦相似度（-1 ~ 1）。

    任一向量为零向量时返回 0.0，避免除零。
    """
    a_np = np.asarray(a, dtype=float)
    b_np = np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(a_np) * np.linalg.norm(b_np))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a_np, b_np) / denom)


def _to_vector(profile: Sequence[float] | "UserTasteProfile") -> np.ndarray:
    """把入参规整成 numpy 9 维向量。

    兼容两种入参：9 维浮点序列，或带 as_vector() 的 UserTasteProfile 模型。
    """
    if hasattr(profile, "as_vector"):
        vector = profile.as_vector()  # type: ignore[attr-defined]
    else:
        vector = list(profile)
    arr = np.asarray(vector, dtype=float)
    # 防御：补齐 / 截断到 9 维
    if arr.size < len(SENSORY_DIMS):
        arr = np.pad(arr, (0, len(SENSORY_DIMS) - arr.size))
    return arr[: len(SENSORY_DIMS)]


# ---------------------------------------------------------------------------
# 核心：四轴投影
# ---------------------------------------------------------------------------

def project_axes(
    profile: Sequence[float] | "UserTasteProfile",
) -> dict[str, int]:
    """把 9 维 Taste Vector 投影到四个 0-100 的轴。

    映射约定（左侧标签在低端，右侧标签在高端）：

    - light_full（轻盈↔饱满）：越低越轻盈。由 body（醇厚度，主因子）与
      roast（焙火感，次因子）共同决定：body*10 + roast*2，再夹到 0-100。
      说明：任务描述中的「100 - (body*10 + roast*2)」与其「越低越轻盈」的
      语义相矛盾（body 越高应越饱满，即轴值越高），此处采用语义正确的正向映射。
    - fresh_warm（清鲜↔温熟）：越低越清鲜。= 100 - freshness*10。
    - sweet_punchy（甜润↔劲爽）：越低越甜润。= 100 - sweetness*10。
    - clean_long（干净↔绵长）：越低越干净。由 clean（干净，压低）与
      aftertaste（回甘/尾韵，抬高）共同决定：aftertaste*10 - clean*5 + 50。
      clean 用一半权重做「绵长」的抑制项，使「很干净但回甘不长」的茶更偏干净端，
      「回甘悠长」的茶更偏绵长端。

    返回 4 个 int（0-100）。
    """
    v = _to_vector(profile)
    # 按固定 9 维顺序取分量
    freshness, sweetness, body, roast, _astr, _floral, _fruity, clean, aftertaste = v

    light_full = _clamp(body * 10 + roast * 2)
    fresh_warm = _clamp(100 - freshness * 10)
    sweet_punchy = _clamp(100 - sweetness * 10)
    clean_long = _clamp(aftertaste * 10 - clean * 5 + 50)

    return {
        "light_full": int(round(light_full)),
        "fresh_warm": int(round(fresh_warm)),
        "sweet_punchy": int(round(sweet_punchy)),
        "clean_long": int(round(clean_long)),
    }


# ---------------------------------------------------------------------------
# Archetype 规则匹配
# ---------------------------------------------------------------------------

def archetype(axes: dict[str, int]) -> str:
    """按规则匹配返回 Archetype 代码（如 "SPRING_MIST"）。

    匹配顺序即优先级（从上到下第一个命中者胜）：

    1. SPRING_MIST 春雾回甘型：轻盈 + 清鲜 + 绵长（回甘）。
    2. SWEET_WARM 甜润暖熟型：很甜润 + 温熟。
    3. FULL_LONG 醇厚绵长型：饱满 + 绵长。
    4. CLEAR_BRIGHT 清鲜爽朗型：清鲜 + 干净（尾韵不长）。
    5. PUNCHY 劲爽明快型：劲爽。
    6. MILD_CLEAN 温润干净型：甜润 + 干净。
    7. BALANCED 均衡通融型：兜底，各轴无明显偏向。
    """
    light = axes["light_full"]
    fresh = axes["fresh_warm"]
    sweet = axes["sweet_punchy"]
    long_ = axes["clean_long"]

    if light < 45 and fresh < 40 and long_ > 60:
        return "SPRING_MIST"
    if sweet <= 25 and fresh >= 55:
        return "SWEET_WARM"
    if light >= 75 and long_ >= 80:
        return "FULL_LONG"
    if fresh < 40 and long_ <= 60:
        return "CLEAR_BRIGHT"
    if sweet >= 60:
        return "PUNCHY"
    if sweet < 45 and long_ < 50:
        return "MILD_CLEAN"
    return "BALANCED"


def archetype_name(code: str) -> str:
    """返回 Archetype 的中文名；未知代码返回空串。"""
    return ARCHETYPE_DEFINITIONS.get(code, {}).get("name", "")


# ---------------------------------------------------------------------------
# 稳定度
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


def confidence_label(state: str) -> str:
    """稳定度代码 -> 中文标签。"""
    return CONFIDENCE_LABELS.get(state, state)


# ---------------------------------------------------------------------------
# 解释文案（provider 扩展点）
# ---------------------------------------------------------------------------

def explain_teabti(
    code: str,
    axes: dict[str, int],
    provider: str | None = None,
) -> str:
    """生成 Tea-BTI 的解释文案。

    这是唯一的「AI 翻译」扩展点：默认走本地规则 fallback（离线可用），
    未来接入真实 LLM 时，把 axes + archetype 交给模型，让模型只做「表达」，
    不创造事实（客观数值仍来自 Taste Vector）。
    """
    provider = (provider or TEABTI_PROVIDER).strip().lower()
    if provider == "rule":
        return _rule_explanation(code)
    return _external_explanation(code, axes, provider)


def _rule_explanation(code: str) -> str:
    """本地规则 fallback：返回预设文案。"""
    return RULE_EXPLANATIONS.get(code, RULE_EXPLANATIONS["BALANCED"])


def _external_explanation(code: str, axes: dict[str, int], provider: str) -> str:
    """外部 provider 扩展点。

    未来实现：调用真实 LLM/VLM，把 axes（四轴数值）与 archetype（类型）作为
    上下文交给模型，让其用中文、模糊措辞生成解释；demo 阶段降级回规则文案。
    """
    # demo：无论 provider 是什么，先保证可离线运行
    return _rule_explanation(code)


# ---------------------------------------------------------------------------
# 汇总：build_teabti
# ---------------------------------------------------------------------------

def _collect_evidence(
    db: Session,
    user_id: str,
    profile_vector: np.ndarray,
    limit: int,
) -> list[dict]:
    """收集最近若干 swipe 事件作为味觉证据。

    取最近的 like/save/skip（按插入顺序倒序），并附上该茶与当前 Taste Vector
    的余弦相似度（用 numpy 计算），供前端展示「为什么是这个类型」。
    """
    events = (
        db.query(SwipeEvent)
        .filter(SwipeEvent.user_id == user_id)
        .filter(SwipeEvent.action.in_(["like", "save", "skip"]))
        .order_by(SwipeEvent.id.desc())
        .all()
    )

    evidence: list[dict] = []
    for ev in events:
        if len(evidence) >= limit:
            break
        tea = db.get(Tea, ev.tea_id)
        if tea is None:
            continue
        tea_vector = np.asarray(list(tea.sensory_vector or [0.0] * 9), dtype=float)
        blind_copy = tea.blind_copy or {}
        evidence.append(
            {
                "tea_id": tea.id,
                "tea_name": tea.name,
                "emoji": tea.emoji or "",
                "action": ev.action,
                "headline": blind_copy.get("headline", ""),
                "tags": list(blind_copy.get("tags", [])),
                "similarity": round(float(cosine_similarity(profile_vector, tea_vector)), 3),
            }
        )
    return evidence


def build_teabti(
    db: Session,
    user_id: str,
    evidence_limit: int = 5,
) -> dict:
    """为某用户构建完整 Tea-BTI 结果。

    返回：
    {
      "user_id": str,
      "axes": {"light_full": int, "fresh_warm": int, "sweet_punchy": int,
               "clean_long": int},
      "archetype": str,        # 代码，冷启动为空串
      "archetype_name": str,   # 中文名
      "confidence_state": str, # forming | early | stable
      "confidence_label": str, # 中文稳定度标签
      "evidence": list[dict],  # 最近的 like/save/skip 茶 + 余弦相似度
      "explanation": str,      # 解释文案
    }

    说明：db 作为首参以与 tea_profile.py 等 service 约定一致；本函数只读不改，
    不写库（稳定度由 sample_count 现算，持久化交由 Memory/Passport 服务）。
    """
    profile = db.get(UserTasteProfile, user_id)

    # 冷启动：无任何味觉信号
    if profile is None or profile.sample_count <= 0:
        axes = {axis: 50 for axis in AXIS_ORDER}
        return {
            "user_id": user_id,
            "axes": axes,
            "archetype": "",
            "archetype_name": "",
            "confidence_state": "forming",
            "confidence_label": confidence_label("forming"),
            "evidence": [],
            "explanation": COLD_START_EXPLANATION,
        }

    vector = profile.as_vector()
    axes = project_axes(vector)
    code = archetype(axes)
    state = confidence_state(profile.sample_count)
    evidence = _collect_evidence(db, user_id, np.asarray(vector, dtype=float), evidence_limit)

    return {
        "user_id": user_id,
        "axes": axes,
        "archetype": code,
        "archetype_name": archetype_name(code),
        "confidence_state": state,
        "confidence_label": confidence_label(state),
        "evidence": evidence,
        "explanation": explain_teabti(code, axes),
    }
