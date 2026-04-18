# Portainer deployment

## Recommended files

- Stack file: [portainer-stack.yml](portainer-stack.yml)
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

When deploying as a stack from the Portainer web UI, point it at [portainer-stack.yml](portainer-stack.yml) and supply the environment values from the template.

## Limits

The container is capped at 2 CPU cores and 2048 MB RAM.
