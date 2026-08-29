"""Tea Profile 服务：茶基础信息的读取入口。

作为所有 service 的依赖契约，只暴露客观种子数据，不创造事实。
"""

from sqlalchemy.orm import Session

from models import SENSORY_DIMS, Tea


def get_tea(db: Session, tea_id: str) -> Tea | None:
    return db.get(Tea, tea_id)


def list_teas(db: Session) -> list[Tea]:
    return db.query(Tea).all()


def tea_sensory_vector(db: Session, tea_id: str) -> list[float]:
    """返回某款茶的 9 维感官向量；不存在则返回 9 个 0。"""
    tea = get_tea(db, tea_id)
    if tea is None:
        return [0.0] * len(SENSORY_DIMS)
    vector = list(tea.sensory_vector)
    # 防御：补齐缺失维度
    if len(vector) < len(SENSORY_DIMS):
        vector += [0.0] * (len(SENSORY_DIMS) - len(vector))
    return vector[: len(SENSORY_DIMS)]
