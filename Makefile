COMPOSE      := docker compose -f server/docker-compose.yml
STUB_FLAGS   := -f server/docker-compose.stub.yml
SEED_FLAGS   := -f server/docker-compose.stub.seed.yml
STUB_ENV     := API_KEY=dev ADMIN_KEY=dev

.PHONY: up stub stub-seed down e2e

up: ## Start all services (prod — requires API_KEY and ADMIN_KEY in env)
	$(COMPOSE) up -d

stub: ## Start all services without hardware (empty data)
	$(STUB_ENV) $(COMPOSE) $(STUB_FLAGS) up -d --build

stub-seed: ## Start all services without hardware (pre-seeded test data)
	$(STUB_ENV) $(COMPOSE) $(STUB_FLAGS) $(SEED_FLAGS) up -d --build

down: ## Stop all services
	$(STUB_ENV) $(COMPOSE) $(STUB_FLAGS) $(SEED_FLAGS) down

e2e: ## Run Playwright end-to-end suite (boots stub-seed stack)
	$(STUB_ENV) $(COMPOSE) $(STUB_FLAGS) $(SEED_FLAGS) up -d --build
	cd e2e && npm ci && npx playwright install --with-deps chromium && npx playwright test
