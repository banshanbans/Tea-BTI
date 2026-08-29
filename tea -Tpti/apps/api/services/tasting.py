"""Tasting Conversation 服务（Taste Mode）。

对应技术架构第 13 节 / PRD 第 11 节：把用户的「普通人的话」翻译成「茶专业语言」，
再落到 DrinkFeedback / Taste Vector 更新。

设计原则：
- demo 阶段用规则（关键词 → 感官维度）降级，不依赖任何外部模型 / 网络；
- 接口预留 ``llm`` / provider 扩展点，可插拔真实 LLM 做「自然语言 → 茶专业语言」翻译；
- AI 不说「你喝错了」，而是「你刚刚说的感觉，在茶里通常会这样描述」；
- AI 只翻译表达，不创造事实（客观信息来自种子数据）。

normalized 输出只使用与 sensory_vector 一致的 9 维英文 key：
freshness, sweetness, body, roast, astringency, floral, fruity, clean, aftertaste。
"""

from __future__ import annotations

from typing import Protocol

import numpy as np

from models import SENSORY_DIMS

# ---------------------------------------------------------------------------
# 中文描述短语（用于生成 explanation，纯文案，不产生事实）
# ---------------------------------------------------------------------------

DIM_PHRASE: dict[str, str] = {
    "freshness": "嫩香 / 清鲜感",
    "sweetness": "甜润感",
    "body": "醇厚感",
    "roast": "焙火感",
    "astringency": "涩感",
    "floral": "花香",
    "fruity": "果香",
    "clean": "干净清透",
    "aftertaste": "回甘",
}

# 「甜」如果和这些「尾韵 / 留存」词共现，则理解为回甘，而不是入口的甜润
FINISH_MARKERS: tuple[str, ...] = (
    "回甘", "回甜", "尾", "喝完", "后味", "留", "停", "持续", "最后",
)


class TasteTranslator(Protocol):
    """真实 LLM provider 的接口：自然语言 → 茶专业语言。

    接入真实模型时，实现 ``translate`` 即可，返回结构需包含
    ``user_words`` / ``normalized`` / ``explanation`` 三个字段。
    """

    def translate(self, user_words: str) -> dict: ...


def _match_dimensions(text: str) -> dict[str, str]:
    """规则匹配：把用户原话映射为 {感官维度 key: 中文描述}。

    返回 dict 无序；输出时按 SENSORY_DIMS 固定顺序重排。
    """
    dims: dict[str, str] = {}

    def add(dim: str, phrase: str) -> None:
        dims.setdefault(dim, phrase)

    # 甜润 / 甜香 / 甘甜 / 蜜 —— 明确的甜润
    if any(k in text for k in ("甜润", "甜香", "甘甜", "蜜")):
        add("sweetness", "甜润感")

    # 鲜爽 / 清鲜 / 嫩 / 青草 / 豆香 / 芽
    if any(k in text for k in ("鲜爽", "清鲜", "豆香", "芽")):
        add("freshness", "嫩香 / 清鲜感")
    if any(k in text for k in ("青草", "嫩", "青")):
        add("freshness", "嫩香 / 清鲜感")

    # 醇厚 / 浓 / 饱满 / 存在感 / 厚 / 重
    if any(k in text for k in ("醇厚", "浓", "饱满", "存在感", "厚", "重")):
        add("body", "醇厚感")

    # 焙火 / 温熟 / 烤 / 焦
    if any(k in text for k in ("焙", "烤", "焦", "火香", "温熟", "熟")):
        add("roast", "焙火感")

    # 涩 / 收敛
    if any(k in text for k in ("涩", "收敛")):
        add("astringency", "涩感")

    # 花香
    if any(k in text for k in ("花香", "兰", "桂", "栀子", "花")):
        add("floral", "花香")

    # 果香
    if any(k in text for k in ("果香", "蜜桃", "柑橘", "果")):
        add("fruity", "果香")

    # 干净 / 清香 / 清透 / 清泉
    if any(k in text for k in ("干净", "清香", "清透", "清泉", "泉水", "无杂", "净", "透")):
        add("clean", "干净清透")
    # 裸「清」：仅在没有更具体「清x」词时才落到「干净」
    if "清" in text and not any(k in text for k in ("清鲜", "清香", "清透", "清泉")):
        add("clean", "干净清透")

    # 香（泛）→ 默认花香；已有具体香气词时不再重复
    if "香" in text and not any(k in text for k in ("花香", "果香", "甜香", "清香", "栗香")):
        add("floral", "花香")

    # 回甘 / 尾韵
    if any(k in text for k in ("回甘", "回甜", "尾韵", "余韵", "余味", "后味")):
        add("aftertaste", "回甘")

    # 裸「甜」——上下文：与「喝完 / 尾 / 留 / 停」等共现 → 回甘；否则甜润
    if "甜" in text and "sweetness" not in dims:
        if any(m in text for m in FINISH_MARKERS):
            add("aftertaste", "回甘")
        else:
            add("sweetness", "甜润感")

    return dims


