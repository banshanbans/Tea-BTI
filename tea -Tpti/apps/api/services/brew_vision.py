"""Brew Vision 服务（AI Brew Companion，技术架构第 11 节）。

Demo 阶段不真正调用 VLM：用「规则 + 预设中文陪伴话术」完成逐帧状态识别，
保证本地可跑、可降级、零外部依赖。接口通过 `backend` 开关预留真实 VLM
provider 的插拔点（替换 `_analyze_with_vlm` 内部实现即可）。

关键约束（技术架构 11.5 / PRD 10 节「明确边界」）：
- 不给伪精确：普通摄像头无法可靠判断精确水温 / 克数 / 茶汤化学成分，
  因此 `uncertain` 固定包含 "exact water temperature" 与 "exact tea amount"；
- 话术用「看起来」「大约」「左右」等表述，不声称精确数值。
"""

from __future__ import annotations

import itertools
import os
from typing import Any, TypedDict

import numpy as np

from models import SENSORY_DIMS
from services import tea_profile

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 泡茶流程状态机（技术架构 11.3）
BREW_STATES = [
    "EMPTY",
    "TEA_VISIBLE",
    "POURING",
    "STEEPING",
    "DECANTING",
    "FINISHED",
]

# 前端步骤（投茶/注水/等待/出汤/完成）→ 状态映射，附若干口语别名
STEP_HINT_TO_STATE: dict[str, str] = {
    # 中文步骤
    "投茶": "TEA_VISIBLE",
    "放茶": "TEA_VISIBLE",
    "注水": "POURING",
    "倒水": "POURING",
    "等待": "STEEPING",
    "泡": "STEEPING",
    "焖": "STEEPING",
    "出汤": "DECANTING",
    "倒出": "DECANTING",
    "完成": "FINISHED",
    "结束": "FINISHED",
    "空": "EMPTY",
    "还没开始": "EMPTY",
    # 英文 / 状态名小写别名
    "empty": "EMPTY",
    "tea_visible": "TEA_VISIBLE",
    "pouring": "POURING",
    "steeping": "STEEPING",
    "decanting": "DECANTING",
    "finished": "FINISHED",
}

# 永远列出的「不确定项」——体现不给伪精确（技术架构 11.5）
UNCERTAIN_BASE = ["exact water temperature", "exact tea amount"]

# 无 hint 时的默认置信度（比有 hint 时更低，表示「估计」成分更多）
_FALLBACK_CONFIDENCE = 0.60

# 每个状态的中文陪伴话术（message = 主话术 / suggestion = 建议，复刻前端 brewSay / brewWhy）
STATE_COPY: dict[str, dict[str, Any]] = {
    "EMPTY": {
        "message": "先摆好盖碗，把茶叶放在手边，我们慢慢来。",
        "suggestion": "确认茶叶和盖碗都摆在面前，就可以开始投茶了。",
        "observations": ["盖碗是空的", "还没看到茶叶"],
    },
    "TEA_VISIBLE": {
        "message": "把茶叶轻轻放进去，大概铺满盖碗底部。",
        "suggestion": "投茶量不用太满，盖碗留点空间让叶子舒展。",
        "observations": ["能看到茶叶", "投茶量看起来适中"],
    },
    "POURING": {
        "message": "水流沿着碗壁缓缓注入，别对着叶子冲。",
        "suggestion": "沿壁注水能避免水温直接冲击嫩芽。",
        "observations": ["水正在注入", "水流沿壁而下"],
    },
    "STEEPING": {
        "message": "这一泡等 20 秒左右，让鲜爽感出来。",
        "suggestion": "短一些能保留鲜爽感，久了容易闷。",
        "observations": ["茶叶正在舒展", "茶汤颜色在慢慢变深"],
    },
    "DECANTING": {
        "message": "差不多可以出汤了。",
        "suggestion": "再等会涩感会重，现在出汤最清甜。",
        "observations": ["茶汤颜色看起来刚刚好", "香气开始飘出来"],
    },
    "FINISHED": {
        "message": "这杯泡好了，趁热喝。",
        "suggestion": "",
        "observations": ["茶汤已经出好", "这一泡结束"],
    },
}

# 无 step_hint 时的内部轮转（demo 友好：连续帧没有 hint 时循环走一遍流程）
_FALLBACK_ROTATION = itertools.cycle(
    ["TEA_VISIBLE", "POURING", "STEEPING", "DECANTING", "FINISHED"]
)


# ---------------------------------------------------------------------------
# 类型
# ---------------------------------------------------------------------------

class BrewFrameResult(TypedDict):
    """单帧分析结果。字段与 schemas.BrewFrameOut 对齐，额外 `suggestion` 承载
    前端 brewWhy 那一行的「建议」话术。"""

    state: str
    confidence: float
    observations: list[str]
    uncertain: list[str]
    message: str
    suggestion: str


