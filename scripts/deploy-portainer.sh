#!/usr/bin/env sh
set -eu

STACK_FILE="${1:-portainer-stack.yml}"
ENV_FILE="${2:-.env.portainer}"

if [ ! -f "$STACK_FILE" ]; then
  echo "Missing stack file: $STACK_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ] && [ -f ".env.portainer.example" ]; then
  cp .env.portainer.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.portainer.example"
  echo "Edit APP_URL, NEXT_PUBLIC_APP_URL, and JWT_SECRET, then rerun this script."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

if grep -q "CHANGE_ME_TO_A_LONG_RANDOM_SECRET" "$ENV_FILE"; then
  echo "Set a real JWT_SECRET in $ENV_FILE before deploying."
  exit 1
fi

if docker compose ls >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "Docker Compose is not installed on this host."
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

echo "Using $DC with $STACK_FILE"
sh -c "$DC -f '$STACK_FILE' up --build -d"
sh -c "$DC -f '$STACK_FILE' ps"
