.PHONY: setup dev verify evaluate

setup:
	./scripts/bootstrap.sh

dev:
	./scripts/dev.sh

verify:
	pnpm lint
	pnpm test
	pnpm build

evaluate:
	pnpm evaluate
