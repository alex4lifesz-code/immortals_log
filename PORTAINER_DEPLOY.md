# Portainer deployment

## Recommended files

- Main compose file: [docker-compose.yml](docker-compose.yml)
- LAN stack: [portainer-stack-lan.yml](portainer-stack-lan.yml)
- Env template: [.env.portainer.example](.env.portainer.example)
- Helper script: [scripts/deploy-portainer.sh](scripts/deploy-portainer.sh)

## Quick start on the server

1. Copy the template:

   cp .env.portainer.example .env.portainer

2. Edit the values:

   - APP_URL
   - NEXT_PUBLIC_APP_URL
   - JWT_SECRET

3. Deploy:

   sh ./scripts/deploy-portainer.sh

## Portainer UI

Use [docker-compose.yml](docker-compose.yml) in the Portainer stack editor for the clean default setup.

It is LAN-ready and includes:

- 2 CPU limit
- 2048 MB memory cap
- persistent database volume
- automatic Prisma migration on startup
- automatic shared Application Exercise Library seeding for fresh databases
- simple image-based deployment like common self-hosted apps

## Limits

The container is capped at 2 CPU cores and 2048 MB RAM.