def build_explanation(text: str, dims: dict[str, str]) -> str:
    """根据命中的维度生成中文解释文案。

    只在「翻译」用户表达，不评判对错；无命中时温和引导用户多说一点。
    """
    front = [d for d in SENSORY_DIMS if d in dims and d != "aftertaste"]
    has_aftertaste = "aftertaste" in dims

    if not front and not has_aftertaste:
        return "我还没太听出来，可以再多说一点它闻起来、喝起来是什么感觉。"

    front_phrases = "、".join(DIM_PHRASE[d] for d in front)

    if front and has_aftertaste:
        return f"你描述的前半段比较接近{front_phrases}，后面那点持续的甜感可以理解成回甘。"
    if has_aftertaste:
        return "你描述的那种喝完还留在嘴里的感觉，通常可以理解成回甘。"
    return f"你刚刚说的感觉，在茶里通常会这样描述：{front_phrases}。"


def _sanitize(result: dict, user_words: str) -> dict:
    """校验（真实 LLM 返回的）归一化结果：只保留合法的 9 维 key。"""
    raw = result.get("normalized", []) if isinstance(result, dict) else []
    normalized = [d for d in SENSORY_DIMS if d in raw]
    explanation = result.get("explanation", "") if isinstance(result, dict) else ""
    return {
        "user_words": result.get("user_words", user_words) if isinstance(result, dict) else user_words,
        "normalized": normalized,
        "explanation": explanation or build_explanation(user_words, _match_dimensions(user_words)),
    }


def normalize(
    user_words: str,
    llm: TasteTranslator | None = None,
    tea_id: str | None = None,
) -> dict:
    """把用户原话归一化为茶专业语言。

    Args:
        user_words: 用户原话（普通人的表达）。
        llm: 可选 provider。为 ``None`` 时走 demo 规则降级；
             传入实现了 ``translate`` 的对象时，改走真实 LLM 翻译。
        tea_id: 可选，当前茶的 id（demo 规则阶段暂不需要，供 provider 对齐上下文）。

    Returns:
        {"user_words": str, "normalized": list[str], "explanation": str}
    """
    user_words = (user_words or "").strip()

    # 扩展点：接入真实 LLM，做「自然语言 → 茶专业语言」翻译
    if llm is not None:
        return _sanitize(llm.translate(user_words), user_words)

    if not user_words:
        return {
            "user_words": "",
            "normalized": [],
            "explanation": "可以先说说它闻起来、喝起来是什么感觉。",
        }

    dims = _match_dimensions(user_words)
    normalized = [d for d in SENSORY_DIMS if d in dims]
    explanation = build_explanation(user_words, dims)

    return {
        "user_words": user_words,
        "normalized": normalized,
        "explanation": explanation,
    }


# ---------------------------------------------------------------------------
# 向量运算（numpy）
# ---------------------------------------------------------------------------

def tags_to_vector(normalized_tags: list[str]) -> np.ndarray:
    """把归一化标签转成 9 维向量（one-hot），用于与茶的 sensory_vector 求相似度。"""
    vec = np.zeros(len(SENSORY_DIMS), dtype=float)
    for i, dim in enumerate(SENSORY_DIMS):
        if dim in normalized_tags:
            vec[i] = 1.0
    return vec


def cosine_similarity(a: np.ndarray | list, b: np.ndarray | list) -> float:
    """两个向量的余弦相似度，返回 0.0 ~ 1.0（零向量时退化为 0.0）。"""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def match_tea(
    user_words: str,
    tea_sensory_vector: list[float],
    llm: TasteTranslator | None = None,
) -> dict:
    """判断用户描述与某款茶官方感官向量（9 维）的贴合程度。

    Returns:
        {"similarity": float, "normalized": list[str], "explanation": str}
        相似度仅作内部参考，不做伪精确声明。
    """
    norm = normalize(user_words, llm=llm)
    user_vec = tags_to_vector(norm["normalized"])
    tea_vec = np.asarray(tea_sensory_vector, dtype=float)[: len(SENSORY_DIMS)]
    similarity = cosine_similarity(user_vec, tea_vec)
    return {
        "similarity": round(similarity, 4),
        "normalized": norm["normalized"],
        "explanation": norm["explanation"],
    }
