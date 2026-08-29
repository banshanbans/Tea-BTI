"""SQLAlchemy ORM 模型。

sensory_vector 的 9 维顺序（固定）：
[ freshness鲜爽, sweetness甜润, body醇厚度, roast焙火感, astringency涩感,
  floral花香, fruity果香, clean干净, aftertaste回甘尾韵 ]，每维 0-10 浮点。
"""

from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base

# 9 维感官向量的固定维度名（顺序不可变）
SENSORY_DIMS = [
    "freshness",   # 鲜爽
    "sweetness",   # 甜润
    "body",        # 醇厚度
    "roast",       # 焙火感
    "astringency", # 涩感
    "floral",      # 花香
    "fruity",      # 果香
    "clean",       # 干净
    "aftertaste",  # 回甘尾韵
]


class Tea(Base):
    __tablename__ = "teas"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    tea_type: Mapped[str] = mapped_column(String, nullable=False)
    emoji: Mapped[str] = mapped_column(String, nullable=True)

    official_aroma: Mapped[list] = mapped_column(JSON, default=list)
    official_taste: Mapped[list] = mapped_column(JSON, default=list)
    process: Mapped[list] = mapped_column(JSON, default=list)

    sensory_vector: Mapped[list] = mapped_column(JSON, default=list)  # list[float]
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)

    blind_copy: Mapped[dict] = mapped_column(JSON, default=dict)
    brewing_guide: Mapped[dict] = mapped_column(JSON, default=dict)


class UserTasteProfile(Base):
    __tablename__ = "user_taste_profiles"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)

    freshness: Mapped[float] = mapped_column(Float, default=0.0)
    sweetness: Mapped[float] = mapped_column(Float, default=0.0)
    body: Mapped[float] = mapped_column(Float, default=0.0)
    roast: Mapped[float] = mapped_column(Float, default=0.0)
    astringency: Mapped[float] = mapped_column(Float, default=0.0)
    floral: Mapped[float] = mapped_column(Float, default=0.0)
    fruity: Mapped[float] = mapped_column(Float, default=0.0)
    clean: Mapped[float] = mapped_column(Float, default=0.0)
    aftertaste: Mapped[float] = mapped_column(Float, default=0.0)

    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    confidence_state: Mapped[str] = mapped_column(String, default="forming")

    def as_vector(self) -> list[float]:
        """按固定 9 维顺序返回向量。"""
        return [
            self.freshness,
            self.sweetness,
            self.body,
            self.roast,
            self.astringency,
            self.floral,
            self.fruity,
            self.clean,
            self.aftertaste,
        ]


class SwipeEvent(Base):
    __tablename__ = "swipe_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    tea_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)  # like | skip | save
    timestamp: Mapped[str] = mapped_column(String, nullable=False)


class DrinkFeedback(Base):
    __tablename__ = "drink_feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    tea_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    result: Mapped[str] = mapped_column(String, nullable=False)  # like | neutral | dislike

    user_words: Mapped[str | None] = mapped_column(String, nullable=True)
    normalized_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    infusion_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    timestamp: Mapped[str] = mapped_column(String, nullable=False)


class TeaPassportEntry(Base):
    __tablename__ = "tea_passport_entries"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    tea_id: Mapped[str] = mapped_column(String, primary_key=True)

    first_drunk_at: Mapped[str] = mapped_column(String, nullable=False)
    favorite_infusion: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_description: Mapped[str | None] = mapped_column(String, nullable=True)
    normalized_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    brewed: Mapped[bool] = mapped_column(Boolean, default=False)
    tasted: Mapped[bool] = mapped_column(Boolean, default=False)
    realm_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
