import json
from pathlib import Path

from .main import app


def main() -> None:
    output = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "openapi.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
