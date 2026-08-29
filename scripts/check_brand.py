#!/usr/bin/env python3
"""Fail when retired product-brand identifiers leak back into the formal project."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {".git", ".next", ".data", ".cache", "node_modules", "tea -Tpti", "__pycache__"}
SELF = Path(__file__).resolve()
ALLOW_COMPATIBILITY = {
    ROOT / "apps/web/lib/api.ts",
    ROOT / "apps/web/lib/api.test.ts",
    ROOT / "apps/web/e2e/core-flow.spec.ts",
    ROOT / "apps/api/app/db.py",
    ROOT / "apps/api/tests/test_brand_migration.py",
}
FORBIDDEN = (
    "《刷茶》",
    "SHUACHA",
    "Shuacha",
    "@shuacha",
    "shuacha.db",
    "shuacha.anonymousToken",
    '"name": "shuacha"',
    "刷茶 API",
)


def iter_text_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.resolve() == SELF or any(part in EXCLUDED_PARTS for part in path.parts):
            continue
        try:
            yield path, path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue


def main() -> int:
    failures: list[str] = []
    for path, content in iter_text_files():
        for pattern in FORBIDDEN:
            if pattern not in content:
                continue
            if path in ALLOW_COMPATIBILITY and pattern in {"shuacha.db", "shuacha.anonymousToken"}:
                continue
            failures.append(f"{path.relative_to(ROOT)}: retired brand token {pattern!r}")
    if failures:
        print("\n".join(failures))
        return 1
    print("Tea-BTI brand audit passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
