# Immortals Log

Immortals Log is a Next.js workout and progression tracking app with Prisma-backed data storage.

## Local development

1. Install dependencies:

   npm install

2. Start the development server:

   npm run dev

3. Open http://localhost:3000

## Production build

Run the verified production build locally with:

npm run build
npm run start

## Portainer deployment

This repo is set up to run in Portainer with a 2 GB RAM cap and 2 CPU limit.

### Recommended stack file

Use [portainer-stack.yml](portainer-stack.yml) for Portainer deployments.

### Quick setup on a Linux host

1. Copy the example environment file:

   cp .env.portainer.example .env.portainer

2. Edit the values in the new env file, especially the secret and app URL.

3. Deploy with the helper:

   sh ./scripts/deploy-portainer.sh

### Manual Portainer stack deployment

- Repository URL: this repository
- Compose path: [portainer-stack.yml](portainer-stack.yml)
- Required variables: JWT_SECRET, APP_URL, NEXT_PUBLIC_APP_URL

The container automatically runs Prisma migrations on startup and listens on port 4400.

### Convenience variants

- [portainer-stack-lan.yml](portainer-stack-lan.yml) for LAN access
- [portainer-stack-localhost.yml](portainer-stack-localhost.yml) for localhost-only binding
