.PHONY: bootstrap deploy migrate logs restart down ps

## Provision fresh server: install Docker, unzip, create dirs
bootstrap:
	@bash scripts/bootstrap.sh

## Build frontend locally, zip, upload to VPS, docker up + migrate
deploy:
	@bash scripts/deploy.sh

## Upload crawled data + run alembic schema migrations + old-system data migration
migrate:
	@bash scripts/migrate.sh

## Tail all service logs on server (Ctrl+C to exit)
logs:
	@source .deploy.env 2>/dev/null; \
	sshpass -p "$$VPS_PASS" ssh -o StrictHostKeyChecking=no $$VPS_USER@$$VPS_HOST \
	  'cd /opt/motogiathinh && docker compose logs -f --tail=100'

## Restart all containers without rebuilding
restart:
	@source .deploy.env 2>/dev/null; \
	sshpass -p "$$VPS_PASS" ssh -o StrictHostKeyChecking=no $$VPS_USER@$$VPS_HOST \
	  'cd /opt/motogiathinh && docker compose restart'

## Show container status on server
ps:
	@source .deploy.env 2>/dev/null; \
	sshpass -p "$$VPS_PASS" ssh -o StrictHostKeyChecking=no $$VPS_USER@$$VPS_HOST \
	  'cd /opt/motogiathinh && docker compose ps'

## Stop all containers on server
down:
	@source .deploy.env 2>/dev/null; \
	sshpass -p "$$VPS_PASS" ssh -o StrictHostKeyChecking=no $$VPS_USER@$$VPS_HOST \
	  'cd /opt/motogiathinh && docker compose down'
