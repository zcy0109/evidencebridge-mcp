#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

if [ ! -f .env ]; then
  cp .env.example .env
fi

pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r apps/flask-service/requirements-dev.txt
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm --filter @evidencebridge/mcp-server build

echo "Bootstrap complete. Run ./scripts/dev.sh"
