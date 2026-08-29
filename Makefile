.PHONY: dev build test brand-check api-test web-test contract migrate e2e

dev:
	docker compose up --build

build:
	docker compose build

test: brand-check api-test web-test

brand-check:
	python3 scripts/check_brand.py

api-test:
	docker compose run --rm api pytest -q

web-test:
	docker compose run --rm web npm --workspace apps/web run test

contract:
	docker compose run --rm api python -m app.export_openapi
	docker compose run --rm web npm --workspace packages/contracts run generate

migrate:
	docker compose run --rm api alembic upgrade head

e2e:
	./scripts/e2e.sh