# ---------------------------------------------------------------------------
# numpy 向量工具
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """numpy 余弦相似度。

    真实 VLM provider 接入后，可用帧 embedding 与各状态「原型向量」比对来决定
    state；demo 阶段用于保持 numpy 向量运算能力，供上层复用。
    """
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    if va.shape != vb.shape:
        raise ValueError(f"向量维度不一致：{va.shape} vs {vb.shape}")
    norm_a = float(np.linalg.norm(va))
    norm_b = float(np.linalg.norm(vb))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def _softmax(x: np.ndarray) -> np.ndarray:
    """数值稳定的 softmax。"""
    x = np.asarray(x, dtype=float)
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _confidence_for_state(state: str) -> float:
    """用 numpy softmax 把「命中状态」转成平滑置信度，避免硬编码 0.9 这类伪精确。

    命中状态给高分，相邻状态给较低分，模拟「状态切换边缘可能误判」，
    其余状态 0 分。返回命中状态经 softmax 归一化后的概率作为 confidence。
    """
    scores = np.zeros(len(BREW_STATES), dtype=float)
    idx = BREW_STATES.index(state)
    scores[idx] = 3.0
    if idx > 0:
        scores[idx - 1] = 1.0
    if idx < len(BREW_STATES) - 1:
        scores[idx + 1] = 1.0
    probs = _softmax(scores)
    return float(probs[idx])


# ---------------------------------------------------------------------------
# 状态解析
# ---------------------------------------------------------------------------

def resolve_state(step_hint: str) -> str:
    """把前端中文步骤 / 状态名归一化成 BREW_STATES 中的状态。

    无法识别时回落到 STEEPING（等待），保证永不返回非法状态。
    """
    hint = (step_hint or "").strip()
    if not hint:
        return "STEEPING"
    upper = hint.upper()
    if upper in BREW_STATES:
        return upper
    return STEP_HINT_TO_STATE.get(hint) or STEP_HINT_TO_STATE.get(hint.lower()) or "STEEPING"


# ---------------------------------------------------------------------------
# 核心：帧分析
# ---------------------------------------------------------------------------

def analyze_frame(
    frame_input: str | bytes | None = None,
    step_hint: str | None = None,
    *,
    model: str | None = None,
    backend: str | None = None,
) -> BrewFrameResult:
    """分析一帧，返回结构化 Brew 状态 + 中文陪伴话术。

    Args:
        frame_input: 采样帧（base64 字符串或原始字节）。demo（mock）阶段忽略其像素内容。
        step_hint: 前端给的步骤提示（投茶/注水/等待/出汤/完成，或状态名）。
                   传入时按 hint 返回对应 state；缺省时走内部轮转。
        model: 预留参数——接入真实 VLM 时指定模型名（如 "gpt-4o" / "claude-..."）。
        backend: provider 开关，默认取环境变量 ``BREW_VISION_BACKEND``，缺省 "mock"。
                 "mock" 走本地规则降级；其它值走 ``_analyze_with_vlm``（真实 provider）。

    Returns:
        BrewFrameResult: 含 state/confidence/observations/uncertain/message/suggestion。
    """
    provider = backend or os.getenv("BREW_VISION_BACKEND", "mock")
    if provider == "mock":
        return _analyze_mock(frame_input, step_hint)
    # 真实 VLM 接入点：接入后替换 _analyze_with_vlm 内部实现即可，接口契约不变。
    return _analyze_with_vlm(frame_input, step_hint, model=model)


def _analyze_mock(frame_input: str | bytes | None, step_hint: str | None) -> BrewFrameResult:
    """Demo 降级实现：不调用任何模型，纯规则 + 预设话术。"""
    if step_hint is not None and step_hint.strip():
        state = resolve_state(step_hint)
        confidence = _confidence_for_state(state)
    else:
        # 无 hint：内部轮转（demo 友好），置信度更低
        state = next(_FALLBACK_ROTATION)
        confidence = _FALLBACK_CONFIDENCE

    copy = STATE_COPY[state]
    return {
        "state": state,
        "confidence": round(confidence, 3),
        "observations": list(copy["observations"]),
        "uncertain": list(UNCERTAIN_BASE),
        "message": copy["message"],
        "suggestion": copy["suggestion"],
    }


def _analyze_with_vlm(
    frame_input: str | bytes | None,
    step_hint: str | None,
    *,
    model: str | None,
) -> BrewFrameResult:
    """真实 VLM provider 接入点（当前未实现）。

    接入时替换此函数内部逻辑：调用多模态 provider（OpenAI / Anthropic / 其它），
    将采样帧转成结构化输出（state / confidence / observations / uncertain），
    再沿用 ``STATE_COPY`` 生成中文陪伴话术。

    必须遵守技术架构 11.4 / 11.5：
    - VLM 输出结构化 JSON；
    - 不声称精确水温 / 克数 / 茶多酚浓度。
    """
    raise NotImplementedError(
        "真实 VLM provider 尚未接入：请实现 _analyze_with_vlm（backend != 'mock'）"
    )


# ---------------------------------------------------------------------------
# 冲泡指导
# ---------------------------------------------------------------------------

def brew_guidance(tea_id: str, db=None) -> dict | None:
    """返回某款茶的冲泡指导（brewing_guide）。

    从 tea_profile 读取客观种子数据，不创造事实；茶不存在时返回 None。
    ``db`` 为 SQLAlchemy Session（由路由层注入）。返回新 dict，避免调用方误改种子数据。
    """
    if db is None:
        return None
    tea = tea_profile.get_tea(db, tea_id)
    if tea is None:
        return None
    guide = tea.brewing_guide or {}
    return dict(guide)
