"""种子数据写入：从 data/teas.json 读取 5 款茶写入 Tea 表。

幂等：已存在同 id 的茶则跳过。
运行：python -m seed
"""

import json
from pathlib import Path

from db import Base, SessionLocal, engine
from models import Tea

DATA_DIR = Path(__file__).resolve().parent / "data"
TEAS_JSON = DATA_DIR / "teas.json"


def load_teas() -> list[dict]:
    with open(TEAS_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_teas() -> int:
    """写入所有茶，返回本次实际新增的数量。"""
    Base.metadata.create_all(bind=engine)
    teas = load_teas()
    created = 0
    with SessionLocal() as db:
        for t in teas:
            if db.get(Tea, t["id"]) is not None:
                continue
            db.add(Tea(
                id=t["id"],
                name=t["name"],
                region=t["region"],
                tea_type=t["tea_type"],
                emoji=t.get("emoji"),
                official_aroma=t.get("official_aroma", []),
                official_taste=t.get("official_taste", []),
                process=t.get("process", []),
                sensory_vector=t.get("sensory_vector", []),
                embedding=t.get("embedding"),
                blind_copy=t.get("blind_copy", {}),
                brewing_guide=t.get("brewing_guide", {}),
            ))
            created += 1
        db.commit()
    return created


if __name__ == "__main__":
    n = seed_teas()
    print(f"seeded {n} new teas (total in json: {len(load_teas())})")
